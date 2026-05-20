export default function Loading() {
  return (
    <>
      <div className="h-7 w-44 bg-ink-700/60 rounded animate-pulse mb-2" />
      <div className="h-3 w-72 bg-ink-700/40 rounded animate-pulse mb-6" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="card p-5 mb-4 max-w-2xl animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="h-4 w-28 bg-ink-700/60 rounded mb-2" />
          <div className="h-3 w-72 bg-ink-700/40 rounded mb-4" />
          <div className="space-y-3">
            <div className="h-3 w-20 bg-ink-700/40 rounded" />
            <div className="h-9 w-full bg-ink-700/60 rounded" />
            <div className="h-3 w-20 bg-ink-700/40 rounded mt-3" />
            <div className="h-16 w-full bg-ink-700/60 rounded" />
          </div>
          <div className="mt-4 flex justify-end">
            <div className="h-9 w-24 bg-accent-500/30 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}
