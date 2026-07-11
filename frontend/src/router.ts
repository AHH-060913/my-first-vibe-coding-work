import { useEffect, useState } from "react";

if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

export type Section = "overview" | "sectors" | "stocks" | "compare" | "rankings" | "news" | "predictions" | "watchlist";

export interface AppRoute {
  section: Section | "stock-detail";
  code?: string;
  market?: string;
}

const sections = new Set<Section>(["overview", "sectors", "stocks", "compare", "rankings", "news", "predictions", "watchlist"]);

export function parseHash(hash = window.location.hash): AppRoute {
  const path = hash.replace(/^#\/?/, "").split("?")[0];
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "stock" && parts[2]) {
    return { section: "stock-detail", market: parts[1].toUpperCase(), code: parts[2] };
  }
  const section = parts[0] as Section;
  return { section: sections.has(section) ? section : "overview" };
}

export function useHashRoute() {
  const [route, setRoute] = useState<AppRoute>(() => parseHash());
  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, "", "#/overview");
    const handleHash = () => {
      setRoute(parseHash());
      resetScroll();
    };
    window.addEventListener("hashchange", handleHash);
    resetScroll();
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);
  return route;
}

function resetScroll() {
  const scroll = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  scroll();
  window.requestAnimationFrame(scroll);
  window.setTimeout(scroll, 80);
}

export function navigate(path: string) {
  const target = path.startsWith("#") ? path : `#/${path.replace(/^\//, "")}`;
  if (window.location.hash === target) return;
  const update = () => {
    window.location.hash = target;
  };
  const documentWithTransitions = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && documentWithTransitions.startViewTransition) {
    documentWithTransitions.startViewTransition(update);
  } else {
    update();
  }
}
