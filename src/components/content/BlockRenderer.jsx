import { ExternalLink, Info, User, ArrowRight } from "lucide-react";
import { Panel } from "../common/index.jsx";
import { getIcon } from "../../lib/icons.js";
import { safeLinkUrl, safeMediaUrl, safeEmbedUrl } from "../../lib/urls.js";

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

// Card layout (the "Quick Resources" look): each link is a tile with an icon
// on top and the label beneath, laid out in a responsive grid.
function LinkCards({ block }) {
  const items = block.items || [];
  const allUrl = safeLinkUrl(block.allUrl);
  const showAll = block.allUrl && block.allUrl !== "#";
  return (
    <Panel className="p-5">
      {(block.kicker || block.title || showAll) && (
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {block.kicker && (
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                {block.kicker}
              </div>
            )}
            {block.title && (
              <h3 className="text-lg font-semibold text-white">{block.title}</h3>
            )}
          </div>
          {showAll && (
            <a
              href={allUrl}
              target={allUrl !== "#" ? "_blank" : undefined}
              rel="noreferrer"
              className="lift inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:text-white"
            >
              {block.allLabel || "All"}
              <ArrowRight size={15} />
            </a>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
        {items.map((item) => {
          const Icon = getIcon(item.icon);
          return (
            <a
              key={item.id}
              href={safeLinkUrl(item.url)}
              target={item.url && item.url !== "#" ? "_blank" : undefined}
              rel="noreferrer"
              className="hub-card-hover lift group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[var(--color-surface-2)] p-5 text-center hover:border-[color:var(--color-border-strong)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/12 text-[var(--color-primary)] transition group-hover:bg-[color:var(--color-primary)]/20">
                <Icon size={22} />
              </span>
              <span className="text-sm font-semibold text-slate-200 group-hover:text-white">
                {item.label}
              </span>
            </a>
          );
        })}
        {items.length === 0 && (
          <p className="col-span-full text-sm text-slate-500">No links yet.</p>
        )}
      </div>
    </Panel>
  );
}

function LinksBlock({ block }) {
  if (block.layout === "cards") return <LinkCards block={block} />;
  return (
    <Panel className="p-5">
      {block.title && <h3 className="mb-3 text-lg font-semibold text-white">{block.title}</h3>}
      {/* auto-fit: links fill whatever width the block has, however many there are */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
        {(block.items || []).map((item) => (
          <a
            key={item.id}
            href={safeLinkUrl(item.url)}
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
  if (!safeMediaUrl(block.url)) return null;
  return (
    <figure>
      {block.title && <h3 className="mb-2 text-lg font-semibold text-white">{block.title}</h3>}
      <img
        src={safeMediaUrl(block.url)}
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
function youTubeId(url) {
  const m = /(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/.exec(url || "");
  return m ? m[1] : null;
}

function VideoBlock({ block }) {
  const ytId = youTubeId(block.url);
  if (!ytId && !safeMediaUrl(block.url)) return null;
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
          src={safeMediaUrl(block.url)}
          controls
          className="aspect-video w-full rounded-xl border border-white/10 bg-black"
        />
      )}
    </Panel>
  );
}

function EmbedBlock({ block }) {
  // Iframes are the most sensitive sink, https URLs only.
  if (!safeEmbedUrl(block.url)) return null;
  return (
    <Panel className="overflow-hidden p-5">
      {block.title && <h3 className="mb-3 text-lg font-semibold text-white">{block.title}</h3>}
      <iframe
        src={safeEmbedUrl(block.url)}
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
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
      {/* auto-fit: one person fills the whole block, more share it evenly */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
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

// Block widths on desktop: blocks flow left-to-right into a 6-track grid, so
// e.g. three "third" blocks share a row (Staff Hub style). Phones always stack.
const WIDTH_SPANS = {
  full: "lg:col-span-6",
  twothirds: "lg:col-span-4",
  half: "lg:col-span-3",
  third: "lg:col-span-2",
};

export default function BlockRenderer({ blocks = [] }) {
  if (!blocks.length) return null;
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-6">
      {blocks.map((block) => {
        const Block = BLOCKS[block.type] || TextBlock;
        return (
          <div key={block.id} className={`min-w-0 ${WIDTH_SPANS[block.width] || WIDTH_SPANS.full}`}>
            <Block block={block} />
          </div>
        );
      })}
    </div>
  );
}
