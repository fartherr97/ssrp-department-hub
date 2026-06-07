import { FileText } from "lucide-react";
import { PageHeader, EmptyState } from "../components/common/index.jsx";
import BlockRenderer from "../components/content/BlockRenderer.jsx";

/*
 * Generic content page. Departments fill these with blocks (text, callouts,
 * link lists) from the Builder Portal. Any number of these pages can exist.
 */
export default function ContentPage({ page }) {
  const cfg = page?.config || {};
  const blocks = cfg.blocks || [];

  return (
    <div>
      <PageHeader
        kicker={cfg.heroKicker}
        title={cfg.heroTitle || page?.label}
        subtitle={cfg.heroSubtitle}
      />
      {blocks.length ? (
        <BlockRenderer blocks={blocks} />
      ) : (
        <EmptyState
          icon={FileText}
          title="This page is empty"
          subtitle="Add content blocks to this page from the Builder Portal."
        />
      )}
    </div>
  );
}
