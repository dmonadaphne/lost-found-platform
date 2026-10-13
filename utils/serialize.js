// Decides what each kind of viewer is allowed to see.
// PUBLIC view: no email, phone, userId, embedding, identifying features
// (identifying features are what a real owner uses to prove the item is theirs).

export const toIso = (t) => (t && typeof t.toDate === 'function' ? t.toDate().toISOString() : t || null);

export function publicReport(r) {
  return {
    id: r.id, type: r.type, itemName: r.itemName, category: r.category,
    description: r.description, location: r.location, date: r.date, time: r.time || '',
    color: r.color || '', brand: r.brand || '', imageUrl: r.imageUrl || null,
    status: r.status, createdAt: toIso(r.createdAt),
  };
}

// For the owner and admins: everything except the (large) embedding vector.
export function ownReport(r) {
  const { embedding, ...rest } = r;
  return { ...rest, createdAt: toIso(r.createdAt), updatedAt: toIso(r.updatedAt), hasEmbedding: Array.isArray(embedding) };
}

export function serializeMatch(m) {
  return {
    id: m.id, lostReportId: m.lostReportId, foundReportId: m.foundReportId,
    lostItemName: m.lostItemName, foundItemName: m.foundItemName,
    lostLocation: m.lostLocation, foundLocation: m.foundLocation,
    similarityScore: m.similarityScore, threshold: m.threshold,
    status: m.status, explanation: m.explanation || '',
    notifyStatus: m.notifyStatus || { lost: 'pending', found: 'pending' },
    createdAt: toIso(m.createdAt),
  };
}
