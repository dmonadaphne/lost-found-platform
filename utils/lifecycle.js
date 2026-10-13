// Status changes: ACTIVE -> MATCHED -> RETURNED, plus rejecting wrong matches.
import { FieldValue } from './firebaseAdmin.js';
import { HttpError } from './http.js';

const OPEN = ['potential', 'confirmed'];

export async function matchesForReport(firestore, report) {
  const field = report.type === 'lost' ? 'lostReportId' : 'foundReportId';
  const snap = await firestore.collection('matches').where(field, '==', report.id).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

// A matched report with no remaining open matches goes back to ACTIVE so it can match again.
export async function releaseIfFree(firestore, reportId) {
  const ref = firestore.collection('reports').doc(reportId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().status !== 'matched') return;
  const open = (await matchesForReport(firestore, { id: reportId, type: snap.data().type })).filter((m) => OPEN.includes(m.status));
  if (open.length === 0) await ref.update({ status: 'active', updatedAt: FieldValue.serverTimestamp() });
}

export async function rejectMatch(firestore, match) {
  await firestore.collection('matches').doc(match.id).update({ status: 'rejected' });
  await releaseIfFree(firestore, match.lostReportId);
  await releaseIfFree(firestore, match.foundReportId);
}

export async function markMatchReturned(firestore, match) {
  const now = FieldValue.serverTimestamp();
  const batch = firestore.batch();
  batch.update(firestore.collection('matches').doc(match.id), { status: 'returned', returnedAt: now });
  batch.update(firestore.collection('reports').doc(match.lostReportId), { status: 'returned', updatedAt: now });
  batch.update(firestore.collection('reports').doc(match.foundReportId), { status: 'returned', updatedAt: now });
  await batch.commit();

  // Any other open matches of these two reports are obsolete now.
  for (const [id, type] of [[match.lostReportId, 'lost'], [match.foundReportId, 'found']]) {
    const others = (await matchesForReport(firestore, { id, type })).filter((m) => m.id !== match.id && OPEN.includes(m.status));
    for (const o of others) {
      await firestore.collection('matches').doc(o.id).update({ status: 'rejected' });
      await releaseIfFree(firestore, type === 'lost' ? o.foundReportId : o.lostReportId);
    }
  }
}

// "Mark returned" on a report. If it has several open matches we need to know which one.
export async function markReportReturned(firestore, report, matchId) {
  const open = (await matchesForReport(firestore, report)).filter((m) => OPEN.includes(m.status));
  let target = matchId ? open.find((m) => m.id === matchId) : open.length === 1 ? open[0] : null;
  if (matchId && !target) throw new HttpError(404, 'That match is not open for this report.', 'NOT_FOUND');

  if (!target) {
    if (open.length > 1) {
      throw new HttpError(400, 'This item has several potential matches. Open the Matches page and mark the correct one as returned.', 'MATCH_REQUIRED');
    }
    await firestore.collection('reports').doc(report.id).update({ status: 'returned', updatedAt: FieldValue.serverTimestamp() });
    return;
  }
  await markMatchReturned(firestore, target);
}

export async function deleteReportCascade(firestore, report) {
  const open = (await matchesForReport(firestore, report)).filter((m) => OPEN.includes(m.status));
  await firestore.collection('reports').doc(report.id).delete();
  for (const m of open) {
    await firestore.collection('matches').doc(m.id).update({ status: 'rejected' });
    await releaseIfFree(firestore, report.type === 'lost' ? m.foundReportId : m.lostReportId);
  }
}
