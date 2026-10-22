"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationFeedbackContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  return <NavigationClickIndicator key={routeKey} />;
}

function NavigationClickIndicator() {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const start = () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      setVisible(false);
      showTimer.current = setTimeout(() => setVisible(true), 120);
      safetyTimer.current = setTimeout(() => setVisible(false), 20000);
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) return;

      const link = event.target.closest("a");
      if (!link || !link.hasAttribute("href") || link.hasAttribute("download") || link.target === "_blank") return;

      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        (destination.pathname === window.location.pathname &&
          destination.search === window.location.search)
      ) return;

      start();
    };

    const onGetSubmit = (event: Event) => {
      if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
      if (event.target.method.toLowerCase() === "get") start();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onGetSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onGetSubmit);
      if (showTimer.current) clearTimeout(showTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="global-loading-indicator" role="status" aria-live="polite">
      <span className="global-loading-spinner" aria-hidden="true" />
      <span>Loading page…</span>
    </div>
  );
}

export function NavigationFeedback() {
  return (
    <Suspense fallback={null}>
      <NavigationFeedbackContent />
    </Suspense>
  );
}
