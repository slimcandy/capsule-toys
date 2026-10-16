import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { arLink, type Banner } from "../site/src/quicklook.ts";

// The pages are plain HTML, so these read them the way Safari and link
// previews do: every AR link must open, and every page must have a card.

const SITE = join(import.meta.dirname, "..", "site");
const PUBLIC = join(SITE, "public");
const ORIGIN = "https://ar.avolkov.dev";

const pages = [
  ...readdirSync(SITE).filter((f) => f.endsWith(".html")),
  ...readdirSync(join(SITE, "use-cases")).filter((f) => f.endsWith(".html")).map((f) => `use-cases/${f}`),
];
const read = (page: string) => readFileSync(join(SITE, page), "utf8");
const unescape = (html: string) => html.replaceAll("&amp;", "&");
const local = (url: string) => join(PUBLIC, url.replace(ORIGIN, "").split(/[?#]/)[0]);

interface ArLink {
  tag: string;
  href: string;
  firstChild: string;
}

function arLinks(html: string): ArLink[] {
  // Links without an href get one from script (Create your own); the link builder's own tests cover those.
  return [...html.matchAll(/<a\b([^>]*)>\s*(<\w+)/g)]
    .filter(([, attrs]) => /\brel="ar"/.test(attrs) && /\bhref="/.test(attrs))
    .map(([tag, attrs, firstChild]) => ({ tag, href: unescape(attrs.match(/\bhref="([^"]*)"/)![1]), firstChild }));
}

/** Reads a link's #fragment back into the options it was made from. */
function bannerOf(href: string): Banner {
  const fragment = href.split("#")[1] ?? "";
  const banner: Record<string, unknown> = {};
  for (const pair of fragment.split("&").filter(Boolean)) {
    const [key, value] = pair.split("=");
    banner[key] = key === "allowsContentScaling" ? value !== "0" : decodeURIComponent(value);
  }
  return banner as Banner;
}

describe.each(pages)("%s", (page) => {
  const html = read(page);

  test("has a link preview card that exists", () => {
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    expect(image).toMatch(/^https:\/\/ar\.avolkov\.dev\/share\/.+\.jpg/);
    expect(existsSync(local(image!)), image).toBe(true);
  });

  const links = arLinks(html);
  if (!links.length) return;

  test.each(links)("AR link $href", ({ tag, href, firstChild }) => {
    // Safari only opens AR when the link's first child is an image.
    expect(firstChild).toBe("<img");
    expect(tag).toMatch(/\bdata-id="[\w-]+"/);
    const [file] = href.split("#");
    expect(existsSync(local(file)), file).toBe(true);

    // The fragment is exactly what the link builder would write: known keys,
    // in Apple's order, encoded, and nothing Quick Look would ignore.
    const banner = bannerOf(href);
    const built = arLink(file, banner);
    expect(built.warnings).toEqual([]);
    expect(built.href).toBe(href);
    if (banner.custom) expect(existsSync(local(banner.custom)), banner.custom).toBe(true);
  });

  test("the code shown on the page is a link the page really uses", () => {
    const shown = [...html.matchAll(/&lt;a rel="ar" href="([^"]+)"&gt;/g)].map(([, href]) => unescape(href));
    for (const href of shown) expect(links.map((l) => l.href)).toContain(href);
  });
});
