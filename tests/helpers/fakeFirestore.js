// A tiny in-memory stand-in for the Firestore Admin SDK (only the calls our code uses),
// so the matching flow can be tested offline.
let counter = 0;
const withCode = (code) => Object.assign(new Error(`firestore error ${code}`), { code });

export function createFakeFirestore() {
  const store = new Map();

  const docRef = (path) => ({
    id: path.split('/')[1], path,
    async get() { const d = store.get(path); return { exists: !!d, id: path.split('/')[1], data: () => (d ? { ...d } : undefined) }; },
    async set(data) { store.set(path, { ...data }); },
    async create(data) { if (store.has(path)) throw withCode(6); store.set(path, { ...data }); },
    async update(patch) { if (!store.has(path)) throw withCode(5); store.set(path, { ...store.get(path), ...patch }); },
    async delete() { store.delete(path); },
  });

  const query = (col, filters = [], max = Infinity) => ({
    where: (field, _op, value) => query(col, [...filters, [field, value]], max),
    limit: (n) => query(col, filters, n),
    orderBy: () => query(col, filters, max),
    async get() {
      const docs = [...store.entries()]
        .filter(([p, d]) => p.startsWith(`${col}/`) && filters.every(([f, v]) => d[f] === v))
        .slice(0, max)
        .map(([p, d]) => ({ id: p.split('/')[1], data: () => ({ ...d }) }));
      return { docs };
    },
  });

  return {
    store,
    collection: (col) => ({ doc: (id = `auto${++counter}`) => docRef(`${col}/${id}`), ...query(col) }),
    doc: (path) => docRef(path),
    batch() {
      const ops = [];
      return { update: (ref, patch) => ops.push(() => ref.update(patch)), async commit() { for (const op of ops) await op(); } };
    },
  };
}
