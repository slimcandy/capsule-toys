import { describe, expect, test } from "vitest";
import { bannerHTML } from "../site/src/banner.ts";
import { models } from "../site/src/catalog.ts";

describe("banner page", () => {
  test("carries the title, rarity and credit of every model", () => {
    for (const model of models) {
      const html = bannerHTML(model);
      expect(html).toContain(`data-rarity="${model.rarity}"`);
      expect(html).toContain(model.credit.author === "Capsule Toys" ? "Made in code" : model.credit.author);
      expect(html).toContain(model.title.replace("'", "'"));
    }
  });

  test("escapes HTML in titles", () => {
    const html = bannerHTML({ ...models[0], title: `Tom & Jerry's "<b>"` });
    expect(html).toContain("Tom &amp; Jerry's &quot;&lt;b&gt;&quot;");
    expect(html).not.toContain("<b>");
  });

  test("runs no scripts", () => {
    for (const model of models) expect(bannerHTML(model)).not.toMatch(/<script|onclick|javascript:/i);
  });
});
