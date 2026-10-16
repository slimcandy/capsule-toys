// The page AR Quick Look shows at the bottom of the AR view (the `custom`
// banner). One static HTML file per model, written at build time, so the
// title, rarity and credit live inside AR instead of on a card afterwards.
// Quick Look runs no scripts in it: plain HTML and a stylesheet.

import { creditLine, RARITY_NAMES, type Model } from "./catalog.ts";

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function bannerHTML(model: Model): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(model.title)} · Capsule Toys</title>
<link rel="stylesheet" href="/banner/banner.css">
</head>
<body data-rarity="${model.rarity}">
<p class="title"><span class="stamp">${RARITY_NAMES[model.rarity]}</span><span class="name">${escape(model.title)}</span></p>
<p class="credit">${escape(creditLine(model))} · Capsule Toys</p>
</body>
</html>
`;
}
