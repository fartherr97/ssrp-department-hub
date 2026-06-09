import { useState } from "react";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import { uid } from "../../lib/roster.js";
import { initials } from "../../lib/user.js";
import {
  Panel,
  SectionHeader,
  Button,
  IconButton,
  Field,
  Input,
  Select,
  Badge,
} from "../../components/common/index.jsx";

// ─── A single capability toggle ──────────────────────────────────────────────

function CapabilityToggle({ checked, disabled, onChange, title, desc }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-white/10 bg-app-input px-3 py-2.5 ${
        disabled ? "opacity-70" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
      />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-cad-text">{title}</div>
        {desc && <div className="text-xs text-slate-500">{desc}</div>}
      </div>
    </label>
  );
}

// ─── Group member list (assign people by name + Discord ID) ──────────────────

function GroupMembers({ group, update }) {
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const members = group.members || [];

  const add = () => {
    const n = name.trim();
    if (!n) return;
    update({ members: [...members, { id: uid("gm"), name: n, discordId: discordId.trim() }] });
    setName("");
    setDiscordId("");
  };
  const remove = (mid) => update({ members: members.filter((m) => m.id !== mid) });

  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
        Members — {members.length}
      </div>
      <div className="grid gap-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-slate-300">
              {initials(m.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{m.name || "—"}</div>
              {m.discordId && (
                <div className="truncate font-mono text-[11px] text-slate-500">{m.discordId}</div>
              )}
            </div>
            <IconButton
              icon={Trash2}
              label="Remove from group"
              onClick={() => remove(m.id)}
              className="hover:border-red-500/40 hover:text-red-300"
            />
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-slate-500">No one assigned yet.</p>}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={name}
          placeholder="Name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Input
          value={discordId}
          placeholder="Discord ID"
          onChange={(e) => setDiscordId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="font-mono"
        />
        <Button variant="secondary" icon={UserPlus} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

// ─── A group card (capabilities + members) ───────────────────────────────────

function GroupCard({ group }) {
  const { config, mutate } = useConfig();
  const locked = group.id === "admin";
  const isAdminGroup = Boolean(group.isAdmin) || locked;

  const update = (patch) =>
    mutate((cfg) => ({
      ...cfg,
      groups: cfg.groups.map((g) => (g.id === group.id ? { ...g, ...patch } : g)),
    }));

  const remove = () =>
    mutate((cfg) => ({
      ...cfg,
      groups: cfg.groups.filter((g) => g.id !== group.id),
      pages: cfg.pages.map((p) => ({
        ...p,
        access: (p.access || []).filter((a) => a !== group.id),
      })),
    }));

  const togglePage = (pageId) =>
    mutate((cfg) => ({
      ...cfg,
      pages: cfg.pages.map((p) => {
        if (p.id !== pageId) return p;
        const access = p.access || [];
        return {
          ...p,
          access: access.includes(group.id)
            ? access.filter((a) => a !== group.id)
            : [...access, group.id],
        };
      }),
    }));

  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/12 text-[var(--color-primary)]">
          <Users size={18} />
        </div>
        <Input
          value={group.label}
          onChange={(e) => update({ label: e.target.value })}
          className="flex-1 font-semibold"
        />
        <Badge>{(group.members || []).length} member(s)</Badge>
        <IconButton
          icon={Trash2}
          label={locked ? "Admin group can't be removed" : "Delete group"}
          disabled={locked}
          onClick={remove}
          className="hover:border-red-500/40 hover:text-red-300 disabled:opacity-30"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* What this group can do */}
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            What this group can do
          </div>
          <div className="grid gap-2">
            <CapabilityToggle
              checked={isAdminGroup}
              disabled={locked}
              onChange={(v) => update({ isAdmin: v })}
              title="Administrator"
              desc="Full access, including the Builder Portal and every page."
            />
            <CapabilityToggle
              checked={isAdminGroup ? true : !!group.canEditRoster}
              disabled={isAdminGroup}
              onChange={(v) => update({ canEditRoster: v })}
              title="Edit the roster"
              desc="Add, edit, and move members, ranks, and categories."
            />
          </div>

          <div className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            Page access
          </div>
          {isAdminGroup ? (
            <p className="text-sm text-slate-500">Administrators can access every page.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {config.pages.map((p) => {
                  const on = (p.access || []).includes(group.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePage(p.id)}
                      className={`press rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        on
                          ? "border-[color:var(--color-border-strong)] bg-[color:var(--color-primary)]/15 text-white"
                          : "border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                A page with no groups selected is visible to everyone.
              </p>
            </>
          )}
        </div>

        {/* Members */}
        <GroupMembers group={group} update={update} />
      </div>
    </Panel>
  );
}

// ─── Optional: Discord sign-in + auto-assign by role ─────────────────────────

function DiscordSettings() {
  const { config, mutate } = useConfig();
  const auth = config.auth || {};
  const mappings = auth.roleMappings || [];

  const setAuth = (patch) => mutate((cfg) => ({ ...cfg, auth: { ...cfg.auth, ...patch } }));
  const updateRow = (id, patch) =>
    setAuth({ roleMappings: mappings.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const addRow = () =>
    setAuth({
      roleMappings: [
        ...mappings,
        { id: uid("map"), roleId: "", roleName: "", group: config.groups[0]?.id || "member" },
      ],
    });
  const removeRow = (id) => setAuth({ roleMappings: mappings.filter((m) => m.id !== id) });

  return (
    <Panel className="p-5">
      <SectionHeader
        title="Discord sign-in (optional)"
        subtitle="Server settings, plus optional auto-assignment that maps a member's Discord role to a group on login."
        actions={
          <Button icon={Plus} onClick={addRow}>
            Add role rule
          </Button>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Field label="Discord guild (server) ID">
          <Input
            value={auth.discordGuildId || ""}
            onChange={(e) => setAuth({ discordGuildId: e.target.value })}
            placeholder="000000000000000000"
          />
        </Field>
        <Field label="Developer login" hint="Lets anyone preview the hub without Discord. Disable in production.">
          <Select
            value={auth.devLoginEnabled ? "on" : "off"}
            onChange={(e) => setAuth({ devLoginEnabled: e.target.value === "on" })}
          >
            <option value="on">Enabled</option>
            <option value="off">Disabled</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-2">
        {mappings.map((m) => (
          <div
            key={m.id}
            className="grid grid-cols-1 items-end gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3 sm:grid-cols-[1fr_1fr_160px_auto]"
          >
            <Field label="Role name">
              <Input value={m.roleName} onChange={(e) => updateRow(m.id, { roleName: e.target.value })} />
            </Field>
            <Field label="Discord role ID">
              <Input value={m.roleId} onChange={(e) => updateRow(m.id, { roleId: e.target.value })} />
            </Field>
            <Field label="Maps to group">
              <Select value={m.group} onChange={(e) => updateRow(m.id, { group: e.target.value })}>
                {config.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </Field>
            <IconButton
              icon={Trash2}
              label="Delete rule"
              onClick={() => removeRow(m.id)}
              className="mb-0.5 hover:border-red-500/40 hover:text-red-300"
            />
          </div>
        ))}
        {mappings.length === 0 && (
          <p className="text-sm text-slate-500">
            No role rules. People are assigned directly to groups above.
          </p>
        )}
      </div>
    </Panel>
  );
}

// ─── Access & Roles tab ──────────────────────────────────────────────────────

export default function AccessTab() {
  const { config, mutate } = useConfig();
  const groups = [...(config.groups || [])].sort((a, b) => a.level - b.level);

  const addGroup = () =>
    mutate((cfg) => ({
      ...cfg,
      groups: [
        ...cfg.groups,
        {
          id: uid("group"),
          label: "New Group",
          level: cfg.groups.length + 1,
          isAdmin: false,
          canEditRoster: false,
          members: [],
        },
      ],
    }));

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">Groups</h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            Create groups, toggle what each can do, then assign people by name + Discord ID.
          </p>
        </div>
        <Button icon={Plus} onClick={addGroup}>
          Add group
        </Button>
      </div>

      {groups.map((g) => (
        <GroupCard key={g.id} group={g} />
      ))}

      <DiscordSettings />
    </div>
  );
}
