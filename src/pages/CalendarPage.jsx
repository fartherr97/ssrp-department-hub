import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, CalendarDays, Archive, Check, X, MapPin } from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { canManageCalendar } from "../lib/permissions.js";
import { uid } from "../lib/roster.js";
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
  Badge,
  useModalData,
} from "../components/common/index.jsx";

/*
 * Department calendar page. Always opens on the *current* month (so it rolls
 * over automatically); older months remain browsable via the arrows and the
 * Archive view. Events live on the page's config:
 *   { events: [{ id, date "YYYY-MM-DD", time, title, description,
 *                createdBy, attendees: [{ id, name }] }] }
 * Adding/editing/deleting requires the manageCalendar capability (Command and
 * up by default); any signed-in member can mark themselves attending.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatEventDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

function EventModal({ open, onClose, event, onSave }) {
  const [draft, setDraft] = useState(event);
  if (open && draft.id !== event.id) setDraft(event);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event.isNew ? "Add event" : "Edit event"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!draft.title?.trim() || !draft.date} onClick={() => onSave(draft)}>
            Save event
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Title">
          <Input
            value={draft.title || ""}
            placeholder="e.g. Department Meeting"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date">
            <Input type="date" value={draft.date || ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          <Field label="Start time" hint="Optional, e.g. 8:00 PM EST">
            <Input
              value={draft.startTime ?? draft.time ?? ""}
              placeholder="8:00 PM EST"
              onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
            />
          </Field>
          <Field label="End date" hint="Optional, only for multi-day events.">
            <Input
              type="date"
              value={draft.endDate || ""}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            />
          </Field>
          <Field label="End time" hint="Optional, e.g. 10:00 PM EST">
            <Input
              value={draft.endTime || ""}
              placeholder="10:00 PM EST"
              onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Location" hint="Optional, e.g. Main Briefing Room, TS Channel 2.">
          <Input
            value={draft.location || ""}
            placeholder="Where it happens"
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
        </Field>
        <Field label="Details" hint="Optional, what to bring, agenda, etc.">
          <Textarea rows={3} value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function EventDetails({ open, event, user, canManage, onClose, onEdit, onDelete, onToggleAttend }) {
  const attendees = event.attendees || [];
  const attending = attendees.some((a) => a.id === user?.id);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event.title}
      size="md"
      footer={
        <div className="flex w-full items-center gap-2">
          {canManage && (
            <>
              <Button variant="secondary" icon={Pencil} onClick={onEdit} className="flex-1">
                Edit
              </Button>
              <Button variant="danger" icon={Trash2} onClick={onDelete} className="flex-1">
                Delete
              </Button>
            </>
          )}
          {attending ? (
            <Button variant="secondary" icon={X} onClick={onToggleAttend} className="flex-1">
              Remove
            </Button>
          ) : (
            <Button icon={Check} onClick={onToggleAttend} className="flex-1">
              Attending
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <CalendarDays size={15} className="text-[var(--color-primary)]" />
          <span>
            {formatEventDate(event.date)}
            {(event.startTime || event.time) && ` · ${event.startTime || event.time}`}
            {(event.endDate || event.endTime) && (
              <>
                {", "}
                {formatEventDate(event.endDate || event.date)}
                {event.endTime && ` · ${event.endTime}`}
              </>
            )}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <MapPin size={15} className="text-[var(--color-primary)]" />
            {event.location}
          </div>
        )}
        {event.description && (
          <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{event.description}</p>
        )}
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            Attending ({attendees.length})
          </div>
          {attendees.length === 0 ? (
            <p className="text-sm text-slate-500">No one yet, be the first.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {attendees.map((a) => (
                <Badge key={a.id}>{a.name}</Badge>
              ))}
            </div>
          )}
        </div>
        {event.createdBy && (
          <p className="text-[11px] text-slate-600">Posted by {event.createdBy}</p>
        )}
      </div>
    </Modal>
  );
}

function ArchiveModal({ open, onClose, events }) {
  // Past events grouped by month, newest first.
  const groups = useMemo(() => {
    const now = new Date();
    const cur = dateKey(now.getFullYear(), now.getMonth(), 1).slice(0, 7);
    const past = events.filter((e) => e.date && e.date.slice(0, 7) < cur);
    const byMonth = {};
    for (const e of past) {
      const k = e.date.slice(0, 7);
      (byMonth[k] = byMonth[k] || []).push(e);
    }
    return Object.entries(byMonth)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, list]) => ({
        key: k,
        label: `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`,
        events: list.sort((a, b) => (a.date < b.date ? 1 : -1)),
      }));
  }, [events]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Event archive"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nothing here yet, events automatically land in the archive once their month is over.
        </p>
      ) : (
        <div className="grid gap-4">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
                {g.label}
              </div>
              <div className="grid gap-1.5">
                {g.events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{e.title}</div>
                      <div className="text-xs text-slate-500">
                        {formatEventDate(e.date)}
                        {(e.startTime || e.time) ? ` · ${e.startTime || e.time}` : ""}
                        {e.location ? ` · ${e.location}` : ""}
                      </div>
                    </div>
                    <Badge>{(e.attendees || []).length} attended</Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function CalendarPage({ page, user }) {
  const { config, mutate } = useConfig();
  const canManage = canManageCalendar(user, config);
  const events = Array.isArray(page?.config?.events) ? page.config.events : [];

  // Always opens on the current month, the rollover is automatic.
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [eventModal, setEventModal] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const setEvents = (next) =>
    mutate((c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === page.id ? { ...p, config: { ...(p.config || {}), events: next } } : p
      ),
    }));

  function shiftMonth(dir) {
    setView(({ y, m }) => {
      const d = new Date(y, m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  // Events appear on every day they span (date → endDate, capped at 60 days);
  // continuation days are flagged so the chip renders differently.
  const eventsByDay = useMemo(() => {
    const map = {};
    for (const e of events) {
      if (!e.date) continue;
      const end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
      const [y, m, d] = e.date.split("-").map(Number);
      const cursor = new Date(y, m - 1, d);
      for (let i = 0; i < 60; i++) {
        const key = dateKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        if (key > end) break;
        (map[key] = map[key] || []).push(i === 0 ? e : { ...e, _continued: true });
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => ((a.startTime || a.time) || "").localeCompare((b.startTime || b.time) || ""));
    }
    return map;
  }, [events]);

  // Build the month grid: leading blanks + the month's days.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= days; d++) out.push(d);
    return out;
  }, [view]);

  const isCurrentMonth = view.y === now.getFullYear() && view.m === now.getMonth();
  const tKey = todayKey();
  const details = events.find((e) => e.id === detailsId);
  const eventM = useModalData(eventModal);
  const detailsM = useModalData(details);

  function saveEvent(draft) {
    const { isNew, ...clean } = draft;
    setEvents(isNew ? [...events, clean] : events.map((e) => (e.id === clean.id ? { ...e, ...clean } : e)));
    setEventModal(null);
  }
  function openNewEvent(date) {
    setEventModal({
      id: uid("event"),
      date: date || tKey,
      startTime: "",
      endDate: "",
      endTime: "",
      location: "",
      title: "",
      description: "",
      createdBy: user?.displayName || user?.globalName || user?.username || "",
      attendees: [],
      isNew: true,
    });
  }
  function toggleAttend(eventId) {
    if (!user?.id) return;
    // Prefer the SSRP guild nickname (displayName, provided by the backend's
    // /auth/me) over the global Discord username.
    const name = user.displayName || user.globalName || user.username || "Member";
    setEvents(
      events.map((e) => {
        if (e.id !== eventId) return e;
        const attendees = e.attendees || [];
        const mine = attendees.some((a) => a.id === user.id);
        return {
          ...e,
          attendees: mine
            ? attendees.filter((a) => a.id !== user.id)
            : [...attendees, { id: user.id, name }],
        };
      })
    );
  }

  return (
    <div>
      <PageHeader
        kicker={page?.config?.heroKicker || "Schedule"}
        title={page?.config?.heroTitle || page?.label || "Department Calendar"}
        subtitle={
          page?.config?.heroSubtitle ||
          "Meetings, trainings, and events. Tap an event to see details and mark yourself attending."
        }
        actions={
          <>
            <Button variant="secondary" icon={Archive} onClick={() => setArchiveOpen(true)}>
              Archive
            </Button>
            {canManage && (
              <Button icon={Plus} onClick={() => openNewEvent()}>
                Add event
              </Button>
            )}
          </>
        }
      />

      <Panel className="p-4">
        {/* Month header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <IconButton icon={ChevronLeft} label="Previous month" onClick={() => shiftMonth(-1)} />
            <IconButton icon={ChevronRight} label="Next month" onClick={() => shiftMonth(1)} />
            {!isCurrentMonth && (
              <Button
                variant="ghost"
                onClick={() => setView({ y: now.getFullYear(), m: now.getMonth() })}
              >
                Back to today
              </Button>
            )}
          </div>
          <h2 className="text-lg font-bold text-white">
            {MONTHS[view.m]} <span className="text-[var(--color-primary)]">{view.y}</span>
          </h2>
          <div className="w-24 text-right text-xs text-slate-500">
            {events.filter((e) => (e.date || "").slice(0, 7) === `${view.y}-${pad(view.m + 1)}`).length}{" "}
            event(s)
          </div>
        </div>

        {/* Desktop / tablet: month grid */}
        <div className="hidden sm:block">
        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-1 pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} />;
            const key = dateKey(view.y, view.m, day);
            const dayEvents = eventsByDay[key] || [];
            const isToday = key === tKey;
            return (
              <div
                key={key}
                onClick={() => canManage && openNewEvent(key)}
                className={`min-h-[84px] rounded-lg border p-1.5 transition ${
                  isToday
                    ? "border-[color:var(--color-border-strong)] bg-[color:var(--color-primary)]/10"
                    : "border-white/5 bg-white/[0.02]"
                } ${canManage ? "cursor-pointer hover:border-[color:var(--color-border)]" : ""}`}
                title={canManage ? "Click an empty spot to add an event" : undefined}
              >
                <div className={`text-right text-[11px] font-bold ${isToday ? "text-[var(--color-primary)]" : "text-slate-500"}`}>
                  {day}
                </div>
                <div className="mt-0.5 grid gap-1">
                  {dayEvents.map((e) => {
                    // Events you've marked yourself attending are tinted green.
                    const mine = (e.attendees || []).some((a) => a.id === user?.id);
                    return (
                    <button
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setDetailsId(e.id);
                      }}
                      className={`flex items-center gap-1 truncate rounded-md border px-1.5 py-1 text-left text-[11px] font-semibold text-white ${
                        mine
                          ? "border-emerald-500/50 bg-emerald-500/20 hover:bg-emerald-500/30"
                          : `border-[color:var(--color-border)] hover:bg-[color:var(--color-primary)]/25 ${e._continued ? "bg-[color:var(--color-primary)]/8 opacity-80" : "bg-[color:var(--color-primary)]/15"}`
                      }`}
                      title={`${e.title}${(e.startTime || e.time) ? `, ${e.startTime || e.time}` : ""}${e.location ? ` @ ${e.location}` : ""}${mine ? " · You're attending" : ""}`}
                    >
                      {mine ? (
                        <Check size={11} className="shrink-0 text-emerald-400" />
                      ) : e._continued ? (
                        <span className="text-[var(--color-primary)]">↳</span>
                      ) : (
                        (e.startTime || e.time) && (
                          <span className="text-[var(--color-primary)]">{e.startTime || e.time}</span>
                        )
                      )}
                      <span className="truncate">{e.title}</span>
                      {!e._continued && (e.attendees || []).length > 0 && (
                        <span className="ml-auto shrink-0 text-slate-400">{(e.attendees || []).length}</span>
                      )}
                    </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* Phones: agenda list of the month's events */}
        <div className="grid gap-2 sm:hidden">
          {cells
            .map((day) => {
              if (day === null) return null;
              const key = dateKey(view.y, view.m, day);
              const dayEvents = eventsByDay[key] || [];
              if (dayEvents.length === 0) return null;
              const weekday = WEEKDAYS[new Date(view.y, view.m, day).getDay()];
              const isToday = key === tKey;
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-3 ${
                    isToday
                      ? "border-[color:var(--color-border-strong)] bg-[color:var(--color-primary)]/10"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <div
                    className={`text-[11px] font-bold uppercase tracking-wide ${
                      isToday ? "text-[var(--color-primary)]" : "text-slate-500"
                    }`}
                  >
                    {weekday} · {pad(view.m + 1)}/{pad(day)}
                    {isToday && " · Today"}
                  </div>
                  <div className="mt-1.5 grid gap-1.5">
                    {dayEvents.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setDetailsId(e.id)}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-primary)]/12 px-2.5 py-2 text-left text-sm font-semibold text-white"
                      >
                        <span className="min-w-0 truncate">
                          {e._continued && <span className="mr-1 text-[var(--color-primary)]">↳</span>}
                          {e.title}
                        </span>
                        {(e.startTime || e.time) && !e._continued && (
                          <span className="shrink-0 text-xs text-[var(--color-primary)]">
                            {e.startTime || e.time}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
            .filter(Boolean)}
          {cells.every((day) => day === null || (eventsByDay[dateKey(view.y, view.m, day)] || []).length === 0) && (
            <p className="py-6 text-center text-sm text-slate-500">No events this month.</p>
          )}
        </div>
      </Panel>

      {eventM.data && (
        <EventModal
          key={eventM.key}
          open={eventM.open}
          onClose={() => setEventModal(null)}
          event={eventM.data}
          onSave={saveEvent}
        />
      )}
      {detailsM.data && (
        <EventDetails
          open={detailsM.open}
          event={detailsM.data}
          user={user}
          canManage={canManage}
          onClose={() => setDetailsId(null)}
          onEdit={() => {
            setEventModal(detailsM.data);
            setDetailsId(null);
          }}
          onDelete={() => {
            setConfirmDelete(detailsM.data);
            setDetailsId(null);
          }}
          onToggleAttend={() => toggleAttend(detailsM.data.id)}
        />
      )}
      <ArchiveModal open={archiveOpen} onClose={() => setArchiveOpen(false)} events={events} />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete event?"
        message={`Delete "${confirmDelete?.title}" (${formatEventDate(confirmDelete?.date)})?`}
        confirmLabel="Delete event"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          setEvents(events.filter((e) => e.id !== confirmDelete.id));
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
