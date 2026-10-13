# AI-Based Cloud Lost & Found Platform

A cloud-native web app where students report **lost** and **found** items. Every new report is turned into a Sentence-BERT embedding, compared with all opposite reports using **cosine similarity**, and if the score reaches a configurable threshold a **match** is created and **both people are emailed**.

## Features
- Report lost / found items (validated form, optional photo), Firebase email+password login
- Browse reports with search and filters (private data is never exposed)
- My reports (live updates from Firestore), Match results page, Admin dashboard
- AI semantic matching, top-3 candidates, configurable threshold (env var or admin dashboard)
- Brevo email to owner and finder, with per-email `sent` / `failed` tracking and a resend button
- Graceful failures: if AI or email is down, the report/match is still saved and can be retried

## Architecture
```
React (Vite) ──HTTPS + Firebase ID token──▶ Vercel Serverless API (/api/*)
   │                                          │
   │ (Auth, live read of own reports)         ├─▶ Firebase Firestore (Admin SDK)
   ▼                                          ├─▶ Hugging Face API  → 384-number embedding
Firebase Auth / Firestore / Storage           ├─▶ cosine similarity ≥ threshold ?
                                              │        YES → match doc + statuses + Brevo emails + notification docs
                                              │        NO  → keep report ACTIVE for future matching
```
The matching function is **called by the API right after the report is saved**. It is *not* a Firestore trigger.

**Why these decisions**
| Decision | Reason |
|---|---|
| All writes go through the API; Firestore rules deny client writes | Users cannot fake scores, statuses or edit other people's reports |
| Embeddings via Hugging Face API, not inside Vercel | The model needs ~90 MB + ML runtime; serverless has size/cold-start limits |
| Embedding stored on each report | Each comparison needs only 1 new API call, not one per candidate |
| `matches/{lostId}_{foundId}` as match ID | Retrying can never create duplicate matches |
| Browse API returns a sanitized copy | Email, phone, user ID and identifying features stay private |
| Equality-only Firestore queries, limit 200 | No composite indexes to create; never downloads a huge collection |
| Admins = `ADMIN_EMAILS` env var | Simplest protected admin for a college project (no custom claims needed) |

## Technology stack
React 18, React Router 6, Vite · Firebase Firestore, Auth, Storage · Vercel Serverless Functions (Node 20+) · Hugging Face Inference (`sentence-transformers/all-MiniLM-L6-v2`) · Brevo transactional email API.

## Cloud service models (what to say in your viva)
| Concept | Where it is used |
|---|---|
| **BaaS** | Firebase Firestore (database), Firebase Authentication (users), Firebase Storage (photos) |
| **FaaS** | Each file in `/api` is a Vercel Function that runs only when called |
| **Serverless computing** | Whole backend runs on Vercel with no server to manage; scales and bills per request |
| **AI-as-a-Service** | Hugging Face Inference API creates the Sentence-BERT embeddings |
| **Email-as-a-Service** | Brevo sends the transactional match emails |
| **Hosting (PaaS-style)** | Vercel serves the React build globally and deploys from GitHub |

## Folder structure
```
api/                    Vercel serverless functions (FaaS)
  reports/index.js      POST create+match, GET browse
  reports/[id].js       GET one, DELETE
  reports/[id]/status.js PATCH status (returned)
  match.js              POST retry matching
  matches.js            GET matches, PATCH confirm/reject/returned
  email.js              POST resend failed emails
  settings.js stats.js  threshold + admin stats
utils/                  Shared backend code
  cosineSimilarity.js   calculateCosineSimilarity()
  embedding.js          generateEmbedding() (Hugging Face)
  matcher.js            matching engine
  brevo.js notify.js    sendMatchEmail() + notification records
  lifecycle.js          ACTIVE → MATCHED → RETURNED
  validation.js         shared by React and API
  firebaseAdmin.js http.js config.js serialize.js
src/                    React app (components, pages, firebase, services, context)
scripts/ tests/         sample data, live tests, offline tests
firestore.rules storage.rules firebase.json vercel.json .env.example
```

## Database structure (Firestore)
- **reports** – `type, itemName, category, description, location, date, time, color, brand, identifyingFeatures, imageUrl, userId, userName, userEmail, userPhone, additionalInfo, status (active|matched|returned), embedding[384], matchProcessing (pending|done|failed), matchError, createdAt, updatedAt`
- **matches** – `lostReportId, foundReportId, lostUserId, foundUserId, similarityScore, threshold, status (potential|confirmed|rejected|returned), lostItemName, foundItemName, lostLocation, foundLocation, explanation, notifyStatus{lost,found}, createdAt`
- **notifications** – `matchId, recipientEmail, recipientName, type, status (sent|failed), error, sentAt`
- **users** – `displayName, email, createdAt`  ·  **settings/config** – `threshold`

