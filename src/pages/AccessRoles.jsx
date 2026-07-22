import { useState } from "react";
import { Plus, Trash2, UserPlus, Users, Lock, Hash } from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { uid } from "../lib/roster.js";
import { initials } from "../lib/user.js";
import {
  CAPABILITIES,
  canManageSite,
  canManageAccess,
  canAdministerGroup,
  canManageGroupMembers,
  hasCapability,
  userLevel,
  userGroup,
} from "../lib/permissions.js";
import {
  Panel,
  PageHeader,
  SectionHeader,
  Button,
  IconButton,
  Field,
  Input,
  Select,
  Badge,
} from "../components/common/index.jsx";

// The capability list lives in permissions.js (single source of truth), so
// new capabilities added there appear here automatically.
const CAPS = CAPABILITIES;

function CapabilityToggle({ checked, disabled, onChange, title, desc }) {
  return (
    <label
      className={`flex items-center gap-3 rounded-xl border border-white/10 bg-app-input px-3 py-2.5 ${
        disabled ? "opacity-60" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
      />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-cad-text">{title}</div>
        {desc && <div className="text-xs text-slate-500">{desc}</div>}
      </div>
    </label>
  );
}

function GroupMembers({ group, update, canEdit, canSetRole }) {
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const members = group.members || [];

  const add = () => {
    const n = name.trim();
    if (!n) return;
    update({ members: [...members, { id: uid("gm"), name: n, discordId: discordId.trim(), role: "member" }] });
    setName("");
    setDiscordId("");
  };
  const remove = (mid) => update({ members: members.filter((m) => m.id !== mid) });
  const setRole = (mid, role) =>
    update({ members: members.map((m) => (m.id === mid ? { ...m, role } : m)) });

  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
        Members, {members.length}
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
            {canSetRole ? (
              <Select value={m.role || "member"} onChange={(e) => setRole(m.id, e.target.value)} className="w-28">
                <option value="member">Member</option>
                <option value="manager">Manager</option>
              </Select>
            ) : (
              <Badge color={m.role === "manager" ? "#3d82f0" : undefined}>
                {m.role === "manager" ? "Manager" : "Member"}
              </Badge>
            )}
            {canEdit && (
              <IconButton
                icon={Trash2}
                label="Remove from group"
                onClick={() => remove(m.id)}
                className="hover:border-red-500/40 hover:text-red-300"
              />
            )}
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-slate-500">No one assigned yet.</p>}
      </div>
      {canEdit && (
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
      )}
    </div>
  );
}

// Per-group Discord role links. These write to the SAME config.auth.roleMappings
// the backend reads on login (resolveUserGroup): anyone who holds one of these
// roles in the guild is auto-assigned to this group when they sign in with
// Discord, on top of anyone added by hand above. Highest-level group wins if a
// member matches several.
function GroupDiscordRoles({ group, config, mutate, canEdit }) {
  const [roleName, setRoleName] = useState("");
  const [roleId, setRoleId] = useState("");
  const all = config.auth?.roleMappings || [];
  const mine = all.filter((m) => m.group === group.id);

  const setAll = (next) =>
    mutate((cfg) => ({ ...cfg, auth: { ...(cfg.auth || {}), roleMappings: next } }));
  const add = () => {
    // Accept several role IDs at once, separated by commas/spaces/newlines.
    const ids = roleId
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return;
    const linkedToGroup = new Set(mine.map((m) => String(m.roleId)));
    const name = roleName.trim();
    // Only a single, shared name makes sense when adding several at once.
    const additions = ids
      .filter((rid) => !linkedToGroup.has(rid))
      .map((rid) => ({
        id: uid("map"),
        roleId: rid,
        roleName: ids.length === 1 ? name : "",
        group: group.id,
      }));
    if (!additions.length) return; // all were duplicates
    setAll([...all, ...additions]);
    setRoleName("");
    setRoleId("");
  };
  const remove = (mid) => setAll(all.filter((m) => m.id !== mid));

  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
        Discord roles, {mine.length}
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Anyone with <span className="font-semibold text-slate-400">any</span> of these guild roles is
        put in this group automatically when they sign in with Discord. Link as many as you need.
      </p>
      <div className="grid gap-2">
        {mine.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-300">
              <Hash size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{m.roleName || "Discord role"}</div>
              <div className="truncate font-mono text-[11px] text-slate-500">{m.roleId}</div>
            </div>
            {canEdit && (
              <IconButton
                icon={Trash2}
                label="Unlink role"
                onClick={() => remove(m.id)}
                className="hover:border-red-500/40 hover:text-red-300"
              />
            )}
          </div>
        ))}
        {mine.length === 0 && (
          <p className="text-sm text-slate-500">No roles linked. Add one to auto-assign by Discord role.</p>
        )}
      </div>
      {canEdit && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            value={roleName}
            placeholder="Role name (optional)"
            onChange={(e) => setRoleName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Input
            value={roleId}
            placeholder="Discord role ID(s)"
            onChange={(e) => setRoleId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="font-mono"
            title="Paste one role ID, or several separated by commas or spaces."
          />
          <Button variant="secondary" icon={Plus} onClick={add}>
            Link
          </Button>
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, user }) {
  const { config, mutate } = useConfig();
  const canAdmin = canAdministerGroup(user, config, group);
  const canMembers = canManageGroupMembers(user, config, group);
  const isOwnGroup = group.id === user?.group;
  // You can't raise ANOTHER group above your own rank — clamp its level to yours.
  // But you can always change your OWN group's level (otherwise lowering it would
  // trap you: your ceiling would drop with it and you couldn't raise it back). A
  // groupless backend super-admin isn't bounded either.
  const superAdmin = user?.isAdmin && !userGroup(config, user);
  const rankCeiling = superAdmin || isOwnGroup ? 999 : userLevel(user, config);
  // Hierarchy integrity: a group can't be raised to reach or pass a group that
  // sits above it (no leapfrogging). Cap it just below the nearest group above.
  const above = (config.groups || []).filter((g) => g.id !== group.id && (g.level ?? 0) > (group.level ?? 0));
  const orderCeiling = superAdmin ? 999 : above.length ? Math.min(...above.map((g) => g.level ?? 0)) - 1 : 999;
  const maxLevel = Math.min(rankCeiling, orderCeiling);
  // The top group (highest level) can't be deleted here.
  const topLevel = Math.max(0, ...(config.groups || []).map((g) => g.level ?? 0));
  const isTopGroup = (group.level ?? 0) >= topLevel;

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

  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/12 text-[var(--color-primary)]">
          <Users size={18} />
        </div>
        <Input
          value={group.label}
          onChange={(e) => update({ label: e.target.value })}
          disabled={!canAdmin}
          className="flex-1 font-semibold disabled:opacity-70"
        />
        <div
          className="flex items-center gap-1.5"
          title="Level, you can only manage groups at or below your own"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-cad-muted">Lvl</span>
          <Input
            type="number"
            min={0}
            max={maxLevel}
            value={group.level ?? 0}
            disabled={!canAdmin}
            onChange={(e) => update({ level: Math.min(maxLevel, Math.max(0, Number(e.target.value) || 0)) })}
            className="w-14 disabled:opacity-70"
          />
        </div>
        <Badge>{(group.members || []).length} member(s)</Badge>
        {!canAdmin && !canMembers ? (
          <Lock size={15} className="text-slate-600" title="You can't manage this group" />
        ) : (
          <IconButton
            icon={Trash2}
            label={
              isOwnGroup
                ? "You can't delete your own group"
                : isTopGroup && !superAdmin
                ? "The top group can't be deleted"
                : canAdmin
                ? "Delete group"
                : "Need manage-access"
            }
            disabled={!canAdmin || isOwnGroup || (isTopGroup && !superAdmin)}
            onClick={remove}
            className="hover:border-red-500/40 hover:text-red-300 disabled:opacity-30"
          />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            What this group can do
          </div>
          <div className="grid gap-2">
            {CAPS.map((cap) => {
              const mainSub =
                (config.roster?.subdivisions || []).find((s) => s.main) ||
                config.roster?.subdivisions?.[0];
              const rankOpts = mainSub?.ranks || [];
              return (
                <div key={cap.key}>
                  <CapabilityToggle
                    title={cap.title}
                    desc={cap.desc}
                    checked={!!group[cap.key]}
                    disabled={!canAdmin || !hasCapability(user, config, cap.key)}
                    onChange={(v) => update({ [cap.key]: v })}
                  />
                  {cap.hasRankCeiling && group[cap.key] && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <Field label="Highest rank they can manage">
                        <Select
                          value={group.rosterRankCeiling || ""}
                          disabled={!canAdmin}
                          onChange={(e) => update({ rosterRankCeiling: e.target.value })}
                        >
                          <option value="">Select a rank…</option>
                          {rankOpts.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <p className="mt-1.5 text-[11px] text-cad-muted">
                        They can add, edit, and promote main-roster members at this rank and
                        every rank below it (plus rank-less cadets/recruits), nothing higher.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5">
          <GroupMembers group={group} update={update} canEdit={canMembers} canSetRole={canAdmin} />
          <GroupDiscordRoles group={group} config={config} mutate={mutate} canEdit={canAdmin} />
        </div>
      </div>
    </Panel>
  );
}

function DiscordSettings() {
  const { config, mutate } = useConfig();
  const auth = config.auth || {};
  const linkedCount = (auth.roleMappings || []).length;

  const setAuth = (patch) => mutate((cfg) => ({ ...cfg, auth: { ...cfg.auth, ...patch } }));

  return (
    <Panel className="p-5">
      <SectionHeader
        title="Discord sign-in (optional)"
        subtitle="Server-wide sign-in settings. Link Discord roles to a specific group on each group's card above."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department guild (server) ID" hint="Your department's own Discord server. Add more than one, separated by commas, to scan several. Roles from here AND the main SSRP guild both count.">
          <Input
            value={auth.discordGuildId || ""}
            onChange={(e) => setAuth({ discordGuildId: e.target.value })}
            placeholder="000000000000000000, 000000000000000000"
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
      <p className="mt-4 text-xs text-slate-500">
        {linkedCount > 0
          ? `${linkedCount} Discord role${linkedCount === 1 ? "" : "s"} linked to groups. On login, members with a linked role join that group automatically; the highest-level match wins.`
          : "Tip: on each group above, add a Discord role ID to auto-assign members to that group when they sign in."}
      </p>
    </Panel>
  );
}

// ─── Access & Roles page ──────────────────────────────────────────────────────

export default function AccessRoles({ user }) {
  const { config, mutate } = useConfig();
  const groups = [...(config.groups || [])].sort((a, b) => b.level - a.level);
  const mayAdd = canManageAccess(user, config);
  const maySite = canManageSite(user, config);

  const addGroup = () =>
    mutate((cfg) => ({
      ...cfg,
      groups: [
        ...cfg.groups,
        {
          id: uid("group"),
          label: "New Group",
          level: 1,
          manageSite: false,
          manageAccess: false,
          editRoster: false,
          editSubdivisions: false,
          members: [],
        },
      ],
    }));

  return (
    <div>
      <PageHeader
        kicker="Administration"
        title="Access & Roles"
        subtitle="Set what each group can do, then add people by name + Discord ID, or link Discord roles so members are assigned automatically on login. You can only manage groups at or below your own level."
        actions={
          mayAdd && (
            <Button icon={Plus} onClick={addGroup}>
              Add group
            </Button>
          )
        }
      />

      <div className="grid gap-6">
        {groups.map((g) => (
          <GroupCard key={g.id} group={g} user={user} />
        ))}
        {maySite && <DiscordSettings />}
      </div>
    </div>
  );
}
