import { Plus, Trash2 } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import { uid } from "../../lib/roster.js";
import {
  Panel,
  SectionHeader,
  Button,
  IconButton,
  Field,
  Input,
  Select,
} from "../../components/common/index.jsx";

function PermissionGroups() {
  const { config, mutate } = useConfig();
  const groups = config.groups || [];

  const update = (id, patch) =>
    mutate((cfg) => ({
      ...cfg,
      groups: cfg.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));

  const add = () =>
    mutate((cfg) => ({
      ...cfg,
      groups: [
        ...cfg.groups,
        { id: uid("group"), label: "New Group", level: cfg.groups.length + 1 },
      ],
    }));

  // Removing a group also strips it from every page's access list.
  const remove = (id) =>
    mutate((cfg) => ({
      ...cfg,
      groups: cfg.groups.filter((g) => g.id !== id),
      pages: cfg.pages.map((p) => ({
        ...p,
        access: (p.access || []).filter((a) => a !== id),
      })),
    }));

  return (
    <Panel className="p-5">
      <SectionHeader
        title="Permission groups"
        subtitle="Access tiers, lowest to highest. Pages grant access by group."
        actions={
          <Button icon={Plus} onClick={add}>
            Add group
          </Button>
        }
      />
      <div className="grid gap-2">
        {[...groups]
          .sort((a, b) => a.level - b.level)
          .map((g) => {
            const locked = g.id === "admin";
            return (
              <div
                key={g.id}
                className="flex items-end gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3"
              >
                <div className="flex-1">
                  <Field label="Label">
                    <Input value={g.label} onChange={(e) => update(g.id, { label: e.target.value })} />
                  </Field>
                </div>
                <div className="w-24">
                  <Field label="Level">
                    <Input
                      type="number"
                      value={g.level}
                      onChange={(e) => update(g.id, { level: Number(e.target.value) || 0 })}
                    />
                  </Field>
                </div>
                <IconButton
                  icon={Trash2}
                  label={locked ? "Admin group can't be removed" : "Delete group"}
                  disabled={locked}
                  onClick={() => remove(g.id)}
                  className="mb-0.5 hover:border-red-500/40 hover:text-red-300 disabled:opacity-30"
                />
              </div>
            );
          })}
      </div>
    </Panel>
  );
}

function DiscordMappings() {
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
        title="Discord role mapping"
        subtitle="The backend maps a member's Discord roles to a permission group on login."
        actions={
          <Button icon={Plus} onClick={addRow}>
            Add mapping
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
              label="Delete mapping"
              onClick={() => removeRow(m.id)}
              className="mb-0.5 hover:border-red-500/40 hover:text-red-300"
            />
          </div>
        ))}
        {mappings.length === 0 && (
          <p className="text-sm text-slate-500">No role mappings yet.</p>
        )}
      </div>
    </Panel>
  );
}

export default function AccessTab() {
  return (
    <div className="grid gap-6">
      <PermissionGroups />
      <DiscordMappings />
    </div>
  );
}
