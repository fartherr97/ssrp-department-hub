import { Component, Suspense, lazy, useEffect, useRef, useState, startTransition } from "react";
import useAuth from "./hooks/useAuth.js";
import { useConfig } from "./lib/configContext.jsx";
import * as audit from "./lib/audit.js";
import { canAccessPage } from "./lib/permissions.js";
import { getInitialPageId, getPagePath } from "./lib/navigation.js";
import { LoadingScreen, LoginScreen } from "./components/auth/AuthScreens.jsx";
import AccessDenied from "./components/common/AccessDenied.jsx";
import { Panel } from "./components/common/index.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const Roster = lazy(() => import("./pages/Roster.jsx"));
const ContentPage = lazy(() => import("./pages/ContentPage.jsx"));
const BuilderPortal = lazy(() => import("./pages/BuilderPortal.jsx"));
const AuditLog = lazy(() => import("./pages/AuditLog.jsx"));
const AccessRoles = lazy(() => import("./pages/AccessRoles.jsx"));
const VehicleRoster = lazy(() => import("./pages/VehicleRoster.jsx"));
const CalendarPage = lazy(() => import("./pages/CalendarPage.jsx"));
const UniformRoster = lazy(() => import("./pages/UniformRoster.jsx"));
const ChainOfCommand = lazy(() => import("./pages/ChainOfCommand.jsx"));
const AdminLog = lazy(() => import("./pages/AdminLog.jsx"));
const ActivityFeed = lazy(() => import("./pages/ActivityFeed.jsx"));
const DutyHours = lazy(() => import("./pages/DutyHours.jsx"));
const HelpPage = lazy(() => import("./pages/HelpPage.jsx"));
const ExamsPage = lazy(() => import("./pages/ExamsPage.jsx"));

// Map a page's `type` to the component that renders it.
const PAGE_COMPONENTS = {
  home: Home,
  roster: Roster,
  content: ContentPage,
  builder: BuilderPortal,
  audit: AuditLog,
  access: AccessRoles,
  fleet: VehicleRoster,
  calendar: CalendarPage,
  uniforms: UniformRoster,
  chain: ChainOfCommand,
  adminlog: AdminLog,
  activity: ActivityFeed,
  hours: DutyHours,
  help: HelpPage,
  exams: ExamsPage,
};

function ViewLoading() {
  return (
    <Panel className="p-6 text-slate-400">Loading page…</Panel>
  );
}

/*
 * Catches render errors in the active page so one broken page (or a failed
 * lazy chunk load) shows a recoverable message instead of white-screening the
 * whole hub. Keyed by page id, so navigating away resets it.
 */
const isStaleChunkError = (error) =>
  /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(
    String(error?.message || error)
  );

class ViewErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Page render error:", error, info);
    // Stale deploy: the old build's lazy chunks are gone, reload once to pick
    // up the new build (cooldown prevents a loop if the deploy is broken).
    if (isStaleChunkError(error)) {
      const last = Number(sessionStorage.getItem("chunk-reload-at") || 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem("chunk-reload-at", String(Date.now()));
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.error) {
      const stale = isStaleChunkError(this.state.error);
      if (stale) {
        return (
          <Panel className="p-8 text-center">
            <div className="text-base font-semibold text-white">
              The site was just updated
            </div>
            <p className="mt-2 text-sm text-slate-400">
              A new version was deployed while this tab was open. Reload to get it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-glossy mt-4 inline-flex items-center justify-center rounded-xl bg-[linear-gradient(90deg,var(--color-primary),var(--color-hover))] px-4 py-2 text-sm font-semibold text-white"
            >
              Reload page
            </button>
          </Panel>
        );
      }
      return (
        <Panel className="p-8 text-center">
          <div className="text-base font-semibold text-white">This page hit an error</div>
          <p className="mx-auto mt-2 max-w-lg break-words font-mono text-xs text-red-300">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Your data is safe, try again, or use Undo in the Builder/Roster if a recent
            change caused this.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn-glossy mt-4 inline-flex items-center justify-center rounded-xl bg-[linear-gradient(90deg,var(--color-primary),var(--color-hover))] px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </Panel>
      );
    }
    return this.props.children;
  }
}

