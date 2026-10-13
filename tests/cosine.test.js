import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCosineSimilarity, toPercent } from '../utils/cosineSimilarity.js';
import { toVector } from '../utils/embedding.js';

test('identical vectors have similarity 1', () => {
  assert.ok(Math.abs(calculateCosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-12);
});
test('scaling a vector does not change the similarity', () => {
  assert.ok(Math.abs(calculateCosineSimilarity([1, 2, 3], [2, 4, 6]) - 1) < 1e-12);
});
test('orthogonal vectors have similarity 0', () => {
  assert.equal(calculateCosineSimilarity([1, 0], [0, 1]), 0);
});
test('opposite vectors have similarity -1', () => {
  assert.ok(Math.abs(calculateCosineSimilarity([1, 1], [-1, -1]) + 1) < 1e-12);
});
test('known value: [1,2,3] vs [4,5,6] is 0.9746', () => {
  assert.ok(Math.abs(calculateCosineSimilarity([1, 2, 3], [4, 5, 6]) - 0.9746318461970762) < 1e-12);
});
test('zero vector returns 0 and bad input throws', () => {
  assert.equal(calculateCosineSimilarity([0, 0], [1, 1]), 0);
  assert.throws(() => calculateCosineSimilarity([1], [1, 2]));
  assert.throws(() => calculateCosineSimilarity('a', [1]));
});
test('toPercent formats 0.8742 as 87.42', () => assert.equal(toPercent(0.8742), 87.42));
test('toVector handles flat, nested and per-token responses', () => {
  assert.deepEqual(toVector([1, 2]), [1, 2]);
  assert.deepEqual(toVector([[1, 2]]), [1, 2]);
  assert.deepEqual(toVector([[1, 2], [3, 4]]), [2, 3]); // mean pooling
  assert.deepEqual(toVector([[[1, 2]]]), [1, 2]);
  assert.throws(() => toVector({ error: 'x' }));
});
