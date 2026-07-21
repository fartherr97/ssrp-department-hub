import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ClipboardList,
  BarChart3,
  Settings2,
  ChevronUp,
  ChevronDown,
  Webhook,
  Send,
} from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { canWriteLogs, canModerateLogs, canManageSite } from "../lib/permissions.js";
import { uid, probationDaysForType, applyAutoProbation } from "../lib/roster.js";
import { userDisplayName } from "../lib/user.js";
import useToast from "../hooks/useToast.js";
import {
  Button,
  IconButton,
  Panel,
  PageHeader,
  Modal,
  ConfirmDialog,
  Field,
  Input,
  Textarea,
  Select,
  Badge,
  CommaListInput,
  ColorInput,
  Toast,
  useModalData,
} from "../components/common/index.jsx";
import { lookupDiscordMember } from "../lib/api.js";

/*
 * Administrative Log page ("adminlog"). Departments log personnel actions
 * (hires, resignations, transfers, DAs/strikes), FTO sessions, interviews,
 * booth shifts, etc. across configurable LOGBOOKS, each with its own entry
 * types and custom fields.
 *
 * THE GOLDEN RULE: entries are SNAPSHOTS. At submission, the entry stores the
 * logbook name, entry type, subject, and every field as plain label/value
 * strings, so renaming/deleting books, types, or fields later never breaks
 * how old records render. Statistics are computed live from the entries, so
 * they update the moment anything is added, edited, or deleted.
 *
 * Page config shape:
 *   books:   [{ id, name, types: [string], fields: [{id,label,type,options?}] }]
 *   entries: [{ id, bookId, bookName, type, at, by:{name,discordId},
 *               subject:{name,discordId}, date, values:[{label,type,value}],
 *               editedBy?, editedAt? }]
 *
 * Permissions: writing needs the "Write administrative logs" capability;
 * authors can edit/delete their own entries; editing anyone's needs Manage
 * access or Manage site. Who can VIEW the page is set per-page in the Builder.
 */

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
];

export function defaultLogBooks() {
  return [
    {
      id: uid("book"),
      name: "Admin Log",
      types: [
        "Hired, Open Interview",
        "Hired, Application",
        "Resignation",
        "Transfer In",
        "Transfer Out",
      ],
      fields: [{ id: uid("lf"), label: "Notes", type: "textarea" }],
    },
    {
      id: uid("book"),
      name: "FTO Logbook",
      types: ["Academy Training", "Field Training, Phase 1", "Field Training, Phase 2", "Final Evaluation"],
      fields: [{ id: uid("lf"), label: "Result / Notes", type: "textarea" }],
    },
    {
      id: uid("book"),
      name: "Interview Logbook",
      types: ["Interview Conducted", "Interview Passed", "Interview Failed"],
      fields: [{ id: uid("lf"), label: "Notes", type: "textarea" }],
    },
    {
      id: uid("book"),
      name: "Booth Log",
      types: ["Open Interview Booth"],
      fields: [
        { id: uid("lf"), label: "Duration (minutes)", type: "text" },
        { id: uid("lf"), label: "Hires from booth", type: "text" },
        { id: uid("lf"), label: "Notes", type: "textarea" },
      ],
    },
  ];
}

/*
 * One-click demo data so departments can see the logbooks and statistics in
 * action before wiring up their own. Entries are generated against the page's
 * CURRENT books (matched by name) in proper snapshot form, then behave exactly
 * like real entries, edit or delete them freely.
 */
