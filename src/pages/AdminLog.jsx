import { useMemo, useState } from "react";
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
} from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { canWriteLogs, canManageAccess, canManageSite } from "../lib/permissions.js";
import { uid } from "../lib/roster.js";
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
  Toast,
  useModalData,
} from "../components/common/index.jsx";

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
        "Verbal DA / Coaching",
        "Non-Verbal DA",
        "Strike",
        "Other",
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

const todayISO = () => new Date().toISOString().slice(0, 10);

function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : value || "—";
}

// ─── Entry modal (new entries use the book's CURRENT schema; edits render the
//     entry's SNAPSHOT so old records stay editable even after schema changes) ─

function EntryModal({ open, onClose, books, entry, onSave }) {
  const isNew = Boolean(entry.isNew);
  const [draft, setDraft] = useState(entry);
  const book = books.find((b) => b.id === draft.bookId) || books[0];

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
          <Button disabled={!draft.type || !draft.subject?.name?.trim()} onClick={() => onSave(draft)}>
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
          <Field label="Subject, Discord ID" hint="Optional, makes their statistics exact.">
            <Input
              value={draft.subject?.discordId || ""}
              placeholder="000000000000000000"
              onChange={(e) =>
                setDraft({ ...draft, subject: { ...(draft.subject || {}), discordId: e.target.value.trim() } })
              }
            />
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

  const byBook = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (!map.has(e.bookName)) map.set(e.bookName, []);
      map.get(e.bookName).push(e);
    }
    return [...map.entries()];
  }, [entries]);

  const CountGrid = ({ list }) => (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {countBy(list, (e) => `${e.bookName}: ${e.type}`).map(([label, n]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm"
        >
          <span className="truncate text-slate-300">{label}</span>
          <span className="shrink-0 font-bold text-[var(--color-primary)]">{n}</span>
        </div>
      ))}
    </div>
  );

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
          <Panel className="p-4">
            <div className="mb-3 text-sm font-bold text-white">
              About them <span className="font-normal text-slate-500">(as the subject), {asSubject.length} entr{asSubject.length === 1 ? "y" : "ies"}</span>
            </div>
            {asSubject.length ? <CountGrid list={asSubject} /> : <p className="text-sm text-slate-500">Nothing logged about a matching member.</p>}
          </Panel>
          <Panel className="p-4">
            <div className="mb-3 text-sm font-bold text-white">
              Logged by them <span className="font-normal text-slate-500">(their activity), {asLogger.length} entr{asLogger.length === 1 ? "y" : "ies"}</span>
            </div>
            {asLogger.length ? <CountGrid list={asLogger} /> : <p className="text-sm text-slate-500">No entries logged by a matching member.</p>}
          </Panel>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Panel className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cad-muted">All entries</div>
              <div className="mt-0.5 text-2xl font-black text-[var(--color-primary)]">{entries.length}</div>
            </Panel>
            {byBook.slice(0, 3).map(([name, list]) => (
              <Panel key={name} className="p-4">
                <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-cad-muted">{name}</div>
                <div className="mt-0.5 text-2xl font-black text-white">{list.length}</div>
              </Panel>
            ))}
          </div>
          {byBook.map(([name, list]) => (
            <Panel key={name} className="p-4">
              <div className="mb-3 text-sm font-bold text-white">
                {name} <span className="font-normal text-slate-500">, {list.length} entr{list.length === 1 ? "y" : "ies"}</span>
              </div>
              <CountGrid list={list} />
            </Panel>
          ))}
          {entries.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              Statistics appear here as entries are logged.
            </p>
          )}
        </>
      )}
    </div>
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

  const canWrite = canWriteLogs(user, config);
  const canModerate = canManageAccess(user, config) || canManageSite(user, config);
  const canEditEntry = (e) =>
    canModerate || (canWrite && e.by?.discordId && e.by.discordId === user?.id);

  const [tab, setTab] = useState(books[0]?.id || "stats");
  const [entryModal, setEntryModal] = useState(null);
  const [booksOpen, setBooksOpen] = useState(false);
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
      setEntries([entry, ...entries]);
      show("Entry logged");
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
            {canModerate && (
              <Button variant="secondary" icon={Settings2} onClick={() => setBooksOpen(true)}>
                Manage logbooks
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
        <button
          onClick={() => setTab("stats")}
          className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            tab === "stats" ? "bg-[color:var(--color-primary)]/18 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          <BarChart3 size={13} className={tab === "stats" ? "text-[var(--color-primary)]" : ""} />
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
            <div className="grid gap-2">
              {visible.slice(0, limit).map((e) => (
                <Panel key={e.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="whitespace-nowrap font-mono text-xs text-slate-500">
                      {formatDate(e.date || (e.at || "").slice(0, 10))}
                    </span>
                    <Badge>{e.type}</Badge>
                    <span className="min-w-0 truncate text-sm font-semibold text-white">
                      {e.subject?.name || "—"}
                      {e.subject?.discordId && (
                        <span className="ml-2 font-mono text-[11px] font-normal text-slate-500">
                          {e.subject.discordId}
                        </span>
                      )}
                    </span>
                    <span className="ml-auto whitespace-nowrap text-xs text-slate-500">
                      by {e.by?.name || "Unknown"}
                      {e.editedAt && <span title={`Edited by ${e.editedBy}`}> · edited</span>}
                    </span>
                    {canEditEntry(e) && (
                      <span className="flex shrink-0 items-center gap-1">
                        <IconButton icon={Pencil} label="Edit entry" onClick={() => setEntryModal(e)} className="h-7 w-7" />
                        <IconButton
                          icon={Trash2}
                          label="Delete entry"
                          onClick={() => setConfirmDel(e)}
                          className="h-7 w-7 hover:border-red-500/40 hover:text-red-300"
                        />
                      </span>
                    )}
                  </div>
                  {(e.values || []).some((v) => v.value) && (
                    <div className="mt-1.5 grid gap-0.5 text-xs text-slate-400">
                      {(e.values || [])
                        .filter((v) => v.value)
                        .map((v, i) => (
                          <div key={i} className="min-w-0">
                            <span className="font-semibold text-slate-500">{v.label}:</span>{" "}
                            <span className="whitespace-pre-line">
                              {v.type === "checkbox" ? "Yes" : v.type === "date" ? formatDate(v.value) : String(v.value)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </Panel>
              ))}
              {visible.length > limit && (
                <Button variant="secondary" className="justify-self-center" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                  Show {Math.min(PAGE_SIZE, visible.length - limit)} more
                </Button>
              )}
            </div>
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
          onSave={saveEntry}
        />
      )}
      <BooksModal
        open={booksOpen}
        onClose={() => setBooksOpen(false)}
        books={books}
        onChange={(next) => setCfg({ books: next })}
      />
      <ConfirmDialog
        open={Boolean(confirmDel)}
        title="Delete log entry?"
        message={`Delete the "${confirmDel?.type}" entry about ${confirmDel?.subject?.name || "this member"}? Statistics update immediately and this can't be undone from here (page Undo still works).`}
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
