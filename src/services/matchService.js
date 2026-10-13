import { apiFetch } from './api';

export async function listMatches(scope = 'mine') {
  return (await apiFetch(`/api/matches?scope=${scope}`)).data.matches;
}
export const updateMatch = (id, action) => apiFetch('/api/matches', { method: 'PATCH', body: { id, action } });
export const resendEmails = (matchId) => apiFetch('/api/email', { method: 'POST', body: { matchId } });
export async function getSettings() { return (await apiFetch('/api/settings')).data; }
export const saveThreshold = (threshold) => apiFetch('/api/settings', { method: 'PUT', body: { threshold } });
export async function getStats() { return (await apiFetch('/api/stats')).data; }
