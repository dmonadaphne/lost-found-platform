// Offline test of the whole matching pipeline. Hugging Face and Brevo are replaced by a stub
// fetch; Firestore by an in-memory fake. The stub embedder is a simple word-count vector
// (NOT Sentence-BERT) so these tests prove the PLUMBING. Run `npm run test:similarity`
// to check the real model's scores.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirestore } from './helpers/fakeFirestore.js';
import { runMatching, summarizeResult } from '../utils/matcher.js';
import { generateEmbedding, buildEmbeddingText } from '../utils/embedding.js';
import { lostPhone, foundPhone, foundWallet } from '../scripts/sampleData.js';

process.env.HUGGINGFACE_API_KEY = 'test';
process.env.BREVO_API_KEY = 'test';
process.env.BREVO_SENDER_EMAIL = 'sender@example.com';
process.env.SIMILARITY_THRESHOLD = '0.6'; // the stub embedder is cruder than Sentence-BERT

const SYNONYMS = { mobile: 'phone', cover: 'case', crack: 'cracked', discovered: 'found' };
function fakeEmbed(text) {
  const vec = new Array(256).fill(0);
  for (const raw of text.toLowerCase().match(/[a-z0-9]+/g) || []) {
    const word = SYNONYMS[raw] || raw;
    let h = 0; for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) % 256;
    vec[h] += 1;
  }
  return vec;
}

let hfDown, brevoDown, emailsSent, firestore, n;
beforeEach(() => {
  hfDown = false; brevoDown = false; emailsSent = []; firestore = createFakeFirestore(); n = 0;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('huggingface')) {
      if (hfDown) return new Response('down', { status: 500 });
      return new Response(JSON.stringify(fakeEmbed(JSON.parse(opts.body).inputs)), { status: 200 });
    }
    if (String(url).includes('brevo')) {
      if (brevoDown) return new Response('down', { status: 500 });
      emailsSent.push(JSON.parse(opts.body));
      return new Response(JSON.stringify({ messageId: 'm1' }), { status: 201 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
});

// Same steps as POST /api/reports (minus HTTP/auth): embed, save, match.
async function submit(fields, userId, { embed = true } = {}) {
  const id = `r${++n}`;
  const embedding = embed ? await generateEmbedding(buildEmbeddingText(fields)) : null;
  const report = { ...fields, id, userId, status: 'active', embedding, matchProcessing: 'pending' };
  await firestore.doc(`reports/${id}`).set(report);
  return { report, result: await runMatching(firestore, report) };
}
const col = (name) => [...firestore.store.entries()].filter(([p]) => p.startsWith(`${name}/`)).map(([, d]) => d);

test('lost then found: high score creates a match, updates statuses and emails both people', async () => {
  const lost = await submit(lostPhone, 'u1');
  assert.equal(lost.result.matches.length, 0); // nothing to compare with yet
  const found = await submit(foundPhone, 'u2');

  assert.equal(found.result.matches.length, 1);
  const match = found.result.matches[0];
  assert.ok(match.similarityScore >= 0.6);
  assert.deepEqual(match.notifyStatus, { lost: 'sent', found: 'sent' });
  assert.equal(firestore.store.get(`reports/${lost.report.id}`).status, 'matched');
  assert.equal(firestore.store.get(`reports/${found.report.id}`).status, 'matched');
  assert.deepEqual(emailsSent.map((e) => e.to[0].email).sort(), ['asha.owner@example.com', 'ravi.finder@example.com']);
  assert.equal(emailsSent[0].subject, 'Potential Lost & Found Match Found');
  assert.equal(col('notifications').length, 2);
  assert.equal(summarizeResult(found.report.id, found.result).message, 'Potential match found!');
});

test('found then lost also matches (both directions work)', async () => {
  await submit(foundPhone, 'u2');
  const lost = await submit(lostPhone, 'u1');
  assert.equal(lost.result.matches.length, 1);
});

test('low similarity: no match, nobody notified, report stays active', async () => {
  await submit(lostPhone, 'u1');
  const wallet = await submit(foundWallet, 'u2');
  assert.equal(wallet.result.matches.length, 0);
  assert.ok(wallet.result.bestScore < 0.6);
  assert.equal(emailsSent.length, 0);
  assert.equal(firestore.store.get(`reports/${wallet.report.id}`).status, 'active');
});

test('AI unavailable: report is kept and marked matchProcessing=failed', async () => {
  hfDown = true;
  const { report, result } = await submit(lostPhone, 'u1', { embed: false });
  assert.equal(result.processing, 'failed');
  assert.equal(firestore.store.get(`reports/${report.id}`).matchProcessing, 'failed');
  assert.match(summarizeResult(report.id, result).message, /temporarily unavailable. Your report has still been saved/);
});

test('email unavailable: match stays stored, notification status is failed', async () => {
  await submit(lostPhone, 'u1');
  brevoDown = true;
  const found = await submit(foundPhone, 'u2');
  assert.equal(found.result.matches.length, 1);
  assert.deepEqual(found.result.matches[0].notifyStatus, { lost: 'failed', found: 'failed' });
  assert.equal(col('matches').length, 1);
  assert.ok(col('notifications').every((x) => x.status === 'failed'));
  assert.equal(summarizeResult(found.report.id, found.result).message, 'Match found, but notification could not be sent.');
});

test('compares against all candidates and returns the top 3 when more qualify', async () => {
  await submit({ ...foundPhone, itemName: 'Samsung phone A' }, 'f1');
  await submit({ ...foundPhone, itemName: 'Samsung phone B' }, 'f2');
  await submit({ ...foundPhone, itemName: 'Samsung phone C' }, 'f3');
  await submit({ ...foundPhone, itemName: 'Samsung phone D' }, 'f4');
  await submit(foundWallet, 'f5');
  const lost = await submit(lostPhone, 'u1');
  assert.equal(lost.result.matches.length, 3);
  assert.equal(lost.result.candidatesChecked, 5);
});

test('a user is never matched with their own report (unless ALLOW_SELF_MATCH=true)', async () => {
  await submit(lostPhone, 'same');
  const found = await submit(foundPhone, 'same');
  assert.equal(found.result.matches.length, 0);
});

test('running matching twice does not create duplicate matches', async () => {
  await submit(lostPhone, 'u1');
  const found = await submit(foundPhone, 'u2');
  firestore.store.set(`reports/${found.report.id}`, { ...firestore.store.get(`reports/${found.report.id}`), status: 'active' });
  firestore.store.set('reports/r1', { ...firestore.store.get('reports/r1'), status: 'active' });
  const again = await runMatching(firestore, { ...found.report });
  assert.equal(again.matches.length, 0);
  assert.equal(col('matches').length, 1);
});
