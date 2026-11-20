import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("shows the copyright notice in a footer", () => {
    const html = renderToStaticMarkup(<SiteFooter />);

    expect(html).toMatch(/^<footer/);
    expect(html).toContain("© 2026 Cadence. All rights reserved.");
  });
});
