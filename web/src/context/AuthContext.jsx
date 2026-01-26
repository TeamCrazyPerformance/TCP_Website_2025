import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

function readStoredAuth() {
  if (typeof window === 'undefined') {
    return { user: null, accessToken: null, isAuthenticated: false };
  }

  const accessToken = localStorage.getItem('access_token');
  const storedUser = localStorage.getItem('auth_user');
  let user = null;

  if (storedUser) {
    try {
      user = JSON.parse(storedUser);
    } catch (error) {
      user = null;
    }
  }

  return {
    user,
    accessToken,
    isAuthenticated: Boolean(accessToken),
  };
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => readStoredAuth());

  const syncFromStorage = useCallback(() => {
    setAuth(readStoredAuth());
  }, []);

  const login = useCallback((user, accessToken, keepLoggedIn = false) => {
    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
    }
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    }
    if (keepLoggedIn) {
      localStorage.setItem('keep_logged_in', 'true');
    } else {
      localStorage.removeItem('keep_logged_in');
    }

    setAuth({
      user: user ?? null,
      accessToken: accessToken ?? null,
      isAuthenticated: Boolean(accessToken),
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('keep_logged_in');
    setAuth({ user: null, accessToken: null, isAuthenticated: false });
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (!event.key) return;
      if (['access_token', 'auth_user', 'keep_logged_in'].includes(event.key)) {
        syncFromStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [syncFromStorage]);

  const value = {
    ...auth,
    login,
    logout,
    syncFromStorage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
