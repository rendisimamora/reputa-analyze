import AppShell from '@/components/AppShell';
import { RouteProgress } from '@/components/RouteProgress';

/**
 * Layout wraps all /projects/* routes.
 * AppShell + RouteProgress mount ONCE — navigating between Dashboard / Mentions /
 * Alerts / Report / Crawl Logs keeps the sidebar intact and only swaps the
 * right-side content. A top progress bar appears during the transition so the
 * user gets immediate visual feedback (SPA / PWA feel).
 */
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteProgress />
      <AppShell>{children}</AppShell>
    </>
  );
}
