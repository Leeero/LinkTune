import React, { createContext, useContext, useMemo, useState } from 'react';

import type { AuthCredentials, AuthState } from './types';
import { loadAuthFromStorage, saveAuthToStorage } from './storage';

type AuthApi = AuthState & {
  login: (credentials: AuthCredentials) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<AuthCredentials | null>(() => loadAuthFromStorage());

  const api = useMemo<AuthApi>(() => {
    const login = (c: AuthCredentials) => {
      setCredentials(c);
      saveAuthToStorage(c);
    };

    const logout = () => {
      setCredentials(null);
      saveAuthToStorage(null);
    };

    return {
      isAuthenticated: Boolean(credentials),
      credentials,
      login,
      logout,
    };
  }, [credentials]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
