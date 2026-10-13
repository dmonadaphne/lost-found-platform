// ---------------------------------------------------------------------------
// COSINE SIMILARITY
//   similarity(A, B) = (A . B) / (||A|| x ||B||)
// A . B  = sum of A[i] * B[i]      ||A|| = sqrt(sum of A[i]^2)
// 1 = same direction (same meaning), 0 = unrelated, -1 = opposite.
// ---------------------------------------------------------------------------
export function calculateCosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
    throw new Error('Both vectors must be arrays');
  }
  if (vectorA.length === 0 || vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same, non-zero length');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vectorA.length; i++) {
    dot += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }
  if (normA === 0 || normB === 0) return 0; // a zero vector has no direction

  const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, score)); // clamp tiny floating point overshoot
}

// 0.8742 -> 87.42
export function toPercent(score) {
  return Math.round(score * 10000) / 100;
}
