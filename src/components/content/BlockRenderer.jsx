import { ExternalLink, Info } from "lucide-react";
import { Panel } from "../common/index.jsx";

/*
 * Renders the content blocks stored on a page's config.blocks array.
 * Block types: text | callout | links. Add new types here and in the Builder
 * Portal's block editor to extend what departments can drop onto a page.
 */

function TextBlock({ block }) {
  return (
    <Panel className="p-5">
      {block.title && <h3 className="mb-2 text-lg font-semibold text-white">{block.title}</h3>}
      <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text-muted)]">
        {block.body}
      </p>
    </Panel>
  );
}

function CalloutBlock({ block }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-primary)]/8 p-5">
      <Info size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
      <div>
        {block.title && (
          <div className="mb-1 font-semibold text-white">{block.title}</div>
        )}
        <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text-muted)]">
          {block.body}
        </p>
      </div>
    </div>
  );
}

function LinksBlock({ block }) {
  return (
    <Panel className="p-5">
      {block.title && <h3 className="mb-3 text-lg font-semibold text-white">{block.title}</h3>}
      <div className="grid gap-2 sm:grid-cols-2">
        {(block.items || []).map((item) => (
          <a
            key={item.id}
            href={item.url || "#"}
            target={item.url && item.url !== "#" ? "_blank" : undefined}
            rel="noreferrer"
            className="lift flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-4 py-3 text-sm font-medium text-slate-200 hover:border-[color:var(--color-border-strong)] hover:text-white"
          >
            <span className="truncate">{item.label}</span>
            <ExternalLink size={15} className="shrink-0 text-slate-500" />
          </a>
        ))}
        {(!block.items || block.items.length === 0) && (
          <p className="text-sm text-slate-500">No links yet.</p>
        )}
      </div>
    </Panel>
  );
}

export default function BlockRenderer({ blocks = [] }) {
  if (!blocks.length) return null;
  return (
    <div className="grid gap-4">
      {blocks.map((block) => {
        switch (block.type) {
          case "callout":
            return <CalloutBlock key={block.id} block={block} />;
          case "links":
            return <LinksBlock key={block.id} block={block} />;
          case "text":
          default:
            return <TextBlock key={block.id} block={block} />;
        }
      })}
    </div>
  );
}
