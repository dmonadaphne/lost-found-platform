import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReportInput } from '../utils/validation.js';
import { lostPhone } from '../scripts/sampleData.js';

test('a complete report is valid', () => assert.equal(validateReportInput(lostPhone).valid, true));
test('missing and bad fields produce field-level errors', () => {
  const { valid, errors } = validateReportInput({ type: 'lost', description: 'short', userEmail: 'nope', date: '2999-01-01' });
  assert.equal(valid, false);
  for (const key of ['itemName', 'category', 'description', 'location', 'userName', 'userEmail', 'date']) assert.ok(errors[key], key);
});
test('type must be lost or found', () => assert.ok(validateReportInput({ ...lostPhone, type: 'stolen' }).errors.type));
test('arbitrary image URLs are rejected', () => {
  assert.ok(validateReportInput({ ...lostPhone, imageUrl: 'https://evil.example/x.png' }).errors.imageUrl);
});
