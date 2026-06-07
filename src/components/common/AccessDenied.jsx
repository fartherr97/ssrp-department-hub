import { ShieldAlert } from "lucide-react";
import { Panel } from "./index.jsx";

export default function AccessDenied({ page }) {
  return (
    <Panel className="mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
        <ShieldAlert size={26} />
      </div>
      <h1 className="text-xl font-bold text-white">Access denied</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        You don't have permission to view
        {page?.label ? ` "${page.label}"` : " this page"}. If you believe this is
        a mistake, contact a department administrator.
      </p>
    </Panel>
  );
}
