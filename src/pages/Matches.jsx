import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listMatches, updateMatch, resendEmails } from '../services/matchService';
import MatchCard from '../components/MatchCard';
import Loading from '../components/Loading';

export default function Matches() {
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setMatches(await listMatches('mine')); }
    catch (err) { setError(err.message); setMatches([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id, fn, ok) {
    setBusy(id); setMessage(null);
    try { const res = await fn(); setMessage({ kind: res?.message?.startsWith('Match found, but') ? 'warn' : 'ok', text: res?.message || ok }); await load(); }
    catch (err) { setMessage({ kind: 'error', text: err.message }); }
    finally { setBusy(''); }
  }

  if (!matches) return <div className="page"><h1>Match results</h1><Loading label="Loading matches..." /></div>;
  const failed = (m) => Object.values(m.notifyStatus || {}).includes('failed');

  return (
    <div className="page narrow">
      <h1>Match results</h1>
      <p className="lead">A high score means the descriptions are alike. It does not prove the item is yours, so check ownership before handing anything over.</p>
      {error && <div className="banner banner-error" role="alert">{error} <button className="btn btn-small" onClick={load}>Retry</button></div>}
      {message && <div className={`banner banner-${message.kind}`} role="status">{message.text}</div>}
      {!error && matches.length === 0 && <p className="empty">No matches yet. Your reports are compared with every new report, so check back later. <Link to="/my-reports">My reports</Link></p>}
      {matches.map((m) => (
        <MatchCard key={m.id} match={m}>
          {['potential', 'confirmed'].includes(m.status) && (
            <>
              {m.status === 'potential' && <button className="btn btn-small btn-dark" disabled={busy === m.id} onClick={() => act(m.id, () => updateMatch(m.id, 'confirm'), 'Match confirmed.')}>This is a match</button>}
              <button className="btn btn-small" disabled={busy === m.id} onClick={() => act(m.id, () => updateMatch(m.id, 'returned'), 'Marked as returned.')}>Mark returned</button>
              <button className="btn btn-small btn-quiet" disabled={busy === m.id} onClick={() => act(m.id, () => updateMatch(m.id, 'reject'), 'Match rejected. Your report is searching again.')}>Not a match</button>
            </>
          )}
          {failed(m) && <button className="btn btn-small" disabled={busy === m.id} onClick={() => act(m.id, () => resendEmails(m.id), 'Notifications sent.')}>Resend failed email</button>}
        </MatchCard>
      ))}
    </div>
  );
}
