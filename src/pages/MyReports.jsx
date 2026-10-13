import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeToMyReports } from '../firebase/firestore';
import { setReportStatus, deleteReport, retryMatching } from '../services/reportService';
import ReportCard from '../components/ReportCard';
import Loading from '../components/Loading';

const TABS = [
  ['all', 'All', () => true],
  ['lost', 'Lost', (r) => r.type === 'lost'],
  ['found', 'Found', (r) => r.type === 'found'],
  ['matched', 'Matched', (r) => r.status === 'matched'],
  ['active', 'Pending', (r) => r.status === 'active'],
  ['returned', 'Returned', (r) => r.status === 'returned'],
];

export default function MyReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState(null);
  const [tab, setTab] = useState('all');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState('');

  // Real-time Firestore listener: the list updates by itself when a match is created.
  useEffect(() => subscribeToMyReports(user.uid, setReports,
    () => setMessage({ kind: 'error', text: 'Unable to connect to the database.' })), [user.uid]);

  async function act(id, fn, success) {
    setBusy(id); setMessage(null);
    try { const res = await fn(); setMessage({ kind: 'ok', text: success || res?.message || 'Done.' }); }
    catch (err) { setMessage({ kind: 'error', text: err.message }); }
    finally { setBusy(''); }
  }

  if (!reports) return <div className="page"><h1>My reports</h1>{message ? <div className="banner banner-error">{message.text}</div> : <Loading />}</div>;
  const filter = TABS.find((t) => t[0] === tab)[2];
  const shown = reports.filter(filter);

  return (
    <div className="page">
      <h1>My reports</h1>
      <div className="tabs" role="tablist">
        {TABS.map(([key, label, fn]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>
            {label} <span className="count">{reports.filter(fn).length}</span>
          </button>
        ))}
      </div>
      {message && <div className={`banner ${message.kind === 'ok' ? 'banner-ok' : 'banner-error'}`} role="status">{message.text}</div>}
      {shown.length === 0 && <p className="empty">Nothing here yet. <Link to="/report/lost">Report a lost item</Link> or <Link to="/report/found">a found item</Link>.</p>}
      <div className="cards">
        {shown.map((r) => (
          <ReportCard key={r.id} report={r}>
            {r.matchProcessing === 'failed' && r.status === 'active' && (
              <button className="btn btn-small btn-dark" disabled={busy === r.id}
                onClick={() => act(r.id, () => retryMatching(r.id))}>Retry matching</button>
            )}
            {r.status === 'matched' && <Link className="btn btn-small" to="/matches">See match</Link>}
            {r.status !== 'returned' && (
              <button className="btn btn-small" disabled={busy === r.id}
                onClick={() => act(r.id, () => setReportStatus(r.id, 'returned'))}>Mark returned</button>
            )}
            <button className="btn btn-small btn-quiet" disabled={busy === r.id}
              onClick={() => window.confirm('Delete this report?') && act(r.id, () => deleteReport(r.id), 'Report deleted.')}>Delete</button>
          </ReportCard>
        ))}
      </div>
    </div>
  );
}
