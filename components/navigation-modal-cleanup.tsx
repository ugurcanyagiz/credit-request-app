"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export const MODAL_NAVIGATION_CLEANUP_EVENT = "credit-request:modal-navigation-cleanup";

function resetElementInteractionState(element: HTMLElement) {
  element.inert = false;
  element.removeAttribute("inert");
  element.removeAttribute("aria-hidden");
  element.style.overflow = "";
  element.style.pointerEvents = "";
  element.style.position = "";
}

export function cleanupDocumentInteractionState() {
  resetElementInteractionState(document.documentElement);
  resetElementInteractionState(document.body);
  document.body.classList.remove("modal-open", "overflow-hidden");

  const rootElement = document.getElementById("__next") ?? document.body.firstElementChild;
  if (rootElement instanceof HTMLElement) {
    resetElementInteractionState(rootElement);
  }
}

function requestModalStateReset() {
  window.dispatchEvent(new Event(MODAL_NAVIGATION_CLEANUP_EVENT));
  cleanupDocumentInteractionState();
}

export function NavigationModalCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    requestModalStateReset();
  }, [pathname]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      // Mobile browsers can restore a stale DOM from bfcache. Always clean up,
      // with event.persisted covering the back-forward cache case explicitly.
      if (event.persisted) {
        requestModalStateReset();
        return;
      }

      requestModalStateReset();
    }

    function handlePopState() {
      requestModalStateReset();
    }

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
      cleanupDocumentInteractionState();
    };
  }, []);

  return null;
}
