import { useEffect } from "react";
import { X } from "lucide-react";

// ─── Surfaces ────────────────────────────────────────────────────────────────

export function Panel({ className = "", children, ...rest }) {
  return (
    <div className={`hub-panel rounded-2xl ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Kicker({ children }) {
  return <div className="hub-kicker">{children}</div>;
}

export function PageHeader({ kicker, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker && <Kicker>{kicker}</Kicker>}
        <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

const buttonVariants = {
  primary:
    "bg-[linear-gradient(90deg,var(--color-primary),var(--color-hover))] text-white shadow-lg shadow-black/20 hover:scale-[1.015]",
  secondary:
    "border border-white/10 bg-[var(--color-surface-2)] text-slate-200 hover:border-[color:var(--color-border)] hover:text-white",
  ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
  danger:
    "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200",
};

export function Button({
  variant = "primary",
  className = "",
  icon: Icon,
  children,
  ...rest
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={16} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className = "", ...rest }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[var(--color-surface-2)] text-slate-300 transition hover:border-[color:var(--color-border)] hover:text-white ${className}`}
      {...rest}
    >
      <Icon size={16} strokeWidth={2.3} />
    </button>
  );
}

// ─── Form fields ─────────────────────────────────────────────────────────────

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[color:var(--color-border-strong)] focus:ring-2 focus:ring-[color:var(--color-primary)]/30";

export function Input({ className = "", ...rest }) {
  return <input className={`${inputClass} ${className}`} {...rest} />;
}

export function Textarea({ className = "", rows = 4, ...rest }) {
  return <textarea rows={rows} className={`${inputClass} resize-y ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }) {
  return (
    <select className={`${inputClass} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function ColorInput({ value, onChange, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
      />
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
      />
    </div>
  );
}

// ─── Badges / stats ──────────────────────────────────────────────────────────

export function Badge({ children, color, className = "" }) {
  const style = color
    ? { backgroundColor: `${color}1f`, color, borderColor: `${color}55` }
    : undefined;
  return (
    <span
      style={style}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        color ? "" : "border-slate-500/30 bg-slate-500/15 text-slate-300"
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, icon: Icon }) {
  return (
    <Panel className="flex items-center gap-3 p-4">
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/12 text-[var(--color-primary)]">
          <Icon size={18} />
        </div>
      )}
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-2xl font-black text-white">{value}</div>
      </div>
    </Panel>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      {Icon && <Icon size={32} className="mb-3 text-slate-500" />}
      <div className="text-base font-semibold text-slate-200">{title}</div>
      {subtitle && <div className="mt-1 max-w-sm text-sm text-slate-500">{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="animate-modalFade fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`animate-modalPop hub-panel relative z-10 w-full ${widths[size]} rounded-2xl`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-300">{message}</p>
    </Modal>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export function Toast({ message }) {
  if (!message) return null;
  const isSuccess = message.type !== "error";
  return (
    <div
      className={`animate-pageFade fixed left-1/2 top-6 z-[120] -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-bold shadow-xl backdrop-blur ${
        isSuccess
          ? "border-green-400/30 bg-green-400/10 text-green-300"
          : "border-red-400/30 bg-red-400/10 text-red-300"
      }`}
    >
      {message.text}
    </div>
  );
}
