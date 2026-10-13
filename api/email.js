// POST /api/email   body: { matchId }
// Re-sends only the emails that previously failed (for example Brevo was down).
import { route, ok, HttpError, requireUser } from '../utils/http.js';
import { db } from '../utils/firebaseAdmin.js';
import { notifyMatch } from '../utils/notify.js';

async function resendEmails(req, res) {
  const user = await requireUser(req);
  const { matchId } = req.body || {};
  if (!matchId) throw new HttpError(400, 'matchId is required.', 'VALIDATION_ERROR');

  const firestore = db();
  const snap = await firestore.collection('matches').doc(matchId).get();
  if (!snap.exists) throw new HttpError(404, 'Match not found.', 'NOT_FOUND');
  const match = { ...snap.data(), id: snap.id };
  if (!user.isAdmin && ![match.lostUserId, match.foundUserId].includes(user.uid)) {
    throw new HttpError(403, 'This match does not belong to you.', 'FORBIDDEN');
  }

  const sides = ['lost', 'found'].filter((s) => match.notifyStatus?.[s] !== 'sent');
  if (sides.length === 0) return ok(res, { notifyStatus: match.notifyStatus }, 'All notifications were already sent.');

  const [lost, found] = await Promise.all([
    firestore.collection('reports').doc(match.lostReportId).get(),
    firestore.collection('reports').doc(match.foundReportId).get(),
  ]);
  if (!lost.exists || !found.exists) throw new HttpError(404, 'One of the reports no longer exists.', 'NOT_FOUND');

  const result = await notifyMatch(firestore, match, lost.data(), found.data(), sides);
  const notifyStatus = { ...match.notifyStatus, ...result };
  await firestore.collection('matches').doc(matchId).update({ notifyStatus });

  const failed = Object.values(result).includes('failed');
  return ok(res, { notifyStatus }, failed ? 'Match found, but notification could not be sent.' : 'Notifications sent.');
}

export default route({ POST: resendEmails });
