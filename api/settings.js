// GET /api/settings -> { threshold, isAdmin }      PUT /api/settings (admin) body: { threshold }
import { route, ok, HttpError, requireUser, requireAdmin } from '../utils/http.js';
import { db } from '../utils/firebaseAdmin.js';
import { getThreshold } from '../utils/config.js';

async function getSettings(req, res) {
  const user = await requireUser(req);
  return ok(res, { threshold: await getThreshold(db()), isAdmin: user.isAdmin });
}

async function saveSettings(req, res) {
  const user = await requireUser(req);
  requireAdmin(user);
  const threshold = Number(req.body?.threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new HttpError(400, 'Threshold must be a number between 0 and 1.', 'VALIDATION_ERROR');
  }
  await db().doc('settings/config').set({ threshold }, { merge: true });
  return ok(res, { threshold }, 'Threshold updated.');
}

export default route({ GET: getSettings, PUT: saveSettings });
