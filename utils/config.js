// The ONE place that knows how the similarity threshold is decided.
// Priority: value saved by an admin in Firestore (settings/config) > SIMILARITY_THRESHOLD env var > 0.75
export const DEFAULT_THRESHOLD = 0.75;

export function envThreshold() {
  const value = parseFloat(process.env.SIMILARITY_THRESHOLD);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_THRESHOLD;
}

export async function getThreshold(firestore) {
  try {
    const snap = await firestore.doc('settings/config').get();
    const saved = snap.exists ? snap.data().threshold : undefined;
    if (typeof saved === 'number' && saved >= 0 && saved <= 1) return saved;
  } catch (err) {
    console.error('Could not read threshold from Firestore, using env value:', err.message);
  }
  return envThreshold();
}

export function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}
