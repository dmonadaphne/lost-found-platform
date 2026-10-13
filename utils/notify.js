// Sends the two emails for a match and records each one in the "notifications" collection.
import { FieldValue } from './firebaseAdmin.js';
import { sendMatchEmail } from './brevo.js';

// sides: which parties to email. 'lost' = owner, 'found' = finder.
// Returns e.g. { lost: 'sent', found: 'failed' }
export async function notifyMatch(firestore, match, lost, found, sides = ['lost', 'found']) {
  const result = {};
  for (const side of sides) {
    const me = side === 'lost' ? lost : found;
    const other = side === 'lost' ? found : lost;

    const email = await sendMatchEmail({
      toEmail: me.userEmail,
      toName: me.userName,
      itemName: me.itemName,
      description: me.description,
      otherItemName: other.itemName,
      score: match.similarityScore,
      location: other.location,
    });

    const ref = firestore.collection('notifications').doc();
    await ref.set({
      id: ref.id,
      matchId: match.id,
      recipientEmail: me.userEmail,
      recipientName: me.userName,
      type: 'match_found',
      status: email.ok ? 'sent' : 'failed',
      error: email.ok ? null : email.error,
      sentAt: FieldValue.serverTimestamp(),
    });
    result[side] = email.ok ? 'sent' : 'failed';
  }
  return result;
}
