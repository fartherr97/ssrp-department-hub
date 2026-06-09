import { useRef, useState } from "react";
import { Download, Upload, RotateCcw, FileUp } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import useToast from "../../hooks/useToast.js";
import {
  Panel,
  SectionHeader,
  Button,
  Textarea,
  ConfirmDialog,
  Toast,
} from "../../components/common/index.jsx";
import TabIntro from "./TabIntro.jsx";

export default function AdvancedTab() {
  const { config, replaceConfig, resetConfig } = useConfig();
  const { toast, show } = useToast();
  const [importText, setImportText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef(null);

  function exportConfig() {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(config.branding?.shortName || "department-hub").toLowerCase().replace(/\s+/g, "-")}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
    show("Backup downloaded");
  }

  function importConfig(text) {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !parsed.branding) {
        throw new Error("That file doesn't look like a hub backup");
      }
      replaceConfig(parsed);
      setImportText("");
      show("Backup restored");
    } catch (e) {
      show(e.message || "That file couldn't be read", "error");
    }
  }

  function onFilePicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importConfig(String(reader.result));
    reader.readAsText(file);
    e.target.value = ""; // allow re-picking the same file
  }

  return (
    <div className="grid gap-6">
      <Toast message={toast} />

      <TabIntro>
        Think of this tab as your <strong className="text-white">safety net</strong>. Download
        a backup before making big changes — if anything goes wrong, you can restore it here
        and everything comes back exactly as it was.
      </TabIntro>

      <Panel className="p-5">
        <SectionHeader
          title="Download a backup"
          subtitle="Saves your entire setup — branding, pages, roster, everything — as a single file on your computer. Also handy for copying a setup to another department."
        />
        <Button icon={Download} onClick={exportConfig}>
          Download backup
        </Button>
      </Panel>

      <Panel className="p-5">
        <SectionHeader
          title="Restore a backup"
          subtitle="Pick a backup file you downloaded earlier. This replaces the current setup with everything in the backup."
        />
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={onFilePicked}
          className="hidden"
        />
        <Button icon={FileUp} onClick={() => fileRef.current?.click()}>
          Choose backup file…
        </Button>

        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
          <summary className="cursor-pointer select-none text-xs font-bold uppercase tracking-[0.4px] text-cad-muted">
            Advanced — paste backup text instead
          </summary>
          <div className="mt-3">
            <Textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{ "branding": { … }, "pages": [ … ] }'
              className="font-mono text-xs"
            />
            <div className="mt-3">
              <Button
                icon={Upload}
                onClick={() => importConfig(importText)}
                disabled={!importText.trim()}
              >
                Restore from pasted text
              </Button>
            </div>
          </div>
        </details>
      </Panel>

      <Panel className="border-red-500/20 p-5">
        <SectionHeader
          title="Start over from scratch"
          subtitle="Wipes all branding, pages, and roster data and restores the blank template. Download a backup first — this can't be undone."
        />
        <Button variant="danger" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
          Reset everything
        </Button>
      </Panel>

      <ConfirmDialog
        open={confirmReset}
        title="Reset to blank template?"
        message="This permanently clears all configuration and roster data for this department. There is no undo — make sure you've downloaded a backup if you might want this setup back."
        confirmLabel="Reset everything"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          await resetConfig();
          setConfirmReset(false);
          show("Reset to blank template");
        }}
      />
    </div>
  );
}
