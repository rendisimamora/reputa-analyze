export default function Loading() {
  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-ink-800/60 rounded animate-pulse" />
          <div className="h-4 w-72 bg-ink-800/60 rounded animate-pulse" />
        </div>
        <div className="h-9 w-32 bg-ink-800/60 rounded animate-pulse" />
      </div>
      <div className="h-11 w-full max-w-md bg-ink-800/60 rounded-lg animate-pulse mb-6" />
      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 h-40 animate-pulse bg-ink-900/40" />
        ))}
      </div>
    </>
  );
}
