import { useEffect, useState, useCallback } from 'react';
import { getStats, getSettings, saveThreshold, listMatches, updateMatch } from '../services/matchService';
import { listReports, setReportStatus, deleteReport } from '../services/reportService';
import Loading from '../components/Loading';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [matches, setMatches] = useState([]);
  const [threshold, setThreshold] = useState('0.75');
  const [tab, setTab] = useState('reports');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, r, m, cfg] = await Promise.all([getStats(), listReports({}, 'admin'), listMatches('admin'), getSettings()]);
      setStats(s); setReports(r); setMatches(m); setThreshold(String(cfg.threshold));
    } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(fn, success) {
    setMessage(null);
    try { await fn(); setMessage({ kind: 'ok', text: success }); await load(); }
    catch (err) { setMessage({ kind: 'error', text: err.message }); }
  }

  if (error) return <div className="page"><h1>Admin dashboard</h1><div className="banner banner-error" role="alert">{error} <button className="btn btn-small" onClick={load}>Retry</button></div></div>;
  if (!stats) return <div className="page"><h1>Admin dashboard</h1><Loading /></div>;

  const cards = [
    ['Lost reports', stats.lost], ['Found reports', stats.found], ['Matches', stats.matches],
    ['Pending reports', stats.pending], ['Items returned', stats.returnedItems],
  ];

  return (
    <div className="page">
      <h1>Admin dashboard</h1>
      <div className="stat-grid">{cards.map(([label, n]) => <div className="stat" key={label}><strong>{n}</strong><span>{label}</span></div>)}</div>

      <form className="threshold" onSubmit={(e) => { e.preventDefault(); run(() => saveThreshold(Number(threshold)), 'Threshold updated.'); }}>
        <label htmlFor="threshold">Similarity threshold</label>
        <input id="threshold" type="number" min="0" max="1" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        <button className="btn btn-dark btn-small">Save threshold</button>
        <small className="muted">0.75 means 75% similar. Applies to new reports only.</small>
      </form>

      {message && <div className={`banner banner-${message.kind}`} role="status">{message.text}</div>}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'reports'} className={tab === 'reports' ? 'tab active' : 'tab'} onClick={() => setTab('reports')}>Reports <span className="count">{reports.length}</span></button>
        <button role="tab" aria-selected={tab === 'matches'} className={tab === 'matches' ? 'tab active' : 'tab'} onClick={() => setTab('matches')}>Matches <span className="count">{matches.length}</span></button>
      </div>

      <div className="table-wrap">
        {tab === 'reports' ? (
          <table>
            <thead><tr><th>Type</th><th>Item</th><th>Reporter</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.type}</td>
                  <td><strong>{r.itemName}</strong><br /><span className="muted">{r.location}, {r.date}</span></td>
                  <td>{r.userName}<br /><span className="muted">{r.userEmail}{r.userPhone ? `, ${r.userPhone}` : ''}</span></td>
                  <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                  <td className="actions">
                    {r.status !== 'returned' && <button className="btn btn-small" onClick={() => run(() => setReportStatus(r.id, 'returned'), 'Marked as returned.')}>Mark returned</button>}
                    <button className="btn btn-small btn-quiet" onClick={() => window.confirm(`Delete "${r.itemName}"?`) && run(() => deleteReport(r.id), 'Report deleted.')}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead><tr><th>Lost</th><th>Found</th><th>Score</th><th>Status</th><th>Emails</th><th>Actions</th></tr></thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id}>
                  <td>{m.lostItemName}<br /><span className="muted">{m.lostParty?.email}</span></td>
                  <td>{m.foundItemName}<br /><span className="muted">{m.foundParty?.email}</span></td>
                  <td>{(m.similarityScore * 100).toFixed(1)}%</td>
                  <td><span className={`pill pill-${m.status}`}>{m.status}</span></td>
                  <td>{m.notifyStatus?.lost} / {m.notifyStatus?.found}</td>
                  <td className="actions">
                    {['potential', 'confirmed'].includes(m.status) && <button className="btn btn-small" onClick={() => run(() => updateMatch(m.id, 'returned'), 'Match marked as returned.')}>Mark returned</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
