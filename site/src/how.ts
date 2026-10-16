import { renderSVG } from "uqr";
import { LICENCE_NAMES, models } from "./catalog.ts";
import { onBannerTap, supportsAR } from "./quicklook.ts";

// The credits list comes from the same catalog the machine uses.
const list = document.getElementById("credits-list")!;
for (const model of models) {
  const li = document.createElement("li");
  const title = document.createElement("span");
  title.className = "font-medium text-ink";
  title.textContent = model.title;
  li.append(title, " · ");
  if (model.credit.author === "Capsule Toys") {
    li.append("made in code for Capsule Toys");
  } else if (model.credit.url) {
    const a = document.createElement("a");
    a.href = model.credit.url;
    a.textContent = model.credit.author;
    li.append(a);
  } else {
    li.append(model.credit.author);
  }
  li.append(` · ${LICENCE_NAMES[model.credit.licence] ?? model.credit.licence}`);
  list.append(li);
}

// ---- The two examples: their AR links, and what a tap inside AR does.

const $ = (id: string) => document.getElementById(id)!;

/** Scrolls to an element and flashes it, so it's clear where a tap in AR led. */
function arrive(element: HTMLElement) {
  element.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  element.classList.remove("arrived");
  void element.offsetWidth;
  element.classList.add("arrived");
}

let bag = 0;
function addToBag(note: string) {
  $("bag-count").textContent = String(++bag);
  const status = $("bag-note");
  status.textContent = note;
  status.hidden = false;
}

onBannerTap((id) => {
  // "Read on", tapped inside AR: back to the paragraph after the figure.
  if (id === "lunar-module") arrive($("after-lunar-module"));
  // "Buy with Apple Pay": a real shop would start an Apple Pay session here.
  if (id === "hockey") {
    addToBag("Added from AR. A real shop would show Apple Pay now.");
    arrive($("bag-note"));
  }
});
$("add-to-bag").addEventListener("click", () => addToBag("Added to your bag."));

// On a Mac or Android a link to a .usdz is only a download: show a QR code instead.
if (!supportsAR()) {
  const dialog = document.createElement("dialog");
  dialog.className = "no-ar";
  dialog.innerHTML = `<h2>This opens in AR on an iPhone</h2>
    <p>AR Quick Look works in Safari on iPhone and iPad, and on Apple Vision Pro. Scan to open this page there.</p>
    <div class="qr">${renderSVG(location.href.split("#")[0])}</div>
    <button type="button" class="btn-cream">OK</button>`;
  dialog.querySelector("button")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  document.addEventListener("click", (event) => {
    if (!(event.target as Element).closest?.('a[rel="ar"]')) return;
    event.preventDefault();
    dialog.showModal();
  });
}
