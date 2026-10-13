import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser, authMessage } from '../firebase/auth';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Enter your name.');
    setBusy(true); setError('');
    try { await registerUser(form.name.trim(), form.email, form.password); navigate('/my-reports'); }
    catch (err) { setError(authMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="page narrow auth">
      <h1>Create an account</h1>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <form onSubmit={submit} className="form">
        <div className="field"><label htmlFor="name">Full name</label>
          <input id="name" name="name" required value={form.name} onChange={change} autoComplete="name" /></div>
        <div className="field"><label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required value={form.email} onChange={change} autoComplete="email" /></div>
        <div className="field"><label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" minLength={6} required value={form.password} onChange={change} autoComplete="new-password" />
          <small className="muted">At least 6 characters.</small></div>
        <button className="btn btn-dark btn-big" disabled={busy}>{busy ? 'Creating account...' : 'Register'}</button>
      </form>
      <p>Already registered? <Link to="/login">Log in</Link></p>
    </div>
  );
}