export function sampleEntries(books) {
  const cast = [
    { name: "M. Keller", discordId: "183319766168109056" },
    { name: "R. Ortiz", discordId: "205177225488760834" },
    { name: "T. Nguyen", discordId: "133195859598980307" },
    { name: "B. Harrison", discordId: "130965851945212320" },
    { name: "C. Walsh", discordId: "542353843653181441" },
    { name: "J. Brown", discordId: "100408908981916065" },
    { name: "A. Vega", discordId: "740369820775874721" },
  ];
  const loggers = [
    { name: "Capt. J. Welch", discordId: "961651847736770770" },
    { name: "Lt. A. Farson", discordId: "118605768592222225" },
    { name: "Sgt. D. Brooks", discordId: "101923837228617778" },
  ];
  const findBook = (re) => books.find((b) => re.test(b.name)) || books[0];
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const snap = (book, fill) =>
    (book?.fields || []).map((f) => ({
      label: f.label,
      type: f.type,
      ...(f.type === "select" ? { options: f.options || [] } : {}),
      value: fill[f.label] ?? (f.type === "checkbox" ? false : ""),
    }));

  const rows = [];
  const push = (book, type, subject, logger, days, fill = {}) => {
    if (!book) return;
    rows.push({
      id: uid("entry"),
      bookId: book.id,
      bookName: book.name,
      type,
      date: daysAgo(days),
      at: new Date(Date.now() - days * 86400000).toISOString(),
      by: logger,
      subject,
      values: snap(book, fill),
    });
  };

  const admin = findBook(/admin/i);
  const fto = findBook(/fto/i);
  const interview = findBook(/interview/i);
  const booth = findBook(/booth/i);
  const [keller, ortiz, nguyen, harrison, walsh, brown, vega] = cast;
  const [welch, farson, brooks] = loggers;
  const notes = (t) => ({ Notes: t, "Result / Notes": t });

  push(admin, "Hired, Open Interview", keller, welch, 42, notes("Hired at booth, strong interview."));
  push(admin, "Hired, Application", ortiz, farson, 38, notes("Application #214 approved."));
  push(admin, "Hired, Open Interview", nguyen, brooks, 31, notes("Walk-up interview, passed."));
  push(admin, "Transfer In", harrison, welch, 27, notes("Transfer from HCSO, rank matched at Officer."));
  push(admin, "Transfer Out", vega, farson, 7, notes("Transferred to FHP on good terms."));
  push(admin, "Resignation", walsh, brooks, 3, notes("Resigned, school commitments. Eligible for rehire."));

  push(fto, "Academy Training", keller, brooks, 40, notes("Completed academy classroom, 9/10 on exam."));
  push(fto, "Field Training, Phase 1", keller, brooks, 35, notes("Phase 1 ride-along complete, solid traffic stops."));
  push(fto, "Field Training, Phase 2", keller, farson, 29, notes("Phase 2 complete, ready for final eval."));
  push(fto, "Final Evaluation", keller, welch, 25, notes("PASSED. Promoted to Officer, probation 30 days."));
  push(fto, "Academy Training", nguyen, brooks, 24, notes("Academy day 1, needs radio code review."));
  push(fto, "Field Training, Phase 1", nguyen, farson, 15, notes("Phase 1 in progress, good instincts."));

  push(interview, "Interview Conducted", harrison, welch, 27, notes("Transfer interview, experienced."));
  push(interview, "Interview Passed", keller, welch, 42, notes("Confident answers, recommended hire."));
  push(interview, "Interview Failed", { name: "P. Donnelly", discordId: "" }, brooks, 12, notes("Failed scenario questions, may retry in 14 days."));

  push(booth, "Open Interview Booth", welch, welch, 42, { "Duration (minutes)": "90", "Hires from booth": "2", Notes: "Busy night, 5 interviews." });
  push(booth, "Open Interview Booth", brooks, brooks, 19, { "Duration (minutes)": "60", "Hires from booth": "1", Notes: "" });
  push(booth, "Open Interview Booth", farson, farson, 5, { "Duration (minutes)": "120", "Hires from booth": "3", Notes: "Joint booth with recruitment drive." });

  return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : value || "—";
}

// ─── Entry type colors (consistent, meaning-aware) ──────────────────────────

const TYPE_PALETTE = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#f97316", "#ef4444"];

function typeColor(type = "") {
  const t = type.toLowerCase();
  if (/pass|hire|accept|approved/.test(t)) return "#22c55e"; // good news, green
  if (/fail|resign|strike|terminat/.test(t)) return "#ef4444"; // bad news, red
  if (/transfer in/.test(t)) return "#3b82f6";
  if (/transfer out/.test(t)) return "#f97316";
  if (/\bda\b|coach|warn|probation/.test(t)) return "#f59e0b"; // discipline, amber
  if (/booth/.test(t)) return "#14b8a6";
  if (/interview/.test(t)) return "#a855f7";
  if (/academy|training|eval/.test(t)) return "#3b82f6";
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TYPE_PALETTE[h % TYPE_PALETTE.length];
}

// ── Discord webhook: send a new log to a channel as an embed ─────────────────
// The embed mirrors the log card (type, subject, fields, "logged by"), with
// optional role-ID pings above it. Discord webhooks accept browser POSTs.
// NOTE for the backend: the webhook URL sits in the config, which every signed-in
// member's client receives — for production, redact it from non-manager reads and
// fire the webhook server-side on POST /api/audit or the log write.
export function buildWebhookPayload(webhook, entry) {
  const hex = String(webhook.color || typeColor(entry.type) || "#3b82f6").replace("#", "");
  const color = parseInt(hex, 16);
  const fmt = (v) => (v.type === "checkbox" ? (v.value ? "Yes" : "No") : String(v.value ?? ""));
  const fields = [];
  if (entry.subject?.name || entry.subject?.discordId) {
    fields.push({
      name: "Subject",
      value: [entry.subject.name, entry.subject.discordId && `<@${entry.subject.discordId}>`]
        .filter(Boolean)
        .join(" ") || "—",
      inline: true,
    });
  }
  for (const v of entry.values || []) {
    const val = fmt(v);
    if (val === "" || val === "false") continue;
    fields.push({ name: v.label || "Field", value: val.slice(0, 1024), inline: false });
  }
  const embed = {
    ...(entry.bookName ? { author: { name: entry.bookName } } : {}),
    title: entry.type || "Log entry",
    color: Number.isFinite(color) ? color : undefined,
    fields: fields.slice(0, 25),
    footer: {
      text: `Logged by ${entry.by?.name || "Unknown"}${webhook.footer ? ` · ${webhook.footer}` : ""}`,
    },
    timestamp: entry.at,
  };
  const content = (webhook.roleIds || [])
    .map((id) => `<@&${String(id).trim()}>`)
    .filter((s) => s.length > 5)
    .join(" ");
  return {
    ...(content ? { content } : {}),
    ...(webhook.username ? { username: webhook.username } : {}),
    ...(webhook.avatarUrl ? { avatar_url: webhook.avatarUrl } : {}),
    embeds: [embed],
    allowed_mentions: { parse: ["roles"] },
  };
}

