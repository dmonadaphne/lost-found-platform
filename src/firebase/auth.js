// FIREBASE AUTHENTICATION (email + password). Passwords are handled by Firebase, never by us.
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

export async function registerUser(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  // Profile document in the "users" collection (allowed by firestore.rules for the owner only).
  await setDoc(doc(db, 'users', cred.user.uid), { displayName: name, email, createdAt: serverTimestamp() });
  return cred.user;
}

export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password).then((c) => c.user);
export const logoutUser = () => signOut(auth);

// Turns Firebase error codes into sentences a student can act on.
export function authMessage(err) {
  const map = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account uses that email.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  };
  return map[err.code] || 'Something went wrong. Please try again.';
}
