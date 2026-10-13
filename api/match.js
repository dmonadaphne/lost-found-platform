// POST /api/match   body: { reportId }
// Re-runs matching for a saved report (used when the AI service was down earlier).
import { route, ok, HttpError, requireUser } from '../utils/http.js';
import { db } from '../utils/firebaseAdmin.js';
import { runMatching, summarizeResult } from '../utils/matcher.js';

async function retryMatch(req, res) {
  const user = await requireUser(req);
  const { reportId } = req.body || {};
  if (!reportId) throw new HttpError(400, 'reportId is required.', 'VALIDATION_ERROR');

  const firestore = db();
  const snap = await firestore.collection('reports').doc(reportId).get();
  if (!snap.exists) throw new HttpError(404, 'Report not found.', 'NOT_FOUND');
  const report = { ...snap.data(), id: snap.id };
  if (!user.isAdmin && user.uid !== report.userId) throw new HttpError(403, 'You can only match your own reports.', 'FORBIDDEN');
  if (report.status === 'returned') throw new HttpError(400, 'This item was already returned.', 'ALREADY_DONE');

  const result = await runMatching(firestore, report);
  const { data, message } = summarizeResult(report.id, result);
  return ok(res, data, message);
}

export default route({ POST: retryMatch });
