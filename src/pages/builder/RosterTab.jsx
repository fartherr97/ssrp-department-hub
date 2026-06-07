import { Plus, Trash2 } from "lucide-react";
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
  const ranks = config.roster.ranks || [];

  return (
    <div className="grid gap-6">
      <Panel className="p-5">
        <SectionHeader
          title="Member columns"
          subtitle="Custom fields captured for every roster member."
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
          {fields.length === 0 && (
            <p className="text-sm text-slate-500">No custom columns yet.</p>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader
          title="Ranks"
          subtitle="The sections of the roster. Members are added on the Roster page."
          actions={
            <Button icon={Plus} onClick={() => mutate(R.addRank(config, { name: "New Rank" }))}>
              Add rank
            </Button>
          }
        />
        <div className="grid gap-2">
          {ranks.map((rank) => (
            <div
              key={rank.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3"
            >
              <input
                type="color"
                value={rank.color || "#3b82f6"}
                onChange={(e) => mutate(R.updateRank(config, rank.id, { color: e.target.value }))}
                className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent"
              />
              <Input
                value={rank.name}
                onChange={(e) => mutate(R.updateRank(config, rank.id, { name: e.target.value }))}
                className="flex-1"
              />
              <span className="text-xs text-slate-500">{rank.members.length} member(s)</span>
              <IconButton
                icon={Trash2}
                label="Delete rank"
                onClick={() => mutate(R.deleteRank(config, rank.id))}
                className="hover:border-red-500/40 hover:text-red-300"
              />
            </div>
          ))}
          {ranks.length === 0 && <p className="text-sm text-slate-500">No ranks yet.</p>}
        </div>
      </Panel>
    </div>
  );
}