## AI matching algorithm
1. Build text from item name, category, description, color, brand, features, location.
2. `generateEmbedding(text)` → 384-number vector (Sentence-BERT, via Hugging Face).
3. Load up to 200 **active** reports of the opposite type (not from the same user).
4. Score **every** candidate with cosine similarity; sort best first.
5. Keep scores ≥ threshold, take the **top 3**, create a match for each.
6. Mark both reports `matched`, email both people, store a notification record per email.

### Cosine similarity
`similarity(A,B) = (A · B) / (‖A‖ × ‖B‖)` measures the angle between two vectors, ignoring length. 1 = same meaning, 0 = unrelated. Sentence embeddings place similar meanings close together, so "mobile … cover" and "phone … case" score high even with different words. Shown as a percentage: `0.8742 → 87.42%`. See `utils/cosineSimilarity.js`.

## Installation
```bash
git clone <your-repo-url> && cd lost-found-platform
npm install
cp .env.example .env     # then fill in the values (see below)
```
Requires Node.js 20 or newer.

## Firebase setup
1. https://console.firebase.google.com → **Add project** (Analytics not needed).
2. **Build → Firestore Database → Create database** → production mode → pick a region near you.
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
4. (Optional photos) **Build → Storage → Get started.** Firebase may require the Blaze (pay-as-you-go) plan to create a bucket. If you don't want that, set `VITE_ENABLE_IMAGE_UPLOAD=false`; everything else works.
5. **Web config (public values):** Project settings (gear) → *General* → *Your apps* → **Web (`</>`)** → register app → copy the `firebaseConfig` values into the `VITE_FIREBASE_*` variables.
6. **Admin credentials (secret):** Project settings → *Service accounts* → **Generate new private key**. From the downloaded JSON copy `project_id`, `client_email`, `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (private key on one line inside double quotes, keep the `\n`). **Never commit that JSON file.**
7. **Collections** (`reports`, `matches`, `users`, `notifications`) are created automatically on first write; you don't create them by hand.
8. **Security rules:** Firestore → *Rules* tab → paste `firestore.rules` → Publish. Storage → *Rules* → paste `storage.rules` → Publish. (CLI alternative: `npx firebase-tools login && npx firebase-tools use --add && npx firebase-tools deploy --only firestore:rules,storage`.)

### What the rules enforce
Clients can only **read their own** reports/matches and write only their own `users` profile. They cannot write reports, matches, scores, statuses, notifications or settings; only the API (Admin SDK) can. Anyone calling the API is verified by their Firebase ID token.

## Hugging Face setup
1. Create a free account at https://huggingface.co.
2. Settings → **Access Tokens → New token** (a *fine-grained* token with permission to call Inference Providers, or a Read token).
3. Put it in `HUGGINGFACE_API_KEY`. Default model: `sentence-transformers/all-MiniLM-L6-v2` (change with `HF_EMBEDDING_MODEL`).
4. Test: `npm run test:similarity` prints the real scores for the sample pairs.

The code calls `POST https://router.huggingface.co/hf-inference/models/<model>/pipeline/feature-extraction`. If Hugging Face changes this again, set `HF_EMBEDDING_URL` to the new endpoint; the response parser accepts flat, nested and per-token vectors. If you switch to a different model, **clear old embeddings** (vectors from different models cannot be compared; the code skips candidates whose vector length differs).

## Brevo setup
1. Sign up at https://www.brevo.com.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**, then click the verification link sent to that address. (Gmail addresses can be used for testing; some inboxes may mark them as spam.)
3. Top-right account menu → **SMTP & API → API Keys → Generate a new API key.** Copy it to `BREVO_API_KEY`.
4. Set `BREVO_SENDER_EMAIL` (the verified sender) and `BREVO_SENDER_NAME`.
5. Test: run the end-to-end test (below) and check both inboxes, or Brevo → *Transactional → Logs*.

## Environment variables
| Variable | Local `.env` | Vercel | Notes |
|---|---|---|---|
| `VITE_FIREBASE_*` (6 values), `VITE_ENABLE_IMAGE_UPLOAD` | yes | yes | Public, baked into the React build |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | yes | yes | **Secret** |
| `HUGGINGFACE_API_KEY`, `HF_EMBEDDING_MODEL` | yes | yes | Key is **secret** |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | yes | yes | Key is **secret** |
| `SIMILARITY_THRESHOLD` | yes | yes | Default 0.75. An admin value saved in the dashboard overrides it |
| `ADMIN_EMAILS` | yes | yes | Comma-separated emails that see `/admin` |
| `APP_URL` | yes | yes | Link inside emails (your Vercel URL) |
| `ALLOW_SELF_MATCH` | optional | no | `true` lets one account match its own lost+found reports (demo only) |
| `E2E_*` | only for `npm run test:e2e` | no | |

