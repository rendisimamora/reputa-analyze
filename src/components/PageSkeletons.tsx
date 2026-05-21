'use client';

/**
 * Generic skeleton fragments used by `loading.tsx` Suspense boundaries.
 * These render INSTANTLY on route transition (no JS exec, no fetch yet) — that's
 * what gives the app its SPA-like feel.
 */

function Bar({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`bg-ink-700/60 rounded ${className}`} style={style} />;
}

function Card({ children, className = '', style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`card p-4 ${className}`} style={style}>{children}</div>;
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex items-start justify-between mb-6 animate-pulse">
      <div className="space-y-2">
        <Bar className="h-6 w-44" />
        <Bar className="h-3 w-64" />
      </div>
      <Bar className="h-9 w-28 bg-accent-500/30" />
    </div>
  );
}

export function MentionsTableSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <Card className="mb-4 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-2.5 w-16" />
              <Bar className="h-9 w-full bg-ink-800/60" />
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dt w-full">
            <thead>
              <tr>
                <th>Date</th><th>Source</th><th>Title</th>
                <th>Sentiment</th><th>Score</th><th>Emotion</th>
                <th>Method</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <tr key={i} className="animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
                  <td><Bar className="h-3 w-20" /></td>
                  <td><Bar className="h-3 w-20" /></td>
                  <td><Bar className="h-3 w-72" /><Bar className="h-2.5 w-56 mt-1 bg-ink-700/40" /></td>
                  <td><Bar className="h-4 w-16 rounded-full" /></td>
                  <td><Bar className="h-3 w-8" /></td>
                  <td><Bar className="h-3 w-14" /></td>
                  <td><Bar className="h-3 w-12" /></td>
                  <td><Bar className="h-4 w-12 rounded-full" /></td>
                  <td><Bar className="h-3 w-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function AlertsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} className="flex items-start gap-3 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="w-2.5 h-2.5 rounded-full bg-ink-700 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Bar className="h-4 w-48" />
                <Bar className="h-4 w-16 rounded-full" />
                <Bar className="h-4 w-12 rounded-full" />
              </div>
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-2/3" />
              <Bar className="h-2.5 w-32 bg-ink-700/40" />
            </div>
            <Bar className="h-7 w-14 bg-ink-700/40 shrink-0" />
          </Card>
        ))}
      </div>
    </>
  );
}

export function CrawlLogsSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dt w-full">
            <thead>
              <tr>
                <th>Time</th><th>Source</th><th>Method</th><th>Status</th>
                <th>HTTP</th><th>Duration</th><th>URL</th><th>Message</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }).map((_, i) => (
                <tr key={i} className="animate-pulse" style={{ animationDelay: `${i * 40}ms` }}>
                  <td><Bar className="h-3 w-24" /></td>
                  <td><Bar className="h-3 w-20" /></td>
                  <td><Bar className="h-3 w-12" /></td>
                  <td><Bar className="h-4 w-14 rounded-full" /></td>
                  <td><Bar className="h-3 w-8" /></td>
                  <td><Bar className="h-3 w-12" /></td>
                  <td><Bar className="h-3 w-48" /></td>
                  <td><Bar className="h-3 w-32" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function ReportSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <Card className="mb-5 animate-pulse">
        <Bar className="h-3 w-20 mb-2" />
        <Bar className="h-6 w-64 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-3 w-16" />
              <Bar className="h-7 w-12" />
              <Bar className="h-3 w-10" />
            </div>
          ))}
        </div>
      </Card>
      <Card className="mb-5 animate-pulse">
        <Bar className="h-4 w-40 mb-3" />
        <Bar className="h-3 w-full mb-1" />
        <Bar className="h-3 w-11/12 mb-1" />
        <Bar className="h-3 w-9/12" />
      </Card>
      <Card className="animate-pulse">
        <Bar className="h-4 w-44 mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5 border-b border-ink-800 pb-2 last:border-0">
              <div className="flex gap-2">
                <Bar className="h-3 w-20" />
                <Bar className="h-3 w-24" />
                <Bar className="h-4 w-14 rounded-full" />
              </div>
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
