import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase/auth';

export default function Navbar() {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const close = () => setOpen(false);

  async function handleLogout() {
    await logoutUser();
    close();
    navigate('/');
  }

  return (
    <header className="nav">
      <Link to="/" className="brand" onClick={close}>
        <span className="brand-mark" aria-hidden="true" />
        Lost &amp; Found
      </Link>
      <button className="nav-toggle" aria-expanded={open} aria-label="Toggle menu" onClick={() => setOpen(!open)}>
        Menu
      </button>
      <nav className={`nav-links ${open ? 'open' : ''}`} onClick={close}>
        <NavLink to="/browse">Browse</NavLink>
        <NavLink to="/report/lost">Report lost</NavLink>
        <NavLink to="/report/found">Report found</NavLink>
        {user && <NavLink to="/my-reports">My reports</NavLink>}
        {user && <NavLink to="/matches">Matches</NavLink>}
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        {user ? (
          <button className="btn btn-quiet" onClick={handleLogout}>Log out</button>
        ) : (
          <>
            <NavLink to="/login">Log in</NavLink>
            <Link className="btn btn-dark btn-small" to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
