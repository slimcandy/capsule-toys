import { renderSVG } from "uqr";
import { onBannerTap, supportsAR } from "./quicklook.ts";

// What every use-case page shares. The AR links themselves are plain HTML in
// the page, so "view source" shows exactly what Safari reads.

let dialog: HTMLDialogElement | null = null;

/** On a Mac or Android, a link to a .usdz is only a download: show a QR code to open the page on an iPhone instead. */
function showNoAR() {
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "no-ar";
    dialog.setAttribute("aria-labelledby", "no-ar-title");
    const title = document.createElement("h2");
    title.id = "no-ar-title";
    title.textContent = "This opens in AR on an iPhone";
    const note = document.createElement("p");
    note.textContent = "AR Quick Look works in Safari on iPhone and iPad, and on Apple Vision Pro. Scan to open this page there.";
    const qr = document.createElement("div");
    qr.className = "qr";
    qr.innerHTML = renderSVG(location.href.split("#")[0]);
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "OK";
    close.addEventListener("click", () => dialog!.close());
    dialog.append(title, note, qr, close);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog!.close();
    });
    document.body.append(dialog);
  }
  dialog.showModal();
}

/**
 * Wires the page's AR links. `onTap` gets the link's `data-id` when someone
 * taps the button in the banner inside AR: Quick Look closes, and the page
 * receives a message on that link.
 */
export function arLinks(onTap?: (id: string) => void) {
  if (!supportsAR()) {
    document.addEventListener("click", (event) => {
      const link = (event.target as Element).closest?.('a[rel="ar"]');
      if (!link) return;
      event.preventDefault();
      showNoAR();
    });
  }
  if (onTap) onBannerTap(onTap);
}

/** Scrolls to an element and flashes it, so it's clear where a tap in AR led. */
export function arrive(element: HTMLElement) {
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.classList.remove("arrived");
  void element.offsetWidth;
  element.classList.add("arrived");
}
