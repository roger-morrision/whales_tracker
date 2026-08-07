import type { TabKey } from "./moby-store";

export const TAB_PATHS: Record<TabKey, string> = {
  discover: "/",
  whales: "/feeds",
  signals: "/signals",
  portfolio: "/leaderboard",
  profile: "/profile",
};

export function tabHref(tab: TabKey): string {
  return TAB_PATHS[tab];
}

export function tabFromPathname(pathname: string | null | undefined): TabKey {
  switch (pathname) {
    case "/feeds":
    case "/whales":
      return "whales";
    case "/signals":
      return "signals";
    case "/leaderboard":
    case "/portfolio":
      return "portfolio";
    case "/profile":
      return "profile";
    default:
      return "discover";
  }
}
