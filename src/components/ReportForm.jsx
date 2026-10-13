// One form for BOTH lost and found reports (the `type` prop switches labels).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, validateReportInput } from '../../utils/validation.js';
import { submitReport } from '../services/reportService';
import { uploadReportImage, imageUploadEnabled } from '../firebase/storage';
import MatchCard from './MatchCard';

// The backend does all of this in ONE request; these messages just show the steps it performs.
const STAGES = ['Analyzing your report...', 'Saving report...', 'Finding potential matches...',
  'Calculating similarity...', 'Checking for matches...', 'Sending notifications...'];

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// Defined OUTSIDE ReportForm so React keeps the same input mounted while typing.
function Field({ name, label, required, hint, children, form, errors, change }) {
  return (
    <div className={`field ${errors[name] ? 'has-error' : ''}`}>
      <label htmlFor={name}>{label}{required && <span className="req"> (required)</span>}</label>
      {children || <input id={name} name={name} value={form[name]} onChange={change} aria-invalid={!!errors[name]} />}
      {hint && <small className="muted">{hint}</small>}
      {errors[name] && <small className="error" role="alert">{errors[name]}</small>}
    </div>
  );
}

export default function ReportForm({ type }) {
  const { user } = useAuth();
  const isLost = type === 'lost';
  const [form, setForm] = useState({
    itemName: '', category: '', description: '', location: '', date: today(), time: '',
    color: '', brand: '', identifyingFeatures: '', userName: user?.displayName || '',
    userEmail: user?.email || '', userPhone: '', additionalInfo: '',
  });
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState(0);
  const [failure, setFailure] = useState(null);
  const [result, setResult] = useState(null);
  const topRef = useRef(null);

  // Rotate the progress message while the request is running.
  useEffect(() => {
    if (!submitting) return undefined;
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1400);
    return () => clearInterval(timer);
  }, [submitting]);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e?.preventDefault();
    setFailure(null);
    const { valid, errors: found } = validateReportInput({ ...form, type });
    setErrors(found);
    if (!valid) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    setSubmitting(true);
    setStage(0);
    try {
      let imageUrl = null;
      if (image) {
        try { imageUrl = await uploadReportImage(image, user.uid); }
        catch (err) { setFailure(`Photo upload failed (${err.message}). Remove the photo or retry.`); setSubmitting(false); return; }
      }
      const response = await submitReport({ ...form, type, imageUrl });
      setResult(response);
    } catch (err) {
      if (err.status === 400 && err.details) setErrors(err.details);
      setFailure(err.message);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const { data, message } = result;
    return (
      <div className="page narrow" ref={topRef}>
        <h1>{data.matchFound ? 'Potential match found' : 'Report submitted successfully'}</h1>
        <div className={`banner ${data.matchProcessing === 'failed' || data.emailFailed ? 'banner-warn' : 'banner-ok'}`} role="status">{message}</div>
        <p>Your report ID: <code className="code">{data.reportId}</code></p>
        {data.matches.map((m) => <MatchCard key={m.id} match={m} banner />)}
        {!data.matchFound && data.matchProcessing === 'done' && (
          <p>No item is similar enough yet{data.similarityScore != null ? ` (best score ${(data.similarityScore * 100).toFixed(1)}%, needed ${(data.threshold * 100).toFixed(0)}%)` : ''}.
            Your report stays active and is compared with every new {isLost ? 'found' : 'lost'} report.</p>
        )}
        {data.matchProcessing === 'failed' && (
          <p>You can retry matching from <Link to="/my-reports">My reports</Link> once the AI service is back.</p>
        )}
        <div className="row">
          <Link className="btn btn-dark" to="/matches">View my matches</Link>
          <Link className="btn" to="/my-reports">My reports</Link>
          <button className="btn btn-quiet" onClick={() => window.location.reload()}>Report another item</button>
        </div>
      </div>
    );
  }

  const p = { form, errors, change }; // shared props for every <Field>

  return (
    <div className="page narrow" ref={topRef}>
      <h1>{isLost ? 'Report a lost item' : 'Report a found item'}</h1>
      <p className="lead">
        {isLost ? 'Describe what you lost. We compare it with every item that has been handed in, now and later.'
          : 'Describe what you found. We compare it with every lost report, now and later.'}
      </p>

      {failure && (
        <div className="banner banner-error" role="alert">
          {failure} <button className="btn btn-small" onClick={handleSubmit}>Retry</button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="form">
        <fieldset disabled={submitting}>
          <legend>The item</legend>
          <Field {...p} name="itemName" label="Item name" required />
          <Field {...p} name="category" label="Category" required>
            <select id="category" name="category" value={form.category} onChange={change} aria-invalid={!!errors.category}>
              <option value="">Choose a category</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field {...p} name="description" label="Description" required hint="Colour, size, condition, accessories. The AI reads this, so more detail gives better matches.">
            <textarea id="description" name="description" rows="4" value={form.description} onChange={change} aria-invalid={!!errors.description} />
          </Field>
          <div className="grid-2">
            <Field {...p} name="color" label="Color" />
            <Field {...p} name="brand" label="Brand" />
          </div>
          <Field {...p} name="identifyingFeatures" label="Identifying features" hint="Scratches, stickers, engravings. Only you and the matched person see these.">
            <textarea id="identifyingFeatures" name="identifyingFeatures" rows="2" value={form.identifyingFeatures} onChange={change} />
          </Field>
          {imageUploadEnabled && (
            <Field {...p} name="image" label="Photo (optional)" hint="Photos are supporting evidence only. Matching uses the text.">
              <input id="image" type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0] || null)} />
            </Field>
          )}
        </fieldset>

        <fieldset disabled={submitting}>
          <legend>{isLost ? 'Where and when you lost it' : 'Where and when you found it'}</legend>
          <Field {...p} name="location" label={isLost ? 'Location where it was lost' : 'Location where it was found'} required />
          <div className="grid-2">
            <Field {...p} name="date" label={isLost ? 'Date lost' : 'Date found'} required>
              <input id="date" type="date" name="date" max={today()} value={form.date} onChange={change} aria-invalid={!!errors.date} />
            </Field>
            <Field {...p} name="time" label="Approximate time">
              <input id="time" type="time" name="time" value={form.time} onChange={change} />
            </Field>
          </div>
        </fieldset>

        <fieldset disabled={submitting}>
          <legend>{isLost ? 'Owner contact' : 'Finder contact'}</legend>
          <p className="muted">Never shown publicly. Only used to email you when a match is found.</p>
          <Field {...p} name="userName" label={isLost ? 'Owner name' : 'Finder name'} required />
          <div className="grid-2">
            <Field {...p} name="userEmail" label={isLost ? 'Owner email' : 'Finder email'} required>
              <input id="userEmail" type="email" name="userEmail" value={form.userEmail} onChange={change} aria-invalid={!!errors.userEmail} />
            </Field>
            <Field {...p} name="userPhone" label="Phone">
              <input id="userPhone" type="tel" name="userPhone" value={form.userPhone} onChange={change} aria-invalid={!!errors.userPhone} />
            </Field>
          </div>
          <Field {...p} name="additionalInfo" label="Additional information">
            <textarea id="additionalInfo" name="additionalInfo" rows="2" value={form.additionalInfo} onChange={change} />
          </Field>
        </fieldset>

        <button className={`btn btn-big ${isLost ? 'btn-lost' : 'btn-found'}`} type="submit" disabled={submitting}>
          {submitting ? STAGES[stage] : isLost ? 'Report Lost Item' : 'Report Found Item'}
        </button>
        {submitting && <p className="muted" role="status">This usually takes a few seconds.</p>}
      </form>
    </div>
  );
}