`.env` is in `.gitignore`. **Never commit it.** Only `VITE_`-prefixed variables reach the browser.

## Local development
```bash
npm i -g vercel
vercel login
vercel link          # first time only; creates the project link
vercel dev           # serves React AND the /api functions at http://localhost:3000
```
`npm run dev` alone starts only React; API calls will 404. Use `vercel dev`. (`vercel dev` reads your local `.env`; or run `vercel env pull .env.local`.)

To become admin: put your login email in `ADMIN_EMAILS`, restart, log in; an **Admin** link appears.

## Testing
```bash
npm test                 # 20 offline tests: cosine math, validation, full matching pipeline
npm run test:similarity  # REAL Sentence-BERT scores (needs HUGGINGFACE_API_KEY)
npm run test:e2e         # REAL end-to-end against a running site (needs everything configured)
```
Offline tests use a stub embedder, an in-memory Firestore and a stub email service; they prove the logic, **not** the quality of the real model or your Firebase/Brevo setup.

| # | Scenario | Expected | Covered by |
|---|---|---|---|
| 1 | Create lost report | Firestore doc created | e2e, offline |
| 2 | Create matching found report | High score | `test:similarity`, e2e |
| 3 | Score ≥ threshold | Match created, reports `matched` | offline, e2e |
| 4 | Emails | Both people receive email | e2e + check inboxes |
| 5 | Low similarity | No match, no email | offline, e2e |
| 6 | AI API down | Report still saved, `matchProcessing=failed` | offline (unset `HUGGINGFACE_API_KEY` to try live) |
| 7 | Email API down | Match stored, `notifyStatus=failed`, resend button works | offline (unset `BREVO_API_KEY` to try live) |
| 8 | Mobile layout | Usable at 360 px | Browser dev tools → device toolbar, check every page |

## GitHub
```bash
git init
git add .
git status          # make sure .env is NOT listed
git commit -m "Lost & Found platform"
git branch -M main
git remote add origin https://github.com/<you>/lost-found-platform.git
git push -u origin main
```

## Vercel deployment
1. https://vercel.com → **Add New → Project → Import** your GitHub repo (framework: Vite is auto-detected).
2. **Settings → Environment Variables:** add every variable marked "Vercel" in the table above.
3. Deploy. Copy the production URL into `APP_URL` and redeploy.
4. Firebase console → Authentication → Settings → **Authorized domains** → add your `*.vercel.app` domain if sign-in complains about the domain.
5. Test production: register two accounts (two browsers), submit the sample lost and found reports from `scripts/sampleData.js`, confirm the match page and both emails.

## Common errors and fixes
| Symptom | Fix |
|---|---|
| `/api/...` returns 404 locally | You ran `npm run dev`. Use `vercel dev` |
| "Unable to connect to the database." | `FIREBASE_*` missing or wrong; re-check private key quoting and `\n` |
| 401 "Please log in first" | Token missing/expired; log out and in. Check API and web config are the same Firebase project |
| "AI matching is temporarily unavailable" | Bad/missing `HUGGINGFACE_API_KEY`, token lacks inference permission, or model cold start. Report is saved; use **Retry matching** |
| Match found but email failed | Sender not verified in Brevo, wrong `BREVO_API_KEY`, or daily limit reached. Use **Resend failed email** on the Matches page |
| Same-account reports never match | By design. Use two accounts, or set `ALLOW_SELF_MATCH=true` for demos |
| Scores are lower than expected | Add more detail to descriptions; lower threshold from the admin dashboard; run `test:similarity` |
| Photo upload fails | Storage not enabled / Blaze plan / rules not published. Set `VITE_ENABLE_IMAGE_UPLOAD=false` to hide it |
| Blank page after deploy | `VITE_*` variables missing at build time; add them and redeploy |

## Project limitations
- Semantic similarity does not guarantee that two items are the same. A high score is only a **potential match**; owners must verify.
- Image similarity is not implemented; the photo is supporting evidence only.
- Depends on external services (Hugging Face, Brevo, Firebase, Vercel); free tiers have usage limits and Brevo limits daily emails.
- Firestore has read/write quotas; each match run reads up to 200 reports.
- Serverless functions have execution time limits (set to 30 s here). Embedding up to 10 old reports in one run is capped for this reason.
- Browse shows the latest 200 reports; keyword search runs on that page of results, not on the full database.
- Admin is decided by email in an env var; there is no role-management UI.
- A matched person sees the other person's name and email (not phone) so they can arrange the return.

## Future enhancements
Image similarity · Geolocation-based matching · Push notifications · QR-based item recovery · Mobile app · Admin analytics · Fraud detection · Better ranking model · Multi-language descriptions · OCR for item labels · Campus-specific deployment
