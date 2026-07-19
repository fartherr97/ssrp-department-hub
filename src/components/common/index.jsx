import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X, Upload } from "lucide-react";
import { normalizeMediaUrl } from "../../lib/urls.js";

// ─── Brand ───────────────────────────────────────────────────────────────────

// The CAD brand accent, a fixed orange used to highlight a token of the brand
// name (e.g. the "RP" in "Sunshine State RP"), matching the SSRP CAD look.
export const BRAND_ACCENT_COLOR = "#ff8822";

/*
 * Renders brand text with a configured accent substring (branding.brandAccent)
 * highlighted in the orange accent color. Falls back to plain text when the
 * accent is empty or not found.
 */
export function BrandName({ text = "", accent, className = "" }) {
  const i = accent ? text.indexOf(accent) : -1;
  if (i === -1) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, i)}
      <span style={{ color: BRAND_ACCENT_COLOR }}>{accent}</span>
      {text.slice(i + accent.length)}
    </span>
  );
}

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
      {actions && (
        // Phones: equal-size button grid; larger screens: a normal button row.
        <div className="grid shrink-0 grid-cols-2 items-stretch gap-2 sm:flex sm:items-center">
          {actions}
        </div>
      )}
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
    "bg-[linear-gradient(90deg,var(--color-primary),var(--color-hover))] text-white shadow-lg shadow-black/20 hover:brightness-110",
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
      className={`btn-glossy inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
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
      className={`press inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[var(--color-surface-2)] text-slate-300 transition hover:border-[color:var(--color-border)] hover:text-white ${className}`}
      {...rest}
    >
      <Icon size={16} strokeWidth={2.3} />
    </button>
  );
}

// ─── Form fields ─────────────────────────────────────────────────────────────

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
          {label}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-xs text-cad-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-app-input px-3 py-2 text-sm text-cad-text outline-none transition placeholder:text-slate-600 focus:border-[color:var(--color-border-strong)] focus:ring-2 focus:ring-[color:var(--color-primary)]/25";

export function Input({ className = "", ...rest }) {
  return <input className={`${inputClass} ${className}`} {...rest} />;
}

export function Textarea({ className = "", rows = 4, ...rest }) {
  return <textarea rows={rows} className={`${inputClass} resize-y ${className}`} {...rest} />;
}

/*
 * Select, a custom, animated, portaled dropdown that's a drop-in replacement
 * for a native <select> (CAD style). Reads <option> children, calls
 * onChange({ target: { value } }) so existing handlers need no edits, and is
 * keyboard-navigable with outside-click / Escape to dismiss.
 */

// Keep the menu mounted briefly after close so the out-animation can play. The
// in/out keyframe is driven off `open` directly (no rAF toggle) to avoid a
// one-frame flicker of the closing animation when the menu first opens.
export function useMounted(isOpen, duration = 140) {
  const [mounted, setMounted] = useState(isOpen);
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return undefined;
    }
    const id = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(id);
  }, [isOpen, duration]);
  return mounted;
}

function optionText(c) {
  if (c == null || c === false) return "";
  if (typeof c === "string" || typeof c === "number") return String(c);
  if (Array.isArray(c)) return c.map(optionText).join("");
  if (isValidElement(c)) return optionText(c.props.children);
  return "";
}

// Flatten <option> children (including .map()/fragments) to { value, label }.
function collectOptions(children) {
  const out = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const raw =
        child.props.value !== undefined ? child.props.value : optionText(child.props.children);
      out.push({
        value: raw,
        key: String(raw),
        label: child.props.children,
        disabled: !!child.props.disabled,
      });
    } else if (child.props && child.props.children) {
      out.push(...collectOptions(child.props.children));
    }
  });
  return out;
}

export function Select({
  value,
  onChange,
  children,
  className = "",
  disabled = false,
  placeholder = "Select…",
  name,
  ...rest
}) {
  const options = useMemo(() => collectOptions(children), [children]);
  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value ?? "")),
    [options, value]
  );

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [rect, setRect] = useState(null);
  const [flip, setFlip] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const mounted = useMounted(open, 140);

  const MAX_MENU_H = 280;
  const optCount = options.length;

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const above = r.top;
      const needed = Math.min(MAX_MENU_H, optCount * 36 + 12);
      const up = below < needed && above > below;
      setFlip(up);
      setRect({
        left: r.left,
        width: r.width,
        top: up ? undefined : r.bottom + 4,
        bottom: up ? window.innerHeight - r.top + 4 : undefined,
        maxH: Math.max(120, (up ? above : below) - 12),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, optCount]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    // iOS Safari doesn't reliably fire mousedown on taps outside interactive
    // elements, which left the menu open and swallowing taps. touchstart closes
    // it on the first tap anywhere outside.
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openMenu = () => {
    if (disabled) return;
    setActiveIdx(options.findIndex((o) => String(o.value) === String(value ?? "")));
    setOpen(true);
  };

  const choose = (opt) => {
    if (opt.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    onChange?.({ target: { value: String(opt.value), name } });
  };

  const moveActive = (dir) => {
    setActiveIdx((prev) => {
      let i = prev;
      for (let step = 0; step < options.length; step++) {
        i = (i + dir + options.length) % options.length;
        if (!options[i].disabled) return i;
      }
      return prev;
    });
  };

  const onTriggerKey = (e) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[activeIdx]) choose(options[activeIdx]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        name={name}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKey}
        className={`${inputClass} ${className} inline-flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50`}
        {...rest}
      >
        <span className={`truncate ${selected ? "text-cad-text" : "text-slate-500"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`-mr-0.5 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {mounted &&
        rect &&
        createPortal(
          <>
            {/* Invisible full-screen catcher under the menu: a tap/click anywhere
                outside the options closes the dropdown reliably on every device.
                The document mousedown/touchstart listeners above can miss taps on
                iOS Safari, which left the menu stuck on top of the modal eating
                every tap (Save/X appeared dead). This guarantees a close. */}
            {open && (
              <div
                className="fixed inset-0 z-[3999]"
                onPointerDown={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              />
            )}
          <div
            ref={menuRef}
            role="listbox"
            className={`fixed z-[4000] overflow-y-auto rounded-xl border border-white/[0.14] bg-app-card p-1 shadow-2xl shadow-black/60 ${
              open ? "anim-dropdown-in" : "anim-dropdown-out pointer-events-none"
            }`}
            style={{
              left: rect.left,
              minWidth: rect.width,
              width: "max-content",
              maxWidth: `calc(100vw - ${Math.round(rect.left)}px - 8px)`,
              top: rect.top,
              bottom: rect.bottom,
              maxHeight: Math.min(MAX_MENU_H, rect.maxH),
              transformOrigin: flip ? "bottom center" : "top center",
            }}
          >
            {options.length === 0 && (
              <div className="px-3 py-2.5 text-[12px] italic text-slate-600">No options</div>
            )}
            {options.map((opt, i) => {
              const isSel = String(opt.value) === String(value ?? "");
              const isActive = i === activeIdx;
              return (
                <button
                  key={opt.key + i}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  disabled={opt.disabled}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => choose(opt)}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSel ? "text-brand-bright" : "text-slate-200"
                  } ${isActive && !opt.disabled ? "bg-white/[0.07]" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {isSel && <Check size={15} className="shrink-0 text-brand-bright" />}
                </button>
              );
            })}
          </div>
          </>,
          document.body
        )}
    </>
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

/*
 * CommaListInput, edits a list of strings as comma-separated text. Unlike a
 * naive controlled input that re-joins the parsed list on every keystroke
 * (which eats the comma you just typed), this keeps the raw text while you
 * type and only tidies the formatting on blur. Resyncs if the list changes
 * from outside (e.g. undo).
 */
export function CommaListInput({ value = [], onChange, placeholder, className = "" }) {
  const [text, setText] = useState(value.join(", "));
  const lastParsed = useRef(value);

  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(lastParsed.current)) {
      setText(value.join(", "));
      lastParsed.current = value;
    }
  }, [value]);

  return (
    <Input
      value={text}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const parsed = t.split(",").map((s) => s.trim()).filter(Boolean);
        lastParsed.current = parsed;
        onChange(parsed);
      }}
      onBlur={() => setText(value.join(", "))}
    />
  );
}

/*
 * MediaInput, a URL field with an Upload button, for people who don't have
 * image hosting. Uploaded images are downscaled and stored inline (data URL)
 * in the config; pasting a normal https:// URL still works exactly as before.
 * kind="video" accepts small video files; bigger ones should be linked
 * (YouTube / Discord) since the front-end mock stores everything in the
 * browser. When the real backend lands, the upload path can swap to a POST.
 */
const VIDEO_UPLOAD_LIMIT = 2.5 * 1024 * 1024;

function downscaleImage(file, maxDim) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      // webp keeps inline images small; browsers without webp fall back to png.
      resolve(canvas.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be read as an image"));
    };
    img.src = url;
  });
}

export function MediaInput({ value, onChange, kind = "image", maxDim = 1024, placeholder = "https://… or upload a file" }) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const isUploaded = (value || "").startsWith("data:");

  // Only attempt to load the thumbnail once typing settles. Validating on every
  // keystroke made the <img> mount/error/unmount repeatedly — a heavy flicker and
  // a burst of failed network requests for each half-typed URL.
  const [previewSrc, setPreviewSrc] = useState(value || "");
  useEffect(() => {
    if ((value || "").startsWith("data:")) {
      setPreviewSrc(value); // uploaded data URLs are already final, show immediately
      return undefined;
    }
    const id = setTimeout(() => setPreviewSrc(value || ""), 450);
    return () => clearTimeout(id);
  }, [value]);
  // A new settled URL gets a fresh benefit of the doubt.
  useEffect(() => {
    setPreviewFailed(false);
  }, [previewSrc]);

  // Convert a pasted share-page link (Drive/Dropbox/Imgur/GitHub) into the direct
  // image URL once the field loses focus, so it actually renders.
  function normalizeOnBlur() {
    const next = normalizeMediaUrl(value);
    if (next !== value) onChange(next);
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      if (kind === "video") {
        if (file.size > VIDEO_UPLOAD_LIMIT) {
          throw new Error(
            "Video too large to store in the hub (max ~2.5 MB). Upload it to YouTube or Discord and paste the link instead."
          );
        }
        const reader = new FileReader();
        reader.onload = () => onChange(String(reader.result));
        reader.onerror = () => setError("That file couldn't be read");
        reader.readAsDataURL(file);
      } else {
        onChange(await downscaleImage(file, maxDim));
      }
    } catch (err) {
      setError(err.message || "Upload failed");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {kind === "image" && previewSrc && !previewFailed && (
          <img
            key={previewSrc}
            src={previewSrc}
            alt=""
            onError={() => setPreviewFailed(true)}
            onLoad={() => setPreviewFailed(false)}
            className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover"
          />
        )}
        {isUploaded ? (
          <div className="flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-white/10 bg-app-input px-3 text-sm">
            <span className="truncate text-green-300">
              Uploaded {kind} ✓ <span className="text-slate-500">(stored in the hub)</span>
            </span>
            <button
              type="button"
              onClick={() => onChange("")}
              title="Remove"
              className="shrink-0 text-slate-400 transition hover:text-red-300"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <Input
            value={value || ""}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onBlur={normalizeOnBlur}
            className="min-w-0 flex-1"
          />
        )}
        <input
          ref={fileRef}
          type="file"
          accept={kind === "video" ? "video/*" : "image/*"}
          onChange={onFile}
          className="hidden"
        />
        <Button
          variant="secondary"
          icon={Upload}
          onClick={() => fileRef.current?.click()}
          className="shrink-0 !px-3"
          title={kind === "video" ? "Upload a small video file" : "Upload an image from your computer"}
        >
          Upload
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      {!error && previewFailed && !isUploaded && previewSrc && (
        <p className="mt-1 text-xs text-amber-300/90">
          That link didn't load as an image. Use a direct link to the image file (it should end in
          .png, .jpg, .gif, or .webp), or click Upload. Discord links expire, upload those.
        </p>
      )}
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

// Body scroll lock shared by every modal. A plain save/restore corrupts when
// modals overlap (whichever closes last "restores" the other's lock and the
// page stays frozen), so we count open modals and only unlock at zero.
let modalLocks = 0;
function lockBodyScroll() {
  if (modalLocks++ === 0) document.body.style.overflow = "hidden";
}
function unlockBodyScroll() {
  modalLocks = Math.max(0, modalLocks - 1);
  if (modalLocks === 0) document.body.style.overflow = "";
}

export function Modal({ open, onClose, title, children, footer, size = "md" }) {
  // Stay mounted briefly after close so the out-animation can play.
  const mounted = useMounted(open, 160);

  // Keep the latest onClose in a ref so the effect doesn't tear down and
  // re-attach listeners every time the parent re-renders (which happens on
  // every autosave tick while a modal is open).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onCloseRef.current?.();
    document.addEventListener("keydown", onKey);
    lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open]);

  if (!mounted) return null;
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  /*
   * Portaled to <body>: modals render inside page trees whose ancestors can
   * carry transforms (e.g. the page-fade transition), and a transformed
   * ancestor turns position:fixed into "fixed to that ancestor". iOS Safari
   * in particular leaves modals mispositioned with dead hit-zones ("frozen").
   * Escaping to the body (or the fullscreen element, so charts in fullscreen
   * can still open dialogs) makes fixed mean the viewport again, always.
   */
  const portalTarget =
    typeof document !== "undefined" ? document.fullscreenElement || document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:items-center ${
        open ? "" : "pointer-events-none"
      }`}
    >
      {/* No backdrop blur here: blurring the whole viewport made every modal
          (and typing inside it) laggy on weaker GPUs. A darker dim reads
          nearly the same and costs nothing. */}
      <div
        className={`fixed inset-0 bg-black/75 ${
          open ? "anim-overlay-in" : "anim-overlay-out"
        }`}
        onClick={onClose}
      />
      <div
        className={`${open ? "anim-modal-in" : "anim-modal-out"} hub-panel relative z-10 w-full min-w-0 ${widths[size]} rounded-2xl`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="press rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
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
    </div>,
    portalTarget
  );
}

