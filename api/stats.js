// GET /api/stats (admin) -> dashboard numbers using cheap Firestore count() queries
import { route, ok, requireUser, requireAdmin } from '../utils/http.js';
import { db } from '../utils/firebaseAdmin.js';

async function getStats(req, res) {
  requireAdmin(await requireUser(req));
  const firestore = db();
  const count = async (query) => (await query.count().get()).data().count;
  const reports = firestore.collection('reports');
  const [lost, found, pending, matched, returnedItems, matches, returnedMatches] = await Promise.all([
    count(reports.where('type', '==', 'lost')),
    count(reports.where('type', '==', 'found')),
    count(reports.where('status', '==', 'active')),
    count(reports.where('status', '==', 'matched')),
    count(reports.where('status', '==', 'returned')),
    count(firestore.collection('matches')),
    count(firestore.collection('matches').where('status', '==', 'returned')),
  ]);
  return ok(res, { lost, found, pending, matched, returnedItems, matches, returnedMatches });
}

export default route({ GET: getStats });
