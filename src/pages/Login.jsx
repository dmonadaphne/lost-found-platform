import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginUser, authMessage } from '../firebase/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const from = useLocation().state?.from || '/my-reports';

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await loginUser(email, password); navigate(from, { replace: true }); }
    catch (err) { setError(authMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="page narrow auth">
      <h1>Log in</h1>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <form onSubmit={submit} className="form">
        <div className="field"><label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
        <div className="field"><label htmlFor="password">Password</label>
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
        <button className="btn btn-dark btn-big" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p>New here? <Link to="/register">Create an account</Link></p>
    </div>
  );
}
