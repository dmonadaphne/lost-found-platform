// PATCH /api/reports/:id/status   body: { status: "returned", matchId? }
// Owners can mark their own report as returned. Admins can also set any status.
import { route, ok, HttpError, requireUser } from '../../../utils/http.js';
import { db, FieldValue } from '../../../utils/firebaseAdmin.js';
import { markReportReturned } from '../../../utils/lifecycle.js';

async function updateStatus(req, res) {
  const user = await requireUser(req);
  const { status, matchId } = req.body || {};
  if (!['active', 'matched', 'returned'].includes(status)) {
    throw new HttpError(400, 'Status must be active, matched or returned.', 'VALIDATION_ERROR');
  }

  const firestore = db();
  const snap = await firestore.collection('reports').doc(req.query.id).get();
  if (!snap.exists) throw new HttpError(404, 'Report not found.', 'NOT_FOUND');
  const report = { ...snap.data(), id: snap.id };

  if (!user.isAdmin && user.uid !== report.userId) throw new HttpError(403, 'You can only update your own reports.', 'FORBIDDEN');
  if (!user.isAdmin && status !== 'returned') throw new HttpError(403, 'Only admins can set that status.', 'FORBIDDEN');
  if (report.status === 'returned' && status === 'returned') throw new HttpError(400, 'This item is already marked as returned.', 'ALREADY_DONE');

  if (status === 'returned') {
    await markReportReturned(firestore, report, matchId);
  } else {
    await firestore.collection('reports').doc(report.id).update({ status, updatedAt: FieldValue.serverTimestamp() });
  }
  return ok(res, { id: report.id, status }, `Report marked as ${status}.`);
}

export default route({ PATCH: updateStatus });
