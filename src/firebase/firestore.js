// FIRESTORE (BaaS) from the browser: a real-time listener on the user's own reports.
// Allowed by firestore.rules because every report is read only by its owner.
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './config';

export function subscribeToMyReports(userId, onData, onError) {
  const q = query(collection(db, 'reports'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const reports = snap.docs.map((d) => {
      const { embedding, ...rest } = d.data(); // the 384-number vector is not needed in the UI
      return { ...rest, id: d.id, createdAtMs: rest.createdAt?.toMillis?.() || 0 };
    });
    reports.sort((a, b) => b.createdAtMs - a.createdAtMs);
    onData(reports);
  }, onError);
}
