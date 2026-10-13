// Small helpers shared by every serverless function (consistent JSON + auth).
import { adminAuth } from './firebaseAdmin.js';
import { isAdminEmail } from './config.js';

export class HttpError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const ok = (res, data = {}, message = '', status = 200) =>
  res.status(status).json({ success: true, data, message });

export const fail = (res, status, error, message, details) =>
  res.status(status).json({ success: false, error, message, ...(details ? { details } : {}) });

// Wrap a map like { GET: fn, POST: fn } into a Vercel handler with error handling.
export function route(methods) {
  return async function handler(req, res) {
    const fn = methods[req.method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(methods).join(', '));
      return fail(res, 405, 'METHOD_NOT_ALLOWED', `Use ${Object.keys(methods).join(' or ')} for this endpoint.`);
    }
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) return fail(res, err.status, err.code, err.message, err.details);
      console.error('Unhandled API error:', err);
      const dbDown = err.code === 14 || String(err.message).startsWith('Firebase Admin');
      return fail(res, 500, 'SERVER_ERROR',
        dbDown ? 'Unable to connect to the database.' : 'Something went wrong on the server. Please try again.');
    }
  };
}

// Verifies the Firebase ID token sent by the React app in "Authorization: Bearer <token>".
export async function requireUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Please log in first.', 'UNAUTHENTICATED');
  try {
    const decoded = await adminAuth().verifyIdToken(header.slice(7));
    return { uid: decoded.uid, email: decoded.email || '', name: decoded.name || '', isAdmin: isAdminEmail(decoded.email) };
  } catch (err) {
    if (String(err.message).startsWith('Firebase Admin')) throw err;
    throw new HttpError(401, 'Your session has expired. Please log in again.', 'UNAUTHENTICATED');
  }
}

// Same as requireUser but returns null for anonymous visitors (used by public endpoints).
export async function optionalUser(req) {
  if (!(req.headers.authorization || '').startsWith('Bearer ')) return null;
  try { return await requireUser(req); } catch { return null; }
}

export function requireAdmin(user) {
  if (!user.isAdmin) throw new HttpError(403, 'Admin access required.', 'FORBIDDEN');
}
