"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

// Next's App Router has no route-change-start/end events to hook a real loading state
// off of (navigations are usually near-instant since target pages are prefetched) — this
// shows a brief CYCLO-branded flash on every pathname change instead, giving navigation a
// consistent, intentional feel rather than an abrupt cut, without pretending to track a
// load duration that isn't actually meaningful here.
const FLASH_MS = 260;

export function PageTransitionOverlay() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-[#1B3E41] transition-opacity duration-150 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <Image
        src="/brand/cyclo-logo-dark.png"
        alt=""
        width={120}
        height={35}
        className={`h-auto w-[120px] transition-transform duration-300 ${visible ? "scale-100" : "scale-90"}`}
      />
    </div>
  );
}
