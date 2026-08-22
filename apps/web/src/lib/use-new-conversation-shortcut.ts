"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isNewConversationShortcut, requestNewConversation } from "./new-conversation";

export function useNewConversationShortcut() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || !isNewConversationShortcut(event)) return;
      event.preventDefault();
      requestNewConversation();
      router.push("/");
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [router]);
}
