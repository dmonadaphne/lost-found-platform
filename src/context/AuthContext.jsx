import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getSettings } from '../services/matchService';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    setIsAdmin(false);
    if (u) {
      try { setIsAdmin((await getSettings()).isAdmin); } catch { /* API offline: treat as normal user */ }
    }
    setLoading(false);
  }), []);

  return <AuthContext.Provider value={{ user, isAdmin, loading }}>{children}</AuthContext.Provider>;
}
