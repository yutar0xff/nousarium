"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const PATHNAME_CHANGED = "nousarium:pathname-changed";

export function replaceConversationPath(conversationId: string) {
  window.history.replaceState(null, "", `/c/${conversationId}`);
  window.dispatchEvent(new Event(PATHNAME_CHANGED));
}

export function useEffectivePathname(): string {
  const pathname = usePathname();
  const [effective, setEffective] = useState(pathname);

  useEffect(() => {
    setEffective(pathname);
  }, [pathname]);

  useEffect(() => {
    function sync() {
      setEffective(window.location.pathname);
    }
    window.addEventListener("popstate", sync);
    window.addEventListener(PATHNAME_CHANGED, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(PATHNAME_CHANGED, sync);
    };
  }, []);

  return effective;
}
