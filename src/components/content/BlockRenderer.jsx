import { ExternalLink, Info, User } from "lucide-react";
import { Panel } from "../common/index.jsx";

/*
 * Renders the content blocks stored on a page's config.blocks array.
 * Block types: text | callout | links | image | video | embed | columns |
 * spotlight. Add new types here and in the Builder Portal's block editor to
 * extend what departments can drop onto a page.
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

function ImageBlock({ block }) {
  if (!block.url) return null;
  return (
    <figure>
      {block.title && <h3 className="mb-2 text-lg font-semibold text-white">{block.title}</h3>}
      <img
        src={block.url}
        alt={block.caption || block.title || ""}
        className="w-full rounded-2xl border border-white/10 object-cover"
      />
      {block.caption && (
        <figcaption className="mt-2 text-center text-xs text-slate-500">{block.caption}</figcaption>
      )}
    </figure>
  );
}

// Pull the video id out of any common YouTube link shape.
export function youTubeId(url) {
  const m = /(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/.exec(url || "");
  return m ? m[1] : null;
}

function VideoBlock({ block }) {
  if (!block.url) return null;
  const ytId = youTubeId(block.url);
  return (
    <Panel className="overflow-hidden p-5">
      {block.title && <h3 className="mb-3 text-lg font-semibold text-white">{block.title}</h3>}
      {ytId ? (
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          title={block.title || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full rounded-xl border border-white/10"
        />
      ) : (
        <video
          src={block.url}
          controls
          className="aspect-video w-full rounded-xl border border-white/10 bg-black"
        />
      )}
    </Panel>
  );
}

function EmbedBlock({ block }) {
  if (!block.url) return null;
  return (
    <Panel className="overflow-hidden p-5">
      {block.title && <h3 className="mb-3 text-lg font-semibold text-white">{block.title}</h3>}
      <iframe
        src={block.url}
        title={block.title || "Embedded content"}
        className="w-full rounded-xl border border-white/10 bg-white/5"
        style={{ height: Number(block.height) || 480 }}
        allowFullScreen
      />
    </Panel>
  );
}

function ColumnsBlock({ block }) {
  return (
    <Panel className="p-5">
      {block.title && <h3 className="mb-3 text-lg font-semibold text-white">{block.title}</h3>}
      <div className="grid gap-5 sm:grid-cols-2">
        {[block.left, block.right].map((body, i) => (
          <p key={i} className="whitespace-pre-line text-sm leading-7 text-[var(--color-text-muted)]">
            {body}
          </p>
        ))}
      </div>
    </Panel>
  );
}

function SpotlightBlock({ block }) {
  const people = block.items || [];
  return (
    <Panel className="p-5">
      {block.title && <h3 className="mb-3 text-lg font-semibold text-white">{block.title}</h3>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-4 text-center"
          >
            {p.photoUrl ? (
              <img
                src={p.photoUrl}
                alt={p.name}
                className="mx-auto h-16 w-16 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-primary)]/15 text-[var(--color-primary)]">
                <User size={26} />
              </span>
            )}
            <div className="mt-3 text-sm font-bold text-white">{p.name || "Unnamed"}</div>
            {p.role && (
              <div className="text-xs font-semibold text-[var(--color-primary)]">{p.role}</div>
            )}
            {p.blurb && (
              <p className="mt-2 whitespace-pre-line text-xs leading-5 text-slate-400">{p.blurb}</p>
            )}
          </div>
        ))}
        {people.length === 0 && <p className="text-sm text-slate-500">No people yet.</p>}
      </div>
    </Panel>
  );
}

const BLOCKS = {
  text: TextBlock,
  callout: CalloutBlock,
  links: LinksBlock,
  image: ImageBlock,
  video: VideoBlock,
  embed: EmbedBlock,
  columns: ColumnsBlock,
  spotlight: SpotlightBlock,
};

export default function BlockRenderer({ blocks = [] }) {
  if (!blocks.length) return null;
  return (
    <div className="grid gap-4">
      {blocks.map((block) => {
        const Block = BLOCKS[block.type] || TextBlock;
        return <Block key={block.id} block={block} />;
      })}
    </div>
  );
}
