import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type User = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  is_premium: boolean;
  free_reading_used: boolean;
};

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  setGoogleSession: (sessionId: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

const TOKEN_KEY = "auth_token_v1";

export const apiFetch = async (token: string | null, path: string, init: RequestInit = {}) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    const err: any = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persistToken = async (t: string | null) => {
    if (Platform.OS === "web") {
      if (t) await storage.setItem(TOKEN_KEY, t);
      else await storage.removeItem(TOKEN_KEY);
    } else {
      if (t) await storage.secureSet(TOKEN_KEY, t);
      else await storage.secureRemove(TOKEN_KEY);
    }
  };

  const readToken = async (): Promise<string | null> => {
    if (Platform.OS === "web") return await storage.getItem(TOKEN_KEY, "" as string);
    return await storage.secureGet(TOKEN_KEY, "" as string);
  };

  const refresh = useCallback(async () => {
    const t = token || (await readToken());
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch(t, "/auth/me");
      setUser(data.user);
      setToken(t);
    } catch (e: any) {
      if (e.status === 401) {
        await persistToken(null);
        setUser(null);
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      const t = await readToken();
      if (t) {
        setToken(t);
        try {
          const data = await apiFetch(t, "/auth/me");
          setUser(data.user);
        } catch {
          await persistToken(null);
          setToken(null);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signup = async (email: string, password: string, name?: string) => {
    const data = await apiFetch(null, "/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    await persistToken(data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const login = async (email: string, password: string) => {
    const data = await apiFetch(null, "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await persistToken(data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const setGoogleSession = async (sessionId: string) => {
    const data = await apiFetch(null, "/auth/google/session", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
    await persistToken(data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      if (token) await apiFetch(token, "/auth/logout", { method: "POST" });
    } catch {}
    await persistToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, token, loading, signup, login, setGoogleSession, refresh, logout }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};
