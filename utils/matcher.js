// ---------------------------------------------------------------------------
// MATCHING ENGINE
//   new report -> embedding -> compare with ALL active opposite-type reports
//   -> cosine similarity -> keep scores >= threshold -> top 3 become matches.
// ---------------------------------------------------------------------------
import { FieldValue } from './firebaseAdmin.js';
import { calculateCosineSimilarity } from './cosineSimilarity.js';
import { generateEmbedding, buildEmbeddingText } from './embedding.js';
import { getThreshold } from './config.js';
import { notifyMatch } from './notify.js';
import { serializeMatch } from './serialize.js';

const MAX_CANDIDATES = 200; // never read more than this many reports per match run
const MAX_BACKFILL = 10;    // old reports with no embedding get one generated (limit API calls)
const MAX_MATCHES = 3;      // "top 3 potential matches"

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'near', 'with', 'it', 'its', 'is', 'was',
  'has', 'have', 'had', 'my', 'i', 'to', 'for', 'found', 'lost', 'outside', 'inside', 'this', 'that', 'there', 'by', 'from']);
const words = (s = '') => new Set(s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP_WORDS.has(w)) || []);
const same = (a, b) => a && b && a.trim().toLowerCase() === b.trim().toLowerCase();

// Plain-language reasons shown on the Match page (the score itself comes from the AI).
function explainMatch(lost, found, score) {
  const reasons = [];
  if (same(lost.category, found.category)) reasons.push(`same category (${lost.category})`);
  if (same(lost.color, found.color)) reasons.push(`same color (${lost.color})`);
  if (same(lost.brand, found.brand)) reasons.push(`same brand (${lost.brand})`);
  const shared = [...words(lost.description + ' ' + lost.location)].filter((w) => words(found.description + ' ' + found.location).has(w));
  if (shared.length) reasons.push(`shared details: ${shared.slice(0, 6).join(', ')}`);
  return `The descriptions are ${(score * 100).toFixed(1)}% semantically similar` + (reasons.length ? `: ${reasons.join('; ')}.` : '.');
}

async function createMatch(firestore, report, other, score, threshold) {
  const lost = report.type === 'lost' ? report : other;
  const found = report.type === 'found' ? report : other;
  const id = `${lost.id}_${found.id}`; // one match per pair, so retries never create duplicates
  const ref = firestore.collection('matches').doc(id);

  const match = {
    id,
    lostReportId: lost.id, foundReportId: found.id,
    lostUserId: lost.userId, foundUserId: found.userId,
    similarityScore: Math.round(score * 10000) / 10000,
    threshold,
    status: 'potential',
    lostItemName: lost.itemName, foundItemName: found.itemName,
    lostLocation: lost.location, foundLocation: found.location,
    explanation: explainMatch(lost, found, score),
    notifyStatus: { lost: 'pending', found: 'pending' },
    createdAt: FieldValue.serverTimestamp(),
  };

  try {
    await ref.create(match); // fails if the pair already has a match
  } catch (err) {
    if (err.code === 6) return null; // 6 = ALREADY_EXISTS
    throw err;
  }

  // Mark both reports as matched in one atomic batch.
  const batch = firestore.batch();
  for (const r of [lost, found]) {
    batch.update(firestore.collection('reports').doc(r.id), { status: 'matched', updatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();

  const notifyStatus = await notifyMatch(firestore, match, lost, found);
  await ref.update({ notifyStatus });
  return { ...match, notifyStatus, createdAt: new Date().toISOString() };
}

// Runs the whole matching process for one saved report. It never throws: on any
// failure the report stays saved and matchProcessing becomes "failed" (retry later).
export async function runMatching(firestore, report) {
  const reportRef = firestore.collection('reports').doc(report.id);
  try {
    const threshold = await getThreshold(firestore);

    let embedding = report.embedding;
    if (!embedding) {
      embedding = await generateEmbedding(buildEmbeddingText(report));
      await reportRef.update({ embedding });
    }

    // Opposite type + still active. Two equality filters need no composite index.
    const opposite = report.type === 'lost' ? 'found' : 'lost';
    const snap = await firestore.collection('reports')
      .where('type', '==', opposite).where('status', '==', 'active').limit(MAX_CANDIDATES).get();

    const allowSelf = process.env.ALLOW_SELF_MATCH === 'true';
    const candidates = snap.docs.map((d) => ({ ...d.data(), id: d.id }))
      .filter((c) => allowSelf || c.userId !== report.userId);

    // Reports saved while the AI was down have no embedding yet: generate a few now.
    let backfilled = 0;
    for (const c of candidates) {
      if (c.embedding || backfilled >= MAX_BACKFILL) continue;
      backfilled++;
      try {
        c.embedding = await generateEmbedding(buildEmbeddingText(c));
        await firestore.collection('reports').doc(c.id).update({ embedding: c.embedding });
      } catch { /* leave it for the next run */ }
    }

    // Score EVERY candidate (do not stop at the first match), best first.
    const scored = candidates
      .filter((c) => Array.isArray(c.embedding) && c.embedding.length === embedding.length)
      .map((c) => ({ other: c, score: calculateCosineSimilarity(embedding, c.embedding) }))
      .sort((a, b) => b.score - a.score);

    const bestScore = scored.length ? scored[0].score : null;
    const qualified = scored.filter((s) => s.score >= threshold).slice(0, MAX_MATCHES);

    const matches = [];
    for (const { other, score } of qualified) {
      const match = await createMatch(firestore, { ...report, embedding }, other, score, threshold);
      if (match) matches.push(match);
    }

    await reportRef.update({ matchProcessing: 'done', matchError: null, updatedAt: FieldValue.serverTimestamp() });
    return { processing: 'done', threshold, bestScore, candidatesChecked: scored.length, matches };
  } catch (err) {
    console.error('Matching failed (report is still saved):', err.message);
    await reportRef.update({ matchProcessing: 'failed', matchError: err.message, updatedAt: FieldValue.serverTimestamp() }).catch(() => {});
    return { processing: 'failed', error: err.message, matches: [] };
  }
}

// Turns a runMatching() result into the JSON the API returns.
export function summarizeResult(reportId, result) {
  const matchFound = result.matches.length > 0;
  const emailFailed = result.matches.some((m) => Object.values(m.notifyStatus).includes('failed'));
  let message = 'Report submitted successfully.';
  if (result.processing === 'failed') message = 'AI matching is temporarily unavailable. Your report has still been saved.';
  else if (matchFound) message = emailFailed ? 'Match found, but notification could not be sent.' : 'Potential match found!';

  return {
    message,
    data: {
      reportId,
      reportSaved: true,
      matchProcessing: result.processing,
      matchFound,
      similarityScore: matchFound ? result.matches[0].similarityScore : (result.bestScore ?? null),
      matchId: matchFound ? result.matches[0].id : null,
      matches: result.matches.map(serializeMatch),
      threshold: result.threshold ?? null,
      emailFailed,
    },
  };
}