/*
 * Drives a conditionally-opened modal so its close animation can play:
 *   const m = useModalData(stateValue); // stateValue is null when closed
 *   {m.data && <MyModal key={m.key} open={m.open} thing={m.data} … />}
 * `data` keeps the last value during close; `key` changes on each open so the
 * modal remounts with fresh internal state.
 */
export function useModalData(value) {
  const ref = useRef({ data: null, key: 0, wasOpen: false });
  const open = value != null;
  if (open && (!ref.current.wasOpen || value !== ref.current.data)) {
    ref.current = { data: value, key: ref.current.key + 1, wasOpen: true };
  } else if (!open && ref.current.wasOpen) {
    ref.current = { ...ref.current, wasOpen: false };
  }
  return { data: open ? value : ref.current.data, key: ref.current.key, open };
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
  if (!message || typeof document === "undefined") return null;
  const isSuccess = message.type !== "error";
  // Portaled for the same reason as Modal: transformed page ancestors must
  // never capture its fixed positioning.
  return createPortal(
    <div
      className={`animate-pageFade fixed left-1/2 top-6 z-[120] -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-bold shadow-xl backdrop-blur ${
        isSuccess
          ? "border-green-400/30 bg-green-400/10 text-green-300"
          : "border-red-400/30 bg-red-400/10 text-red-300"
      }`}
    >
      {message.text}
    </div>,
    document.fullscreenElement || document.body
  );
}
