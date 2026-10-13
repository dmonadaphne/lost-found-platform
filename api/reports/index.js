// VERCEL SERVERLESS FUNCTION (FaaS)
//   POST /api/reports  -> validate, embed, save to Firestore, run matching
//   GET  /api/reports  -> browse reports (scope=public | mine | admin)
import { route, ok, HttpError, requireUser, optionalUser } from '../../utils/http.js';
import { db, FieldValue } from '../../utils/firebaseAdmin.js';
import { validateReportInput } from '../../utils/validation.js';
import { generateEmbedding, buildEmbeddingText } from '../../utils/embedding.js';
import { runMatching, summarizeResult } from '../../utils/matcher.js';
import { publicReport, ownReport } from '../../utils/serialize.js';

const LIMIT = 100; // we never send more than this many reports to the browser

async function createReport(req, res) {
  const user = await requireUser(req);

  // 1. Validate (server-side, even though the React form validated too)
  const { valid, errors, data } = validateReportInput(req.body);
  if (!valid) throw new HttpError(400, 'Please fix the highlighted fields.', 'VALIDATION_ERROR', errors);

  const firestore = db();
  const ref = firestore.collection('reports').doc();

  // 2. Generate the semantic embedding. If the AI service is down we still save the report.
  let embedding = null;
  let embeddingError = null;
  try {
    embedding = await generateEmbedding(buildEmbeddingText(data));
  } catch (err) {
    embeddingError = err.message;
    console.error('Embedding failed:', err.message);
  }

  // 3. Save the report to Firestore
  const report = {
    ...data,
    id: ref.id,
    userId: user.uid,
    status: 'active',
    embedding,
    matchProcessing: embedding ? 'pending' : 'failed',
    matchError: embeddingError,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(report);

  // 4. Matching (skipped when AI is down; the user can retry later from "My reports")
  const result = embedding
    ? await runMatching(firestore, report)
    : { processing: 'failed', matches: [], error: embeddingError };

  const { data: payload, message } = summarizeResult(ref.id, result);
  return ok(res, payload, message, 201);
}

async function listReports(req, res) {
  const scope = req.query.scope || 'public';
  const user = scope === 'public' ? await optionalUser(req) : await requireUser(req);
  if (scope === 'admin' && !user.isAdmin) throw new HttpError(403, 'Admin access required.', 'FORBIDDEN');

  let query = db().collection('reports');
  let filtered = false;
  if (scope === 'mine') { query = query.where('userId', '==', user.uid); filtered = true; }
  for (const field of ['type', 'category', 'status']) {
    const value = req.query[field];
    if (value && value !== 'all') { query = query.where(field, '==', String(value)); filtered = true; }
  }
  // Equality filters only (no orderBy) so Firestore needs no composite index; sorted below.
  if (!filtered) query = query.orderBy('createdAt', 'desc');
  const snap = await query.limit(LIMIT).get();

  const search = String(req.query.search || '').toLowerCase().trim();
  const location = String(req.query.location || '').toLowerCase().trim();
  const fromDate = String(req.query.date || '');

  let rows = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  rows = rows.filter((r) => {
    if (search && !`${r.itemName} ${r.description} ${r.location} ${r.brand} ${r.color}`.toLowerCase().includes(search)) return false;
    if (location && !r.location.toLowerCase().includes(location)) return false;
    if (fromDate && r.date < fromDate) return false;
    return true;
  });
  rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  const reports = rows.map(scope === 'public' ? publicReport : ownReport);
  return ok(res, { reports, count: reports.length });
}

export default route({ POST: createReport, GET: listReports });
