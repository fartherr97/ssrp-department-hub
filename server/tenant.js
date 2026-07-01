/*
 * Multi-tenancy by hostname. One deployment + one database serves every
 * department; which department a request belongs to is decided from the Host
 * header, e.g.
 *
 *   fhp.ssrp.gg  → department "fhp"
 *   tpd.ssrp.gg  → department "tpd"
 *
 * Each department's config + audit log are separate rows keyed by this id (the
 * DB schema already keys on department_id). The front-end needs no changes:
 * every site simply asks for /api/config and the server returns the right one.
 *
 * Resolution order:
 *   1. explicit DEPARTMENT_MAP entry for the host  (e.g. "fhp.ssrp.gg=fhp")
 *   2. the first DNS label of a real subdomain      (fhp.ssrp.gg → "fhp")
 *   3. the DEPARTMENT_ID fallback                    (single-tenant / Railway URL)
 */
import { env } from "./env.js";

// Hosts that should NOT be treated as a department subdomain — they fall back to
// the default department id instead.
function isInfraHost(name) {
  return (
    name === "localhost" ||
    /^[0-9.]+$/.test(name) || // bare IPv4
    name.startsWith("[") || // IPv6 literal
    name.endsWith(".railway.app") || // Railway's own *.up.railway.app domain
    name.endsWith(".up.railway.app")
  );
}

export function departmentFromHost(host) {
  if (!host) return null;
  const name = String(host).split(":")[0].toLowerCase().trim();
  if (!name) return null;

  // 1. explicit mapping wins (handles apex domains, custom domains, etc.)
  if (env.departmentMap[name]) return env.departmentMap[name];

  if (isInfraHost(name)) return null;

  // 2. real subdomain → first label (fhp.ssrp.gg → "fhp"); apex like ssrp.gg
  //    (2 labels) has no department subdomain, so fall through to the default.
  const labels = name.split(".");
  if (labels.length >= 3 && labels[0] && labels[0] !== "www") return labels[0];

  return null;
}

// The department id for a given request (always returns something usable).
export function resolveDepartmentId(req) {
  return departmentFromHost(req?.headers?.host) || env.departmentId;
}

// Department ids key DB rows and are echoed into audit entries, so a
// body-supplied one (bot endpoints let the caller name the department) must be a
// tightly bounded slug. Returns the id if valid, else null. Callers should fall
// back to resolveDepartmentId(req) when this returns null.
const DEPARTMENT_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export function validDepartmentId(id) {
  return typeof id === "string" && DEPARTMENT_ID_RE.test(id) ? id : null;
}

// Express middleware: stamp req.departmentId for downstream handlers.
export function tenantMiddleware(req, _res, next) {
  req.departmentId = resolveDepartmentId(req);
  next();
}
