import AppShell from '@/components/AppShell';

/**
 * Layout that wraps all /projects/* routes.
 * AppShell mounts here ONCE — navigating between Dashboard / Mentions / Alerts /
 * Report / Crawl Logs keeps the sidebar (and its project list) intact instead of
 * re-fetching on every page transition.
 */
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
