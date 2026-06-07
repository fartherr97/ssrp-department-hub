import { Suspense, lazy, useEffect, useState, startTransition } from "react";
import useAuth from "./hooks/useAuth.js";
import { useConfig } from "./lib/configContext.jsx";
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

// Map a page's `type` to the component that renders it.
const PAGE_COMPONENTS = {
  home: Home,
  roster: Roster,
  content: ContentPage,
  builder: BuilderPortal,
};

function ViewLoading() {
  return (
    <Panel className="p-6 text-slate-400">Loading page…</Panel>
  );
}

function ActiveView({ page, user }) {
  if (!page) return <Home page={null} />;
  if (!canAccessPage(user, page)) return <AccessDenied page={page} />;

  const Component = PAGE_COMPONENTS[page.type] || ContentPage;
  return <Component page={page} user={user} />;
}

export default function App() {
  const { config, ready } = useConfig();
  const { user, checking, devLogin, logout } = useAuth();
  const [activePageId, setActivePageId] = useState(null);

  // Resolve the initial page once config is loaded.
  useEffect(() => {
    if (ready && config && activePageId == null) {
      setActivePageId(getInitialPageId(config));
    }
  }, [ready, config, activePageId]);

  useEffect(() => {
    function onPop() {
      if (config) setActivePageId(getInitialPageId(config));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [config]);

  useEffect(() => {
    if (!config || !activePageId) return;
    const desired = getPagePath(activePageId, config);
    if (window.location.pathname !== desired) {
      window.history.replaceState(null, "", desired);
    }
  }, [activePageId, config]);

  if (!ready || checking) return <LoadingScreen branding={config?.branding} />;
  if (!user) return <LoginScreen config={config} onDevLogin={devLogin} />;

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
      <Suspense fallback={<ViewLoading />}>
        <ActiveView page={page} user={user} />
      </Suspense>
    </DashboardLayout>
  );
}
