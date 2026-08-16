import { describe, expect, it } from "vitest";
import { tabFromPathname, tabHref } from "@/lib/moby-navigation";

describe("canonical Moby navigation", () => {
  it.each([
    ["discover", "/"],
    ["whales", "/feeds"],
    ["signals", "/signals"],
    ["portfolio", "/leaderboard"],
    ["profile", "/profile"],
  ] as const)("maps %s to %s and back", (tab, href) => {
    expect(tabHref(tab)).toBe(href);
    expect(tabFromPathname(href)).toBe(tab);
  });

  it("recognizes legacy aliases", () => {
    expect(tabFromPathname("/whales")).toBe("whales");
    expect(tabFromPathname("/portfolio")).toBe("portfolio");
  });
});
