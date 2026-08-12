"use client";

import { usePathname } from "next/navigation";

// Keying on pathname remounts the wrapper on every route change, which
// re-fires the `animate-fade-up` CSS animation. The shell layout itself is
// preserved by Next.js across navigations, so without a key the children
// would simply swap in with no transition.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-up">
      {children}
    </div>
  );
}
