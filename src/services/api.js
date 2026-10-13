// Every call to our Vercel serverless API goes through here. It attaches the Firebase
// ID token so the backend knows who is calling.
import { auth } from '../firebase/config';

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isNetwork = status === 0;
  }
}

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth.currentUser) headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;

  let response;
  try {
    response = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Network error. Check your connection and try again.', 0, 'NETWORK');
  }
  let json = null;
  try { json = await response.json(); } catch { /* not JSON */ }

  if (!response.ok || !json?.success) {
    throw new ApiError(json?.message || `The server returned an error (${response.status}).`, response.status, json?.error, json?.details);
  }
  return json; // { success, data, message }
}
