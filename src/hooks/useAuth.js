import { useEffect, useState } from "react";
import * as api from "../lib/api.js";

/*
 * Auth hook. On mount it asks the data layer for the current session
 * (GET /auth/me — the Discord session cookie). Exposes logout, which delegates
 * to the same data layer.
 */
export default function useAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .getSession()
      .then((u) => alive && setUser(u || null))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return { user, checking, setUser, logout };
}
