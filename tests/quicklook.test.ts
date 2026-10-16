import { describe, expect, test } from "vitest";
import { arLink } from "../site/src/quicklook.ts";

describe("arLink", () => {
  test("no options: just the file", () => {
    expect(arLink("/models/crown.usdz")).toEqual({ href: "/models/crown.usdz", warnings: [] });
  });

  test("encodes text the way Apple's example does", () => {
    const { href, warnings } = arLink("/models/crown.usdz", {
      callToAction: "Add to cart",
      checkoutTitle: "Biplane Toy",
      checkoutSubtitle: "Rustic finish with rotating propeller",
      price: "$15",
    });
    expect(href).toBe(
      "/models/crown.usdz#callToAction=Add%20to%20cart&checkoutTitle=Biplane%20Toy" +
        "&checkoutSubtitle=Rustic%20finish%20with%20rotating%20propeller&price=%2415",
    );
    expect(warnings).toEqual([]);
  });

  test("an Apple Pay button wins over custom text", () => {
    const { href, warnings } = arLink("a.usdz", { applePayButtonType: "buy", callToAction: "Catch", checkoutTitle: "Crown" });
    expect(href).toBe("a.usdz#applePayButtonType=buy&checkoutTitle=Crown");
    expect(warnings).toContain("An Apple Pay button replaces the custom button text.");
  });

  test("a button needs a title", () => {
    expect(arLink("a.usdz", { callToAction: "Catch" }).warnings).toContain("A banner with a button needs a title.");
  });

  test("custom banner: absolute https only, height kept", () => {
    expect(arLink("a.usdz", { custom: "https://example.com/banner.html", customHeight: "large" }).href).toBe(
      "a.usdz#custom=https%3A%2F%2Fexample.com%2Fbanner.html&customHeight=large",
    );
    expect(arLink("a.usdz", { custom: "/banner.html" }).warnings).toContain("A custom banner must be an absolute https:// URL.");
  });

  test("height without a custom banner is dropped", () => {
    const { href, warnings } = arLink("a.usdz", { customHeight: "small" });
    expect(href).toBe("a.usdz");
    expect(warnings).toContain("Banner height only applies to a custom banner.");
  });

  test("scaling: only 'off' is written", () => {
    expect(arLink("a.usdz", { allowsContentScaling: true }).href).toBe("a.usdz");
    expect(arLink("a.usdz", { allowsContentScaling: false }).href).toBe("a.usdz#allowsContentScaling=0");
  });
});
