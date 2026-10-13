// GET /api/reports/:id     -> one report (full details only for owner/admin)
// DELETE /api/reports/:id  -> owner or admin
import { route, ok, HttpError, requireUser, optionalUser } from '../../utils/http.js';
import { db } from '../../utils/firebaseAdmin.js';
import { publicReport, ownReport } from '../../utils/serialize.js';
import { deleteReportCascade } from '../../utils/lifecycle.js';

async function load(id) {
  const snap = await db().collection('reports').doc(id).get();
  if (!snap.exists) throw new HttpError(404, 'Report not found.', 'NOT_FOUND');
  return { ...snap.data(), id: snap.id };
}

async function getReport(req, res) {
  const report = await load(req.query.id);
  const user = await optionalUser(req);
  const full = user && (user.isAdmin || user.uid === report.userId);
  return ok(res, { report: full ? ownReport(report) : publicReport(report) });
}

async function deleteReport(req, res) {
  const user = await requireUser(req);
  const report = await load(req.query.id);
  if (!user.isAdmin && user.uid !== report.userId) throw new HttpError(403, 'You can only delete your own reports.', 'FORBIDDEN');
  await deleteReportCascade(db(), report);
  return ok(res, { id: report.id }, 'Report deleted.');
}

export default route({ GET: getReport, DELETE: deleteReport });
