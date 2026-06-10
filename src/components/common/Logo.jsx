import { initials } from "../../lib/user.js";

/*
 * Department logo. Renders the configured logo image if present, otherwise a
 * themed monogram built from the department's short name, so a brand-new hub
 * still looks intentional before anyone uploads a logo.
 */
export default function Logo({ branding, size = 40, className = "" }) {
  const px = `${size}px`;
  if (branding?.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding?.name || "Logo"}
        style={{ width: px, height: px }}
        className={`rounded-xl object-contain ${className}`}
      />
    );
  }
  return (
    <div
      style={{ width: px, height: px, fontSize: size * 0.36 }}
      className={`flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--color-primary),var(--color-hover))] font-black text-white ${className}`}
    >
      {initials(branding?.shortName || branding?.name || "DH")}
    </div>
  );
}
