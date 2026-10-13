// End-to-end test against a RUNNING deployment (vercel dev or production).
//   1. signs two test users in with Firebase Auth (creates them if needed)
//   2. user 1 reports the lost phone, user 2 reports the found phone, user 2 reports a wallet
//   3. prints scores, match id and email status
// Needs: .env with VITE_FIREBASE_API_KEY, E2E_EMAIL_1, E2E_EMAIL_2, E2E_PASSWORD, E2E_BASE_URL
import { lostPhone, foundPhone, foundWallet } from './sampleData.js';

const { VITE_FIREBASE_API_KEY: key, E2E_EMAIL_1: email1, E2E_EMAIL_2: email2, E2E_PASSWORD: password } = process.env;
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
if (!key || !email1 || !email2 || !password) {
  console.error('Set VITE_FIREBASE_API_KEY, E2E_EMAIL_1, E2E_EMAIL_2 and E2E_PASSWORD in .env first.');
  process.exit(1);
}

async function idToken(email) {
  for (const action of ['signInWithPassword', 'signUp']) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const json = await res.json();
    if (res.ok) return json.idToken;
  }
  throw new Error(`Could not sign in or register ${email}`);
}

async function post(token, body) {
  const res = await fetch(`${base}/api/reports`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  return { status: res.status, ...(await res.json()) };
}

const check = (name, pass, detail = '') => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!pass) process.exitCode = 1; };

const t1 = await idToken(email1);
const t2 = await idToken(email2);
const stamp = Date.now(); // makes each run unique

const lost = await post(t1, { ...lostPhone, userEmail: email1, itemName: `${lostPhone.itemName} #${stamp}` });
check('Test 1: lost report saved', lost.success && lost.data.reportSaved, `id=${lost.data?.reportId}`);

const found = await post(t2, { ...foundPhone, userEmail: email2 });
check('Test 2/3: matching found report creates a match', found.success && found.data.matchFound,
  `score=${found.data?.similarityScore} matchId=${found.data?.matchId}`);
const notify = found.data?.matches?.[0]?.notifyStatus;
check('Test 4: both emails sent (check the inboxes too)', notify?.lost === 'sent' && notify?.found === 'sent', JSON.stringify(notify));

const wallet = await post(t2, { ...foundWallet, userEmail: email2 });
check('Test 5: unrelated report does not match', wallet.success && !wallet.data.matchFound, `score=${wallet.data?.similarityScore}`);

const invalid = await post(t1, { type: 'lost' });
check('Validation: bad input returns 400 with field errors', invalid.status === 400 && invalid.details?.itemName);
