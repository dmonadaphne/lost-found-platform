import { useEffect, useState, useCallback } from 'react';
import { listReports } from '../services/reportService';
import { CATEGORIES } from '../../utils/validation.js';
import ReportCard from '../components/ReportCard';
import Loading from '../components/Loading';

const EMPTY = { type: '', category: '', status: '', search: '', location: '', date: '' };

export default function BrowseReports() {
  const [filters, setFilters] = useState(EMPTY);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (f) => {
    setLoading(true); setError('');
    try { setReports(await listReports(f)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(EMPTY); }, [load]);

  const change = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const submit = (e) => { e.preventDefault(); load(filters); };
  const reset = () => { setFilters(EMPTY); load(EMPTY); };

  return (
    <div className="page">
      <h1>Browse reports</h1>
      <p className="lead">Contact details are never shown here. If something looks like yours, report it and the matching system will connect you.</p>

      <form className="filters" onSubmit={submit}>
        <input name="search" placeholder="Search name, description or location" value={filters.search} onChange={change} aria-label="Keyword" />
        <select name="type" value={filters.type} onChange={change} aria-label="Lost or found">
          <option value="">Lost and found</option><option value="lost">Lost</option><option value="found">Found</option>
        </select>
        <select name="category" value={filters.category} onChange={change} aria-label="Category">
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select name="status" value={filters.status} onChange={change} aria-label="Status">
          <option value="">Any status</option><option value="active">Searching</option><option value="matched">Match found</option><option value="returned">Returned</option>
        </select>
        <input name="location" placeholder="Location" value={filters.location} onChange={change} aria-label="Location" />
        <input type="date" name="date" value={filters.date} onChange={change} aria-label="On or after date" title="On or after this date" />
        <button className="btn btn-dark">Search</button>
        <button type="button" className="btn btn-quiet" onClick={reset}>Clear</button>
      </form>

      {loading && <Loading label="Loading reports..." />}
      {error && <div className="banner banner-error" role="alert">{error} <button className="btn btn-small" onClick={() => load(filters)}>Retry</button></div>}
      {!loading && !error && reports.length === 0 && <p className="empty">No reports match these filters. Try clearing them, or report your own item.</p>}
      <div className="cards">{reports.map((r) => <ReportCard key={r.id} report={r} />)}</div>
    </div>
  );
}
