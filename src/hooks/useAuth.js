import { useEffect, useState } from "react";
import * as api from "../lib/api.js";

/*
 * Auth hook. On mount it asks the data layer for the current session.
 *  - With the mock backend, that's whatever the dev-login wrote to storage.
 *  - With the real backend, that's GET /auth/me (Discord session cookie).
 * Exposes devLogin/logout that delegate to the same data layer.
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

  async function devLogin(group) {
    const u = await api.devLogin(group);
    setUser(u);
    return u;
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return { user, checking, setUser, devLogin, logout };
}
