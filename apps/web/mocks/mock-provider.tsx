"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Starts the MSW browser worker in development when the mock flag is set, then
 * renders its children once the worker is intercepting.
 *
 * The gate is written **inline on purpose**: `next build` sets
 * `NODE_ENV=production` and inlines `NEXT_PUBLIC_*`, so the whole branch folds
 * to `false` and webpack strips the dynamic `import("./browser")` (and MSW with
 * it) from the production bundle. Do not hoist this into a shared helper/const —
 * that defeats the dead-code elimination and ships MSW to prod. The
 * `NEXT_PUBLIC_` flag alone is not enough (it is inlined but does not remove
 * code); both conditions are required.
 *
 * Children are held back until `worker.start()` resolves so the worker is
 * intercepting before the first fetch (AuthInitializer's getConfig/getMe fire
 * immediately on mount).
 */
export function MockProvider({ children }: { children: ReactNode }) {
  const enabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ATB_MOCK_API === "1";

  // When disabled, mount children immediately with zero overhead.
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void import("./browser").then(({ worker }) =>
      worker.start({ onUnhandledRequest: "warn" }).then(() => {
        if (!cancelled) setReady(true);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!ready) return null;
  return <>{children}</>;
}
