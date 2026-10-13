// ---------------------------------------------------------------------------
// FIREBASE (BaaS) - server side. The Admin SDK bypasses Firestore security rules,
// so it must only run in serverless functions, never in the browser.
// ---------------------------------------------------------------------------
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error('Firebase Admin is not configured (check FIREBASE_* environment variables)');
  }
  return initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // Env vars store the key on one line with literal "\n"; turn them back into newlines.
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export const db = () => getFirestore(getAdminApp());
export const adminAuth = () => getAuth(getAdminApp());
export { FieldValue };
