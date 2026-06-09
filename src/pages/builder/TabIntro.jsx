import { Lightbulb } from "lucide-react";

/*
 * A friendly plain-language explainer shown at the top of each Builder tab,
 * so people with no technical background know what the tab controls and
 * where their changes will show up.
 */
export default function TabIntro({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-border-strong)]/40 bg-[color:var(--color-primary)]/8 p-4">
      <Lightbulb size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
      <p className="text-sm leading-relaxed text-slate-300">{children}</p>
    </div>
  );
}