async function sendLogWebhook(webhook, entry) {
  if (!webhook?.enabled || !webhook.url) return;
  try {
    await fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildWebhookPayload(webhook, entry)),
    });
  } catch {
    /* webhook failures never block logging */
  }
}

function TypePill({ type }) {
  const color = typeColor(type);
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {type}
    </span>
  );
}

// One log entry as a clean table row (DA-Hub style): type, subject, logger,
// the field details, and date, with edit/delete actions.
function EntryRow({ entry: e, canEdit, onEdit, onDelete }) {
  const vals = (e.values || []).filter((v) => v.value);
  const fmtVal = (v) =>
    v.type === "checkbox" ? "Yes" : v.type === "date" ? formatDate(v.value) : String(v.value);
  return (
    <tr
      onClick={(ev) => { if (canEdit && !ev.target.closest("button, a")) onEdit(); }}
      className={`border-t border-white/5 align-top transition hover:bg-white/[0.03] ${canEdit ? "cursor-pointer" : ""}`}
    >
      <td className="px-4 py-3"><TypePill type={e.type} /></td>
      <td className="px-4 py-3">
        <div className="font-semibold leading-tight text-white">{e.subject?.name || "—"}</div>
        {e.subject?.discordId && (
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">{e.subject.discordId}</div>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">
        {e.by?.name || "Unknown"}
        {e.editedAt && <span className="text-slate-500" title={`Edited by ${e.editedBy}`}> · edited</span>}
      </td>
      <td className="px-4 py-3 text-sm text-slate-200">
        {vals.length ? (
          <div className="grid max-w-xl gap-0.5">
            {vals.map((v, i) => {
              // Notes fields are the plain body of the entry — show the text on
              // its own; keep the label only for other columns (Duration, etc.).
              const hideLabel = /note/i.test(v.label);
              return (
                <div key={i} className="min-w-0 leading-snug">
                  {!hideLabel && <span className="font-semibold text-slate-400">{v.label}: </span>}
                  <span className="whitespace-pre-line">{fmtVal(v)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
        {formatDate(e.date || (e.at || "").slice(0, 10))}
      </td>
      {canEdit && (
        <td className="px-2 py-3 text-right">
          <span className="flex items-center justify-end gap-1">
            <IconButton icon={Pencil} label="Edit entry" onClick={onEdit} className="h-7 w-7" />
            <IconButton
              icon={Trash2}
              label="Delete entry"
              onClick={onDelete}
              className="h-7 w-7 hover:border-red-500/40 hover:text-red-300"
            />
          </span>
        </td>
      )}
    </tr>
  );
}

// ─── Entry modal (new entries use the book's CURRENT schema; edits render the
//     entry's SNAPSHOT so old records stay editable even after schema changes) ─

function EntryModal({ open, onClose, books, entry, onSave, directory }) {
  const isNew = Boolean(entry.isNew);
  const [draft, setDraft] = useState(entry);
  const book = books.find((b) => b.id === draft.bookId) || books[0];

  // Auto-fill the subject's name from a pasted Discord ID: first from the local
  // directory (roster + prior entries, instant, no network), then, if the app
  // has a bot token, from the live guild. We never clobber a name the user typed
  // by hand — only one we auto-filled ourselves.
  const [lookup, setLookup] = useState({ state: "idle", source: "" });
  const autoNameRef = useRef("");
  const did = (draft.subject?.discordId || "").trim();
  useEffect(() => {
    if (!/^\d{17,20}$/.test(did)) { setLookup({ state: "idle", source: "" }); return; }
    let cancelled = false;
    const applyName = (name, source) => {
      if (cancelled || !name) return;
      setDraft((d) => {
        const cur = (d.subject?.name || "").trim();
        if (cur && cur !== autoNameRef.current) return d; // respect manual entry
        autoNameRef.current = name;
        return { ...d, subject: { ...(d.subject || {}), name } };
      });
      setLookup({ state: "found", source });
    };
    const local = directory?.get(did);
    if (local) { applyName(local, "roster"); return; }
    setLookup({ state: "loading", source: "" });
    const t = setTimeout(async () => {
      const res = await lookupDiscordMember(did);
      if (cancelled) return;
      if (res?.displayName) applyName(res.displayName, res.source || "guild");
      else setLookup({ state: "notfound", source: "" });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [did, directory]); // eslint-disable-line react-hooks/exhaustive-deps

  // For NEW entries, values follow the selected book's current fields.
  const syncBook = (bookId) => {
    const b = books.find((x) => x.id === bookId) || books[0];
    setDraft((d) => ({
      ...d,
      bookId: b.id,
      type: (b.types || [])[0] || "",
      values: (b.fields || []).map((f) => ({
        label: f.label,
        type: f.type,
        ...(f.type === "select" ? { options: f.options || [] } : {}),
        value: f.type === "checkbox" ? false : "",
      })),
    }));
  };

  const setValue = (i, value) =>
    setDraft((d) => ({
      ...d,
      values: d.values.map((v, j) => (j === i ? { ...v, value } : v)),
    }));

  const typeOptions = isNew
    ? book?.types || []
    : [...new Set([draft.type, ...(books.find((b) => b.id === draft.bookId)?.types || [])])].filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Log entry" : "Edit entry"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!draft.type || !draft.subject?.name?.trim() || !/^\d{17,20}$/.test((draft.subject?.discordId || "").trim())} onClick={() => onSave(draft)}>
            {isNew ? "Submit entry" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {isNew && (
            <Field label="Logbook">
              <Select value={draft.bookId || ""} onChange={(e) => syncBook(e.target.value)}>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Entry type">
            <Select value={draft.type || ""} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option value="">Choose type…</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={draft.date || ""}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject, name" hint="Who this entry is about.">
            <Input
              value={draft.subject?.name || ""}
              placeholder="J. Doe"
              onChange={(e) =>
                setDraft({ ...draft, subject: { ...(draft.subject || {}), name: e.target.value } })
              }
            />
          </Field>
          <Field label="Subject, Discord ID *" hint="Paste an ID to auto-fill the name; required so the entry ties to the right person.">
            <Input
              value={draft.subject?.discordId || ""}
              placeholder="000000000000000000"
              className="font-mono"
              onChange={(e) =>
                setDraft({ ...draft, subject: { ...(draft.subject || {}), discordId: e.target.value.trim() } })
              }
            />
            {lookup.state === "loading" && (
              <p className="mt-1 text-xs text-slate-500">Looking up this ID…</p>
            )}
            {lookup.state === "found" && (
              <p className="mt-1 text-xs text-emerald-400">
                Name auto-filled {lookup.source === "guild" ? "from Discord" : "from the roster"}.
              </p>
            )}
            {lookup.state === "notfound" && (
              <p className="mt-1 text-xs text-amber-400">No match found, enter the name manually.</p>
            )}
          </Field>
        </div>

        {(draft.values || []).map((v, i) => (
          <Field key={i} label={v.label}>
            {v.type === "textarea" ? (
              <Textarea rows={3} value={v.value || ""} onChange={(e) => setValue(i, e.target.value)} />
            ) : v.type === "select" ? (
              <Select value={v.value || ""} onChange={(e) => setValue(i, e.target.value)}>
                <option value="">—</option>
                {[...new Set([...(v.options || []), ...(v.value ? [v.value] : [])])].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : v.type === "checkbox" ? (
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-app-input px-3 py-2.5 text-sm text-cad-text">
                <input
                  type="checkbox"
                  checked={!!v.value}
                  onChange={(e) => setValue(i, e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                Yes
              </label>
            ) : (
              <Input
                type={v.type === "date" ? "date" : "text"}
                value={v.value || ""}
                onChange={(e) => setValue(i, e.target.value)}
              />
            )}
          </Field>
        ))}

        {!isNew && (
          <p className="text-xs text-slate-500">
            This entry is a snapshot from {formatDate((entry.at || "").slice(0, 10))}, its fields stay
            exactly as they were logged, even if the logbook's setup changes later.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ─── Logbook manager (books, their entry types, and custom fields) ───────────

function BooksModal({ open, onClose, books, onChange }) {
  const update = (id, patch) => onChange(books.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (id, dir) => {
    const i = books.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= books.length) return;
    const next = [...books];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const [confirmDel, setConfirmDel] = useState(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage logbooks"
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        Each logbook has its own entry types and custom fields. Changing them only affects
        NEW entries, everything already logged keeps its snapshot and statistics.
      </p>
      <div className="grid gap-3">
        {books.map((b, idx) => (
          <div key={b.id} className="grid gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3">
            <div className="flex items-center gap-2">
              <Input
                value={b.name}
                onChange={(e) => update(b.id, { name: e.target.value })}
                className="flex-1 font-semibold"
              />
              <IconButton icon={ChevronUp} label="Move up" disabled={idx === 0} onClick={() => move(b.id, -1)} className="disabled:opacity-30" />
              <IconButton icon={ChevronDown} label="Move down" disabled={idx === books.length - 1} onClick={() => move(b.id, 1)} className="disabled:opacity-30" />
              <IconButton
                icon={Trash2}
                label="Delete logbook"
                onClick={() => setConfirmDel(b)}
                className="hover:border-red-500/40 hover:text-red-300"
              />
            </div>
            <Field label="Entry types" hint="Separate with commas, these are the choices when logging.">
              <CommaListInput
                value={b.types || []}
                placeholder="Hired, Resignation, Strike"
                onChange={(types) => update(b.id, { types })}
              />
            </Field>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
                  Custom fields
                </span>
                <Button
                  variant="ghost"
                  icon={Plus}
                  className="!py-1 text-xs"
                  onClick={() =>
                    update(b.id, {
                      fields: [...(b.fields || []), { id: uid("lf"), label: "New field", type: "text" }],
                    })
                  }
                >
                  Add field
                </Button>
              </div>
              <div className="grid gap-1.5">
                {(b.fields || []).map((f) => (
                  <div key={f.id} className="grid grid-cols-[1fr_130px_auto] items-center gap-1.5">
                    <Input
                      value={f.label}
                      onChange={(e) =>
                        update(b.id, {
                          fields: b.fields.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)),
                        })
                      }
                    />
                    <Select
                      value={f.type}
                      onChange={(e) =>
                        update(b.id, {
                          fields: b.fields.map((x) => (x.id === f.id ? { ...x, type: e.target.value } : x)),
                        })
                      }
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                    <IconButton
                      icon={Trash2}
                      label="Remove field"
                      onClick={() =>
                        update(b.id, { fields: b.fields.filter((x) => x.id !== f.id) })
                      }
                      className="h-8 w-8 hover:border-red-500/40 hover:text-red-300"
                    />
                    {f.type === "select" && (
                      <div className="col-span-3">
                        <CommaListInput
                          value={f.options || []}
                          placeholder="Option A, Option B"
                          onChange={(options) =>
                            update(b.id, {
                              fields: b.fields.map((x) => (x.id === f.id ? { ...x, options } : x)),
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        <Button
          variant="secondary"
          icon={Plus}
          className="justify-self-start"
          onClick={() =>
            onChange([...books, { id: uid("book"), name: "New Logbook", types: ["Entry"], fields: [] }])
          }
        >
          Add logbook
        </Button>
      </div>
      <ConfirmDialog
        open={Boolean(confirmDel)}
        title="Delete logbook?"
        message={`Delete "${confirmDel?.name}"? Entries already logged are snapshots and stay in the statistics, but no new entries can be logged to it.`}
        confirmLabel="Delete logbook"
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => {
          onChange(books.filter((b) => b.id !== confirmDel.id));
          setConfirmDel(null);
        }}
      />
    </Modal>
  );
}

// ─── Statistics (always computed live from the entries) ─────────────────────

function countBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return [...map.entries()];
}

// A big-number stat box, the same look as the roster statistics panel.
function StatBox({ label, value, color }) {
  return (
    <Panel className="p-4" style={{ borderLeft: `3px solid ${color || "var(--color-primary)"}` }}>
      <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-cad-muted">
        {label}
      </div>
      <div className="mt-0.5 text-3xl font-black tabular-nums" style={{ color: color || "var(--color-primary)" }}>
        {value}
      </div>
    </Panel>
  );
}

// Horizontal bars per entry type, the longest bar is the most common type.
function TypeBars({ list }) {
  const counts = countBy(list, (e) => e.type);
  const max = counts[0]?.[1] || 1;
  return (
    <div className="grid gap-2.5">
      {counts.map(([type, n]) => {
        const color = typeColor(type);
        return (
          <div key={type}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-200">{type}</span>
              <span className="shrink-0 font-bold tabular-nums" style={{ color }}>
                {n}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(6, (n / max) * 100)}%`,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${color} 70%, transparent), ${color})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookBreakdown({ entries }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {groupBy(entries, (e) => e.bookName).map(([book, list]) => (
        <Panel key={book} className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-white">{book}</span>
            <Badge>{list.length}</Badge>
          </div>
          <TypeBars list={list} />
        </Panel>
      ))}
    </div>
  );
}

// Rank people by how many entries they appear on (as logger or as subject),
// with their most-common entry type. Powers the "Top members" leaderboards.
const personKey = (p) => p?.discordId || (p?.name || "").toLowerCase();
function leaderboard(entries, pick) {
  const map = new Map();
  for (const e of entries) {
    const p = pick(e);
    if (!p || !p.name) continue;
    const key = personKey(p);
    if (!map.has(key)) map.set(key, { key, name: p.name, discordId: p.discordId || "", count: 0, types: new Map() });
    const r = map.get(key);
    r.count += 1;
    r.types.set(e.type, (r.types.get(e.type) || 0) + 1);
  }
  return [...map.values()]
    .map((r) => ({ ...r, topType: [...r.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "" }))
    .sort((a, b) => b.count - a.count);
}
const initialsOf = (name) => (name || "?").split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();

function Leaderboard({ title, subtitle, rows, onPick, accent = "var(--color-primary)" }) {
  const max = rows[0]?.count || 1;
  return (
    <Panel className="p-4">
      <div className="mb-3">
        <div className="text-sm font-bold text-white">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No entries yet.</p>
      ) : (
        <div className="grid gap-1.5">
          {rows.slice(0, 8).map((r, i) => (
            <button
              key={r.key}
              onClick={() => onPick(r.discordId || r.name)}
              title="Show this member's activity"
              className="group flex items-center gap-3 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.04]"
            >
              <span className="w-4 shrink-0 text-center text-xs font-bold text-slate-500">{i + 1}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-slate-300">
                {initialsOf(r.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white group-hover:text-[var(--color-primary)]">{r.name}</span>
                {r.topType && <span className="block truncate text-[11px] text-slate-500">mostly {r.topType}</span>}
              </span>
              <span className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(8, (r.count / max) * 100)}%`, background: accent }} />
              </span>
              <span className="w-7 shrink-0 text-right text-sm font-bold tabular-nums text-white">{r.count}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

function StatsView({ entries }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = (p) =>
    Boolean(p) &&
    ((p.name || "").toLowerCase().includes(q) || (p.discordId || "").includes(query.trim()));

  const { asSubject, asLogger } = useMemo(() => {
    if (!q) return { asSubject: [], asLogger: [] };
    return {
      asSubject: entries.filter((e) => matches(e.subject)),
      asLogger: entries.filter((e) => matches(e.by)),
    };
  }, [entries, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const within = (days) => {
    const cutoff = Date.now() - days * 86400000;
    return entries.filter((e) => new Date(e.at || e.date).getTime() >= cutoff).length;
  };
  const last7 = useMemo(() => within(7), [entries]);
  const last30 = useMemo(() => within(30), [entries]);
  const topLoggers = useMemo(() => leaderboard(entries, (e) => e.by), [entries]);
  const topSubjects = useMemo(() => leaderboard(entries, (e) => e.subject), [entries]);

  return (
    <div className="grid gap-4">
      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          placeholder="Search a member by name or Discord ID…"
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {q ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Entries about them" value={asSubject.length} color="#3b82f6" />
            <StatBox label="Logged by them" value={asLogger.length} color="#22c55e" />
          </div>
          <div>
            <div className="mb-2 text-sm font-bold text-white">
              About them <span className="font-normal text-slate-500">, as the subject</span>
            </div>
            {asSubject.length ? (
              <BookBreakdown entries={asSubject} />
            ) : (
              <p className="text-sm text-slate-500">Nothing logged about a matching member.</p>
            )}
          </div>
          <div>
            <div className="mb-2 text-sm font-bold text-white">
              Their activity <span className="font-normal text-slate-500">, entries they logged</span>
            </div>
            {asLogger.length ? (
              <BookBreakdown entries={asLogger} />
            ) : (
              <p className="text-sm text-slate-500">No entries logged by a matching member.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatBox label="All entries" value={entries.length} />
            <StatBox label="Last 7 days" value={last7} color="#22c55e" />
            <StatBox label="Last 30 days" value={last30} color="#3b82f6" />
            <StatBox label="Staff logging" value={topLoggers.length} color="#a855f7" />
            <StatBox label="Members logged" value={topSubjects.length} color="#f59e0b" />
          </div>
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              Statistics appear here as entries are logged.
            </p>
          ) : (
            <>
              <div>
                <div className="mb-2 text-sm font-bold text-white">Top members</div>
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  <Leaderboard title="Top staff activity" subtitle="Who's logging the most entries" rows={topLoggers} onPick={setQuery} accent="#22c55e" />
                  <Leaderboard title="Most logged about" subtitle="Members with the most entries about them" rows={topSubjects} onPick={setQuery} accent="#f59e0b" />
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-bold text-white">By logbook &amp; type</div>
                <BookBreakdown entries={entries} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Webhook settings (management only) ──────────────────────────────────────

function WebhookModal({ open, onClose, webhook, books, onSave, onToast }) {
  const [draft, setDraft] = useState(webhook);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    if (!draft.url) return;
    setTesting(true);
    const book = books[0];
    const sample = {
      bookName: book?.name || "Admin Log",
      type: (book?.types || [])[0] || "Test",
      subject: { name: "Test Subject", discordId: "" },
      values: [{ label: "Notes", type: "textarea", value: "This is a webhook test from the Department Hub." }],
      by: { name: "Webhook test", discordId: "" },
      at: new Date().toISOString(),
    };
    try {
      const res = await fetch(draft.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildWebhookPayload(draft, sample)),
      });
      onToast?.(res.ok ? "Test sent to Discord" : `Discord rejected it (${res.status})`);
    } catch {
      onToast?.("Couldn't reach the webhook (check the URL)");
    }
    setTesting(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Admin log webhook"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => { onSave(draft); onClose(); }}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-sm text-slate-400">
          Send each new log to a Discord channel as an embed styled like the log card, with optional
          role pings above it. Only site managers see this.
        </p>

        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={!!draft.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Enabled — post new entries to Discord
        </label>

        <Field label="Webhook URL" hint="Discord → Channel → Integrations → Webhooks → Copy URL.">
          <Input
            value={draft.url || ""}
            onChange={(e) => set({ url: e.target.value.trim() })}
            placeholder="https://discord.com/api/webhooks/…"
          />
        </Field>

        <Field label="Ping role IDs" hint="Optional. Pinged above the embed. Separate with commas.">
          <CommaListInput
            value={draft.roleIds || []}
            onChange={(roleIds) => set({ roleIds })}
            placeholder="123456789012345678, …"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bot name" hint="Optional override.">
            <Input value={draft.username || ""} onChange={(e) => set({ username: e.target.value })} placeholder="FHP Records" />
          </Field>
          <Field label="Bot avatar URL" hint="Optional override.">
            <Input value={draft.avatarUrl || ""} onChange={(e) => set({ avatarUrl: e.target.value.trim() })} placeholder="https://…" />
          </Field>
          <Field label="Embed color" hint="Optional. Defaults to the log type's color.">
            <ColorInput value={draft.color || "#3b82f6"} onChange={(color) => set({ color })} />
          </Field>
          <Field label="Footer note" hint="Optional. Appended after 'Logged by …'.">
            <Input value={draft.footer || ""} onChange={(e) => set({ footer: e.target.value })} placeholder="Florida Highway Patrol" />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" icon={Send} disabled={!draft.url || testing} onClick={sendTest}>
            {testing ? "Sending…" : "Send test"}
          </Button>
        </div>

        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          The webhook URL is stored in the site config. For production, Steve should move sending to
          the backend and redact the URL from non-manager reads (see README).
        </p>
      </div>
    </Modal>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AdminLog({ page, user }) {
  const { config, mutate } = useConfig();
  const { toast, show } = useToast();
  const cfg = page?.config || {};
  const books = Array.isArray(cfg.books) ? cfg.books : [];
  const entries = Array.isArray(cfg.entries) ? cfg.entries : [];

  // Discord ID → display name, from the roster and everyone already logged, so
  // pasting a known ID auto-fills the subject name even without a bot token.
  const directory = useMemo(() => {
    const m = new Map();
    const add = (id, name) => { if (id && name && !m.has(String(id))) m.set(String(id), name); };
    for (const sub of config.roster?.subdivisions || [])
      for (const cat of sub.categories || [])
        for (const mem of cat.members || []) add(mem.discordId, mem.name);
    for (const e of entries) { add(e.subject?.discordId, e.subject?.name); add(e.by?.discordId, e.by?.name); }
    return m;
  }, [config, entries]);

  const canWrite = canWriteLogs(user, config);
  // Edit/delete ANY entry + manage logbooks now needs the dedicated capability,
  // so groups like Department Heads (Manage site) don't get it automatically.
  const canModerate = canModerateLogs(user, config);
  // Webhook setup is management-only (manage-site).
  const canWebhook = canManageSite(user, config);
  const canEditEntry = (e) =>
    canModerate || (canWrite && e.by?.discordId && e.by.discordId === user?.id);

  const [tab, setTab] = useState(books[0]?.id || "stats");
  const [entryModal, setEntryModal] = useState(null);
  const [booksOpen, setBooksOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const entryM = useModalData(entryModal);

  const setCfg = (patch) =>
    mutate((c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === page.id ? { ...p, config: { ...(p.config || {}), ...patch } } : p
      ),
    }));
  const setEntries = (next) => setCfg({ entries: next });

  const activeBook = books.find((b) => b.id === tab);

  function openNewEntry() {
    const b = activeBook || books[0];
    if (!b) return;
    setEntryModal({
      id: uid("entry"),
      isNew: true,
      bookId: b.id,
      type: (b.types || [])[0] || "",
      date: todayISO(),
      subject: { name: "", discordId: "" },
      values: (b.fields || []).map((f) => ({
        label: f.label,
        type: f.type,
        ...(f.type === "select" ? { options: f.options || [] } : {}),
        value: f.type === "checkbox" ? false : "",
      })),
    });
  }

  function saveEntry(draft) {
    const { isNew, ...clean } = draft;
    if (isNew) {
      const book = books.find((b) => b.id === clean.bookId);
      const entry = {
        ...clean,
        bookName: book?.name || "Log", // snapshot the book's name at submission
        at: new Date().toISOString(),
        by: { name: userDisplayName(user), discordId: user?.id || "" },
      };
      // Auto-probation: if this entry type matches a configured disciplinary rule
      // and names a member by Discord ID, set their probation in the same save.
      const days = probationDaysForType(config, entry.type);
      const did = entry.subject?.discordId;
      mutate((c) => {
        let next = {
          ...c,
          pages: c.pages.map((p) =>
            p.id === page.id
              ? { ...p, config: { ...(p.config || {}), entries: [entry, ...entries] } }
              : p
          ),
        };
        if (days > 0 && did) next = applyAutoProbation(next, did, days);
        return next;
      });
      sendLogWebhook(cfg.webhook, entry); // fire-and-forget to Discord if configured
      show(days > 0 && did ? `Entry logged, ${days}-day probation set` : "Entry logged");
    } else {
      setEntries(
        entries.map((e) =>
          e.id === clean.id
            ? {
                ...e,
                ...clean,
                editedBy: userDisplayName(user),
                editedAt: new Date().toISOString(),
              }
            : e
        )
      );
      show("Entry updated");
    }
    setEntryModal(null);
  }

  // Entries for the active book tab (deleted books keep their entries visible
  // in Statistics; a book tab shows only what was logged under its id).
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = entries.filter((e) => e.bookId === tab);
    if (q) {
      list = list.filter(
        (e) =>
          (e.subject?.name || "").toLowerCase().includes(q) ||
          (e.subject?.discordId || "").includes(query.trim()) ||
          (e.by?.name || "").toLowerCase().includes(q) ||
          (e.type || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [entries, tab, q, query]);

  return (
    <div>
      <Toast message={toast} />
      <PageHeader
        kicker={cfg.heroKicker || "Administration"}
        title={cfg.heroTitle || page?.label || "Administrative Log"}
        subtitle={
          cfg.heroSubtitle ||
          "Hires, DAs, trainings, interviews, and booths, every entry is snapshotted at submission."
        }
        actions={
          <>
            {canModerate && entries.length === 0 && books.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEntries(sampleEntries(books));
                  show("Sample data loaded, edit or delete it freely");
                }}
                title="Fill the logbooks with realistic demo entries to explore, they behave like real entries"
              >
                Load sample data
              </Button>
            )}
            {canModerate && (
              <Button variant="secondary" icon={Settings2} onClick={() => setBooksOpen(true)}>
                Manage logbooks
              </Button>
            )}
            {canWebhook && (
              <Button variant="secondary" icon={Webhook} onClick={() => setWebhookOpen(true)}>
                Webhook
              </Button>
            )}
            {canWrite && books.length > 0 && (
              <Button icon={Plus} onClick={openNewEntry}>
                Log entry
              </Button>
            )}
          </>
        }
      />

      {/* Tabs: each logbook + statistics */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-1">
        {books.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              setTab(b.id);
              setLimit(PAGE_SIZE);
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === b.id ? "bg-[color:var(--color-primary)]/18 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardList size={13} className={tab === b.id ? "text-[var(--color-primary)]" : ""} />
            {b.name}
            <span className="rounded-full bg-white/10 px-1.5 text-[10px]">
              {entries.filter((e) => e.bookId === b.id).length}
            </span>
          </button>
        ))}
        <div className="ml-auto mx-1 my-0.5 w-px shrink-0 self-stretch bg-white/10" />
        <button
          onClick={() => setTab("stats")}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-bold transition ${
            tab === "stats"
              ? "border-[var(--color-primary)] bg-[color:var(--color-primary)]/20 text-white"
              : "border-[color:var(--color-primary)]/45 text-[var(--color-primary)] hover:bg-[color:var(--color-primary)]/12"
          }`}
        >
          <BarChart3 size={14} />
          Statistics
        </button>
      </div>

      {tab === "stats" ? (
        <StatsView entries={entries} />
      ) : !activeBook ? (
        <Panel className="p-10 text-center text-sm text-slate-500">
          No logbooks yet{canModerate ? ", create one with Manage logbooks." : "."}
        </Panel>
      ) : (
        <>
          <div className="relative mb-3 max-w-md">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              placeholder="Search subject, logger, or type…"
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {visible.length === 0 ? (
            <Panel className="p-10 text-center text-sm text-slate-500">
              {q ? "Nothing matches the search." : "Nothing logged here yet."}
            </Panel>
          ) : (
            <>
              <Panel className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5 font-semibold">Type</th>
                        <th className="px-4 py-2.5 font-semibold">Subject</th>
                        <th className="px-4 py-2.5 font-semibold">Logged by</th>
                        <th className="px-4 py-2.5 font-semibold">Details</th>
                        <th className="px-4 py-2.5 font-semibold">Date</th>
                        {canWrite && <th className="px-2 py-2.5" />}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.slice(0, limit).map((e) => (
                        <EntryRow
                          key={e.id}
                          entry={e}
                          canEdit={canEditEntry(e)}
                          onEdit={() => setEntryModal(e)}
                          onDelete={() => setConfirmDel(e)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              {visible.length > limit && (
                <div className="mt-3 flex justify-center">
                  <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                    Show {Math.min(PAGE_SIZE, visible.length - limit)} more
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {entryM.data && (
        <EntryModal
          key={entryM.key}
          open={entryM.open}
          onClose={() => setEntryModal(null)}
          books={books}
          entry={entryM.data}
          directory={directory}
          onSave={saveEntry}
        />
      )}
      <BooksModal
        open={booksOpen}
        onClose={() => setBooksOpen(false)}
        books={books}
        onChange={(next) => setCfg({ books: next })}
      />
      <WebhookModal
        key={webhookOpen ? "wh-open" : "wh-closed"}
        open={webhookOpen}
        onClose={() => setWebhookOpen(false)}
        webhook={cfg.webhook || {}}
        books={books}
        onSave={(next) => setCfg({ webhook: next })}
        onToast={show}
      />
      <ConfirmDialog
        open={Boolean(confirmDel)}
        title="Delete log entry?"
        message={`Delete the "${confirmDel?.type}" entry about ${confirmDel?.subject?.name || "this member"}? Statistics update immediately and this can't be undone from here (restore a prior version from the Audit Log if needed).`}
        confirmLabel="Delete entry"
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => {
          setEntries(entries.filter((e) => e.id !== confirmDel.id));
          setConfirmDel(null);
          show("Entry deleted");
        }}
      />
    </div>
  );
}
