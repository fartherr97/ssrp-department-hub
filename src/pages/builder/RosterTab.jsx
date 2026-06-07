import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import {
  Panel,
  SectionHeader,
  Button,
  IconButton,
  Field,
  Input,
  Select,
} from "../../components/common/index.jsx";
import * as R from "../../lib/roster.js";

export default function RosterTab() {
  const { config, mutate } = useConfig();
  const fields = config.roster.memberFields || [];
  const subdivisions = config.roster.subdivisions || [];

  return (
    <div className="grid gap-6">
      <Panel className="p-5">
        <SectionHeader
          title="Subdivisions"
          subtitle="Each subdivision is a separate roster tab (e.g. Patrol, K9, Traffic). Ranks and members are managed on the Roster page."
          actions={
            <Button icon={Plus} onClick={() => mutate(R.addSubdivision(config, { name: "New Subdivision" }))}>
              Add subdivision
            </Button>
          }
        />
        <div className="grid gap-2">
          {subdivisions.map((s, idx) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3"
            >
              <Input
                value={s.name}
                onChange={(e) => mutate(R.updateSubdivision(config, s.id, { name: e.target.value }))}
                className="flex-1"
              />
              <span className="shrink-0 text-xs text-slate-500">
                {s.ranks.length} rank(s) ·{" "}
                {s.ranks.reduce((n, r) => n + r.members.length, 0)} member(s)
              </span>
              <IconButton
                icon={ChevronUp}
                label="Move up"
                disabled={idx === 0}
                onClick={() => mutate(R.moveSubdivision(config, s.id, -1))}
                className="disabled:opacity-30"
              />
              <IconButton
                icon={ChevronDown}
                label="Move down"
                disabled={idx === subdivisions.length - 1}
                onClick={() => mutate(R.moveSubdivision(config, s.id, 1))}
                className="disabled:opacity-30"
              />
              <IconButton
                icon={Trash2}
                label="Delete subdivision"
                disabled={subdivisions.length <= 1}
                onClick={() => mutate(R.deleteSubdivision(config, s.id))}
                className="hover:border-red-500/40 hover:text-red-300 disabled:opacity-30"
              />
            </div>
          ))}
          {subdivisions.length === 0 && (
            <p className="text-sm text-slate-500">No subdivisions yet.</p>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader
          title="Member columns"
          subtitle="Custom fields captured for every member, shared across all subdivisions."
          actions={
            <Button
              icon={Plus}
              onClick={() => mutate(R.addMemberField(config, { label: "New Field", type: "text" }))}
            >
              Add column
            </Button>
          }
        />
        <div className="grid gap-3">
          {fields.map((f) => (
            <div
              key={f.id}
              className="grid grid-cols-1 items-end gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3 sm:grid-cols-[1fr_140px_auto]"
            >
              <Field label="Label">
                <Input
                  value={f.label}
                  onChange={(e) => mutate(R.updateMemberField(config, f.id, { label: e.target.value }))}
                />
              </Field>
              <Field label="Type">
                <Select
                  value={f.type}
                  onChange={(e) => mutate(R.updateMemberField(config, f.id, { type: e.target.value }))}
                >
                  <option value="text">Text</option>
                  <option value="select">Dropdown</option>
                  <option value="date">Date</option>
                </Select>
              </Field>
              <IconButton
                icon={Trash2}
                label="Delete column"
                onClick={() => mutate(R.deleteMemberField(config, f.id))}
                className="mb-0.5 hover:border-red-500/40 hover:text-red-300"
              />
              {f.type === "select" && (
                <div className="sm:col-span-3">
                  <Field label="Options (comma separated)">
                    <Input
                      value={(f.options || []).join(", ")}
                      onChange={(e) =>
                        mutate(
                          R.updateMemberField(config, f.id, {
                            options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        )
                      }
                    />
                  </Field>
                </div>
              )}
            </div>
          ))}
          {fields.length === 0 && <p className="text-sm text-slate-500">No custom columns yet.</p>}
        </div>
      </Panel>
    </div>
  );
}
