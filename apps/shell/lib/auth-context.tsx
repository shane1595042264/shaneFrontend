"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  type AuthUser,
  fetchCurrentUser,
  loginWithGoogle,
  setStoredToken,
  clearStoredToken,
} from "./auth-api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credential: string) => {
    const res = await loginWithGoogle(credential);
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