function ActiveView({ page, user, config }) {
  if (!page) return <Home page={null} />;
  if (!canAccessPage(user, page, config)) return <AccessDenied page={page} />;

  const Component = PAGE_COMPONENTS[page.type] || ContentPage;
  return <Component page={page} user={user} />;
}

export default function App() {
  const { config, ready, reload } = useConfig();
  const { user, checking, devLogin, logout } = useAuth();
  const [activePageId, setActivePageId] = useState(null);

  // Tell the audit log who is currently acting.
  useEffect(() => {
    audit.setActor(user);
  }, [user]);

  // The backend returns a different config view per caller (guests get a public
  // subset with no member lists or secrets; signed-in users get their full view).
  // Re-fetch whenever the signed-in identity changes so login upgrades us to the
  // full config and logout drops the sensitive data from memory. Skip the very
  // first render — the initial load already ran and useAuth is still checking.
  const lastUserId = useRef(undefined);
  useEffect(() => {
    const id = user?.id ?? null;
    if (checking) return;
    if (lastUserId.current === undefined) {
      lastUserId.current = id;
      return;
    }
    if (lastUserId.current !== id) {
      lastUserId.current = id;
      reload();
    }
  }, [user, checking, reload]);

  // Resolve the initial page once the *full* config is loaded. The pre-login
  // guest subset has no `pages`, so wait for the real config (post-auth reload)
  // before picking a landing page — otherwise we'd lock in "home" prematurely.
  useEffect(() => {
    if (ready && Array.isArray(config?.pages) && activePageId == null) {
      setActivePageId(getInitialPageId(config, user));
    }
  }, [ready, config, activePageId, user]);

  useEffect(() => {
    function onPop() {
      if (config) setActivePageId(getInitialPageId(config, user));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [config, user]);

  useEffect(() => {
    // Only meaningful once the full config (with pages) is loaded; the pre-login
    // guest subset has no pages, and reading config.pages[0] there would throw.
    if (!activePageId || !Array.isArray(config?.pages)) return;
    // Normalize the URL's *page* segment only, pages with internal tabs
    // manage the second segment themselves (e.g. /builder/branding).
    const seg = decodeURIComponent(
      window.location.pathname.replace(/^\/+/, "").split("/")[0] || ""
    );
    const matches =
      seg === activePageId || (seg === "" && activePageId === config.pages?.[0]?.id);
    if (!matches) {
      window.history.replaceState(null, "", getPagePath(activePageId, config));
    }
  }, [activePageId, config]);

  if (!ready || checking) return <LoadingScreen branding={config?.branding} />;
  if (!user) return <LoginScreen config={config} onDevLogin={devLogin} />;
  // Signed in, but the config in hand may still be the guest subset the backend
  // returns before login (it deliberately omits `pages`). Wait for the reload
  // triggered on the auth change to bring the full, authorized config.
  if (!Array.isArray(config?.pages)) return <LoadingScreen branding={config?.branding} />;

  function navigate(pageId) {
    startTransition(() => setActivePageId(pageId));
    window.history.pushState(null, "", getPagePath(pageId, config));
  }

  const page = config.pages.find((p) => p.id === activePageId) || config.pages[0];
  const activeLabel = page?.label || config.branding?.name;

  return (
    <DashboardLayout
      user={user}
      config={config}
      activePage={page?.id}
      activeLabel={activeLabel}
      onNavigate={navigate}
      onLogout={logout}
    >
      <ViewErrorBoundary key={page?.id}>
        <Suspense fallback={<ViewLoading />}>
          <ActiveView page={page} user={user} config={config} />
        </Suspense>
      </ViewErrorBoundary>
    </DashboardLayout>
  );
}
