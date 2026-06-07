import { useState } from "react";
import { Download, Upload, RotateCcw } from "lucide-react";
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

export default function AdvancedTab() {
  const { config, replaceConfig, resetConfig } = useConfig();
  const { toast, show } = useToast();
  const [importText, setImportText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  function exportConfig() {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(config.branding?.shortName || "department-hub").toLowerCase().replace(/\s+/g, "-")}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
    show("Config exported");
  }

  function importConfig() {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed || typeof parsed !== "object" || !parsed.branding) {
        throw new Error("Not a valid hub config");
      }
      replaceConfig(parsed);
      setImportText("");
      show("Config imported");
    } catch (e) {
      show(e.message || "Invalid JSON", "error");
    }
  }

  return (
    <div className="grid gap-6">
      <Toast message={toast} />

      <Panel className="p-5">
        <SectionHeader
          title="Export configuration"
          subtitle="Download this department's full config as JSON — useful for backups or cloning to another department."
        />
        <Button icon={Download} onClick={exportConfig}>
          Export config.json
        </Button>
      </Panel>

      <Panel className="p-5">
        <SectionHeader
          title="Import configuration"
          subtitle="Paste a previously exported config to replace the current one."
        />
        <Textarea
          rows={6}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='{ "branding": { … }, "pages": [ … ] }'
          className="font-mono text-xs"
        />
        <div className="mt-3">
          <Button icon={Upload} onClick={importConfig} disabled={!importText.trim()}>
            Import &amp; replace
          </Button>
        </div>
      </Panel>

      <Panel className="border-red-500/20 p-5">
        <SectionHeader
          title="Reset to blank template"
          subtitle="Wipes all branding, pages, and roster data and restores the default boilerplate. This can't be undone."
        />
        <Button variant="danger" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
          Reset everything
        </Button>
      </Panel>

      <ConfirmDialog
        open={confirmReset}
        title="Reset to blank template?"
        message="This permanently clears all configuration and roster data for this department. There is no undo."
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
