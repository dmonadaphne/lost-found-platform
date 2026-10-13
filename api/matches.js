// GET   /api/matches            -> my matches (or ?scope=admin for all)
// PATCH /api/matches            -> body { id, action: "confirm" | "reject" | "returned" }
import { route, ok, HttpError, requireUser } from '../utils/http.js';
import { db } from '../utils/firebaseAdmin.js';
import { serializeMatch } from '../utils/serialize.js';
import { rejectMatch, markMatchReturned } from '../utils/lifecycle.js';

async function listMatches(req, res) {
  const user = await requireUser(req);
  const firestore = db();
  const admin = req.query.scope === 'admin';
  if (admin && !user.isAdmin) throw new HttpError(403, 'Admin access required.', 'FORBIDDEN');

  let matches;
  if (admin) {
    const snap = await firestore.collection('matches').orderBy('createdAt', 'desc').limit(200).get();
    matches = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } else {
    const [asOwner, asFinder] = await Promise.all([
      firestore.collection('matches').where('lostUserId', '==', user.uid).limit(100).get(),
      firestore.collection('matches').where('foundUserId', '==', user.uid).limit(100).get(),
    ]);
    const byId = new Map();
    [...asOwner.docs, ...asFinder.docs].forEach((d) => byId.set(d.id, { ...d.data(), id: d.id }));
    matches = [...byId.values()];
  }
  matches.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  matches = matches.slice(0, 100);

  // Load both reports of every match in one batch call to show the other party's name/email.
  const refs = [...new Set(matches.flatMap((m) => [m.lostReportId, m.foundReportId]))]
    .map((id) => firestore.collection('reports').doc(id));
  const reportDocs = refs.length ? await firestore.getAll(...refs) : [];
  const reports = new Map(reportDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]));

  const rows = matches.map((m) => {
    const base = serializeMatch(m);
    const lost = reports.get(m.lostReportId);
    const found = reports.get(m.foundReportId);
    base.lostDescription = lost?.description || '';
    base.foundDescription = found?.description || '';
    if (admin) {
      base.lostParty = lost ? { name: lost.userName, email: lost.userEmail } : null;
      base.foundParty = found ? { name: found.userName, email: found.userEmail } : null;
      return base;
    }
    // Participants see the OTHER person's name + email (not phone) so they can arrange the return.
    const isOwner = m.lostUserId === user.uid;
    const other = isOwner ? found : lost;
    base.role = isOwner ? 'owner' : 'finder';
    base.counterpart = other && m.status !== 'rejected' ? {
      name: other.userName,
      email: other.userEmail,
      // Phone is shared only after the match is confirmed, and only with the two people in it.
      phone: m.status === 'confirmed' ? (other.userPhone || '') : '',
    } : null;
    return base;
  });
  return ok(res, { matches: rows, count: rows.length });
}

async function updateMatch(req, res) {
  const user = await requireUser(req);
  const { id, action } = req.body || {};
  if (!id || !['confirm', 'reject', 'returned'].includes(action)) {
    throw new HttpError(400, 'id and a valid action (confirm, reject, returned) are required.', 'VALIDATION_ERROR');
  }
  const firestore = db();
  const snap = await firestore.collection('matches').doc(id).get();
  if (!snap.exists) throw new HttpError(404, 'Match not found.', 'NOT_FOUND');
  const match = { ...snap.data(), id: snap.id };

  const participant = [match.lostUserId, match.foundUserId].includes(user.uid);
  if (!participant && !user.isAdmin) throw new HttpError(403, 'This match does not belong to you.', 'FORBIDDEN');
  if (['rejected', 'returned'].includes(match.status)) throw new HttpError(400, `This match is already ${match.status}.`, 'ALREADY_DONE');

  if (action === 'confirm') await firestore.collection('matches').doc(id).update({ status: 'confirmed' });
  if (action === 'reject') await rejectMatch(firestore, match);
  if (action === 'returned') await markMatchReturned(firestore, match);

  const updated = await firestore.collection('matches').doc(id).get();
  return ok(res, { match: serializeMatch({ ...updated.data(), id }) }, 'Match updated.');
}

export default route({ GET: listMatches, PATCH: updateMatch });
