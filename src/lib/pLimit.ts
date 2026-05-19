/**
 * Tiny concurrency limiter — drop-in replacement for `p-limit`.
 * Avoids p-limit v5's `#async_hooks` subpath import which breaks Next.js webpack.
 *
 * Usage:
 *   const limit = pLimit(4);
 *   await Promise.all(items.map(x => limit(() => doWork(x))));
 */
export function pLimit(concurrency: number) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`pLimit: concurrency must be a positive integer, got ${concurrency}`);
  }

  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    active = Math.max(0, active - 1);
    const fn = queue.shift();
    if (fn) fn();
  };

  return function run<T>(fn: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const exec = () => {
        active++;
        Promise.resolve()
          .then(() => fn())
          .then(
            (v) => { resolve(v); next(); },
            (e) => { reject(e); next(); },
          );
      };
      if (active < concurrency) exec();
      else queue.push(exec);
    });
  };
}

export default pLimit;
