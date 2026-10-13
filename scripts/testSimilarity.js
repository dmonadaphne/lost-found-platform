// Checks the REAL Sentence-BERT model through the Hugging Face API.
// Run:  npm run test:similarity      (needs HUGGINGFACE_API_KEY in .env)
import { generateEmbedding } from '../utils/embedding.js';
import { calculateCosineSimilarity, toPercent } from '../utils/cosineSimilarity.js';
import { positivePair, negativePair } from './sampleData.js';

const threshold = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.75');

async function score(a, b) {
  const [va, vb] = await Promise.all([generateEmbedding(a), generateEmbedding(b)]);
  return calculateCosineSimilarity(va, vb);
}

const positive = await score(...positivePair);
const negative = await score(...negativePair);
console.log(`Same phone, different words : ${toPercent(positive)}%  (threshold ${threshold * 100}%)`);
console.log(`Phone vs wallet             : ${toPercent(negative)}%`);

let failed = false;
if (positive < threshold) { console.error('FAIL: the matching pair scored below the threshold. Consider lowering SIMILARITY_THRESHOLD.'); failed = true; }
if (negative >= threshold) { console.error('FAIL: the unrelated pair scored above the threshold.'); failed = true; }
console.log(failed ? 'Result: FAILED' : 'Result: PASSED (semantic similarity works)');
process.exit(failed ? 1 : 0);
