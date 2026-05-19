'use client';

/**
 * Skeleton loading state that mirrors the real dashboard layout.
 * Uses Tailwind's animate-pulse + staggered delays for a polished shimmer feel.
 */

function Bar({ className = '' }: { className?: string }) {
  return <div className={`bg-ink-700/60 rounded ${className}`} />;
}

function Card({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

function StatSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card className="animate-pulse" >
      <div style={{ animationDelay: `${delay}ms` }}>
        <Bar className="h-3 w-24" />
        <Bar className="h-9 w-20 mt-3" />
        <Bar className="h-3 w-16 mt-2" />
      </div>
    </Card>
  );
}

function ChartSkeleton({ height = 240 }: { height?: number }) {
  // Animated bars with varied heights for a chart-like look
  const heights = [40, 65, 30, 80, 55, 90, 45, 70, 35, 60, 75, 50];
  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-2">
        {heights.map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gradient-to-t from-accent-500/20 to-accent-500/5 rounded-t animate-pulse"
            style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-xs text-ink-400 bg-ink-900/80 px-3 py-1 rounded-full border border-ink-700">
          Mengambil data…
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-2 flex-1">
          <Bar className="h-7 w-64 animate-pulse" />
          <Bar className="h-3 w-96 animate-pulse" style={{ animationDelay: '100ms' }} />
          <Bar className="h-3 w-40 animate-pulse" style={{ animationDelay: '200ms' }} />
        </div>
        <div className="h-9 w-28 bg-accent-500/30 rounded-lg animate-pulse" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-accent-500/20 shadow-glow animate-pulse">
          <Bar className="h-3 w-28" />
          <Bar className="h-10 w-16 mt-3" />
          <Bar className="h-3 w-20 mt-2" />
        </Card>
        <StatSkeleton delay={80} />
        <StatSkeleton delay={160} />
        <StatSkeleton delay={240} />
      </div>

      {/* AI summary card */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded bg-accent-500/30 animate-pulse" />
          <Bar className="h-3 w-32 animate-pulse" />
        </div>
        <div className="space-y-2">
          <Bar className="h-3 w-full animate-pulse" />
          <Bar className="h-3 w-11/12 animate-pulse" style={{ animationDelay: '100ms' }} />
          <Bar className="h-3 w-9/12 animate-pulse" style={{ animationDelay: '200ms' }} />
        </div>
      </Card>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <Bar className="h-4 w-36 animate-pulse" />
            <div className="w-3.5 h-3.5 rounded bg-ink-700 animate-pulse" />
          </div>
          <ChartSkeleton height={240} />
        </Card>
        <Card>
          <Bar className="h-4 w-28 mb-3 animate-pulse" />
          <div className="relative h-[220px] grid place-items-center">
            <div className="w-32 h-32 rounded-full border-[14px] border-ink-700/60 animate-pulse" />
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-3">
              <Bar className="h-3 w-14 animate-pulse" />
              <Bar className="h-3 w-14 animate-pulse" style={{ animationDelay: '120ms' }} />
              <Bar className="h-3 w-14 animate-pulse" style={{ animationDelay: '240ms' }} />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <Bar className="h-4 w-32 mb-3 animate-pulse" />
          <ChartSkeleton height={200} />
        </Card>
        <Card>
          <Bar className="h-4 w-36 mb-3 animate-pulse" />
          <div className="space-y-2">
            {[60, 80, 50, 70, 45, 65, 55, 40].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <Bar className="h-3 w-16 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                <div className="flex-1 h-2 rounded bg-accent-500/15 animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 50}ms` }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {[0, 1].map((j) => (
          <Card key={j}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3.5 h-3.5 rounded bg-ink-700 animate-pulse" />
              <Bar className="h-3 w-32 animate-pulse" />
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between py-1 border-b border-ink-800 last:border-0">
                  <Bar className="h-3 w-40 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                  <Bar className="h-3 w-8 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <Bar className="h-4 w-44 mb-3 animate-pulse" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-ink-800 last:border-0">
                <Bar className="h-3 w-20 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                <div className="h-4 w-10 rounded-full bg-ink-700 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                <Bar className="h-3 w-6 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                <Bar className="h-3 flex-1 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <Bar className="h-4 w-36 mb-3 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Bar className="h-3 w-16 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  <Bar className="h-3 w-20 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  <div className="h-4 w-14 rounded-full bg-ink-700 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                </div>
                <Bar className="h-3 w-full animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                <Bar className="h-3 w-4/5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
