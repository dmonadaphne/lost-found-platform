// AI-AS-A-SERVICE / local Sentence-BERT embeddings.
// Model: all-MiniLM-L6-v2 (a Sentence-BERT model) -> 384-number vector.
// Similar MEANING gives similar vectors, even with different words.
//
// EMBEDDING_PROVIDER=local        -> runs the model inside the function (free, no key)
// EMBEDDING_PROVIDER=huggingface  -> calls the Hugging Face Inference API (needs credits)

const DEFAULT_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

export class EmbeddingError extends Error {}

// Text that represents a report. Structured fields are added so colour, brand, etc. count.
export function buildEmbeddingText(report) {
  const parts = [
    report.itemName,
    report.category && `Category: ${report.category}.`,
    report.description,
    report.color && `Color: ${report.color}.`,
    report.brand && `Brand: ${report.brand}.`,
    report.identifyingFeatures && `Features: ${report.identifyingFeatures}.`,
    report.location && `Location: ${report.location}.`,
  ];
  return parts.filter(Boolean).join(' ');
}

export async function generateEmbedding(text) {
  if (!text || !text.trim()) throw new EmbeddingError('Cannot embed empty text');
  const provider = (process.env.EMBEDDING_PROVIDER || 'local').toLowerCase();
  return provider === 'huggingface' ? embedWithHuggingFaceApi(text) : embedLocally(text);
}

// ---- Provider 1: local model ----
// The first call downloads the model (~23 MB) from the Hugging Face Hub (free) and caches it.
let extractorPromise = null;
async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = process.env.VERCEL ? '/tmp/hf-cache' : './.cache/hf';
      return pipeline('feature-extraction', process.env.LOCAL_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
    })();
    extractorPromise.catch(() => { extractorPromise = null; }); // allow a retry
  }
  return extractorPromise;
}

async function embedLocally(text) {
  try {
    const extractor = await getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (err) {
    throw new EmbeddingError(`Local embedding model failed: ${err.message}`);
  }
}

// ---- Provider 2: Hugging Face Inference API ----
async function embedWithHuggingFaceApi(text) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new EmbeddingError('HUGGINGFACE_API_KEY is not set');

  const model = process.env.HF_EMBEDDING_MODEL || DEFAULT_MODEL;
  const url = process.env.HF_EMBEDDING_URL ||
    `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: text }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      if (attempt === 3) throw new EmbeddingError(`Embedding API unreachable: ${err.message}`);
      continue;
    }
    if (response.status === 503 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new EmbeddingError(`Embedding API returned ${response.status}: ${body.slice(0, 200)}`);
    }
    return toVector(await response.json());
  }
  throw new EmbeddingError('Embedding API did not respond');
}

// Normalise flat, [[vector]] or per-token responses into one sentence vector.
export function toVector(data) {
  if (!Array.isArray(data) || data.length === 0) throw new EmbeddingError('Unexpected embedding response');
  if (typeof data[0] === 'number') return data;
  if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
    if (data.length === 1) return data[0];
    const size = data[0].length;
    const mean = new Array(size).fill(0);
    for (const row of data) for (let i = 0; i < size; i++) mean[i] += row[i] / data.length;
    return mean;
  }
  return toVector(data[0]);
}