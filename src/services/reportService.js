import { apiFetch } from './api';

export const submitReport = (report) => apiFetch('/api/reports', { method: 'POST', body: report });

export async function listReports(filters = {}, scope = 'public') {
  const params = new URLSearchParams({ scope });
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  return (await apiFetch(`/api/reports?${params}`)).data.reports;
}

export const setReportStatus = (id, status, matchId) =>
  apiFetch(`/api/reports/${id}/status`, { method: 'PATCH', body: { status, matchId } });

export const deleteReport = (id) => apiFetch(`/api/reports/${id}`, { method: 'DELETE' });
export const retryMatching = (reportId) => apiFetch('/api/match', { method: 'POST', body: { reportId } });
