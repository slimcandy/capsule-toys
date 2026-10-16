import { renderSVG } from "uqr";
import { file, models, thumb } from "./catalog.ts";
import { APPLE_PAY_TYPES, arLink, supportsAR, type ApplePayType, type Banner, type CustomHeight } from "./quicklook.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>("form");
const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;

const PLACEHOLDER_FILE = "https://example.com/model.usdz";
const PLACEHOLDER_IMAGE = "/icons/icon.svg";

const PAY_LABELS: Record<ApplePayType, string> = {
  plain: "Apple Pay",
  pay: "Pay with Apple Pay",
  buy: "Buy with Apple Pay",
  "check-out": "Check out with Apple Pay",
  book: "Book with Apple Pay",
  donate: "Donate with Apple Pay",
  subscribe: "Subscribe with Apple Pay",
};

const paySelect = $<HTMLSelectElement>("applePayButtonType");
for (const type of APPLE_PAY_TYPES) paySelect.add(new Option(PAY_LABELS[type], type));

// ---- Settings live in the page URL, so a QR code can carry them to a phone.

const FIELDS = ["file", "image", "banner", "callToAction", "applePayButtonType", "checkoutTitle", "checkoutSubtitle", "price", "custom", "customHeight", "canonicalWebPageURL"];

function load() {
  const params = new URLSearchParams(location.search);
  for (const name of FIELDS) {
    const value = params.get(name);
    if (value === null) continue;
    const field = form.elements.namedItem(name);
    if (field instanceof RadioNodeList) field.value = value;
    else if (field) (field as HTMLInputElement).value = value;
  }
  if (params.get("scaling") === "0") ($("scaling") as HTMLInputElement).checked = false;
}

function save(state: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) if (value) params.set(key, value);
  const url = `${location.pathname}${params.size ? `?${params}` : ""}`;
  history.replaceState(null, "", url);
  return new URL(url, location.origin).href;
}

// ---- Everything follows from the form.

function render() {
  const banner = (form.elements.namedItem("banner") as RadioNodeList).value;
  const value = (name: string) => input(name).value.trim();

  $("button-field").hidden = banner !== "button";
  $("pay-field").hidden = banner !== "pay";
  $("item-fields").hidden = banner !== "button" && banner !== "pay";
  $("custom-fields").hidden = banner !== "custom";

  const options: Banner = { canonicalWebPageURL: value("canonicalWebPageURL"), allowsContentScaling: ($("scaling") as HTMLInputElement).checked };
  if (banner === "button" || banner === "pay") {
    Object.assign(options, { checkoutTitle: value("checkoutTitle"), checkoutSubtitle: value("checkoutSubtitle"), price: value("price") });
  }
  if (banner === "button") options.callToAction = value("callToAction");
  if (banner === "pay") options.applePayButtonType = value("applePayButtonType") as ApplePayType;
  if (banner === "custom") {
    options.custom = value("custom");
    options.customHeight = (form.elements.namedItem("customHeight") as RadioNodeList).value as CustomHeight;
  }

  const target = value("file") || PLACEHOLDER_FILE;
  const image = value("image");
  const { href, warnings } = arLink(target, options);

  // The phone preview.
  $<HTMLImageElement>("phone-scene").src = image || PLACEHOLDER_IMAGE;
  const hasItem = banner === "button" || banner === "pay";
  $("ql-banner").hidden = !hasItem;
  $("ql-custom").hidden = banner !== "custom";
  if (hasItem) {
    $("ql-title").textContent = options.checkoutTitle || "Title";
    $("ql-sub").textContent = [options.checkoutSubtitle, options.price].filter(Boolean).join(", ");
    $("ql-site").textContent = host(target);
    $("ql-button").hidden = banner !== "button";
    $("ql-button").textContent = options.callToAction || "Button";
    $("ql-pay").hidden = banner !== "pay";
    $("ql-pay").textContent = PAY_LABELS[options.applePayButtonType ?? "plain"];
  }
  if (banner === "custom") {
    const custom = $("ql-custom");
    custom.dataset.height = options.customHeight;
    custom.textContent = options.custom ? `Your page: ${options.custom}` : "Your page goes here";
  }

  // Warnings.
  $("warnings").hidden = warnings.length === 0;
  $("warning-list").replaceChildren(...warnings.map((w) => Object.assign(document.createElement("li"), { textContent: w })));

  // The link to try, and the code to copy.
  const tryLink = $<HTMLAnchorElement>("try");
  tryLink.href = href;
  $<HTMLImageElement>("try-image").src = image || PLACEHOLDER_IMAGE;
  $("html-code").textContent = `<a rel="ar" href="${href}">\n  <img src="${image || "https://example.com/model.jpg"}" alt="3D model">\n</a>`;
  $("listener").hidden = !hasItem;
  $("js-code").textContent = `const link = document.querySelector('a[rel="ar"]');\n\nlink.addEventListener("message", (event) => {\n  if (event.data === "_apple_ar_quicklook_button_tapped") {\n    // ${banner === "pay" ? "Show the Apple Pay sheet" : "Add it to the cart, open a page…"}\n  }\n});`;

  const pageUrl = save({
    file: value("file"),
    image,
    banner: banner === "none" ? "" : banner,
    callToAction: options.callToAction ?? "",
    applePayButtonType: options.applePayButtonType ?? "",
    checkoutTitle: options.checkoutTitle ?? "",
    checkoutSubtitle: options.checkoutSubtitle ?? "",
    price: options.price ?? "",
    custom: options.custom ?? "",
    customHeight: options.customHeight && options.customHeight !== "small" ? options.customHeight : "",
    canonicalWebPageURL: options.canonicalWebPageURL ?? "",
    scaling: options.allowsContentScaling ? "" : "0",
  });
  if (!supportsAR()) $("qr").innerHTML = renderSVG(pageUrl);
}

function host(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "example.com";
  }
}

$("try-qr").hidden = supportsAR();

// ---- One of the machine's own models, to see it work.

$("example").addEventListener("click", () => {
  const model = models.find((m) => m.id === "curiosity") ?? models[0];
  input("file").value = new URL(file(model), location.origin).href;
  input("image").value = new URL(thumb(model), location.origin).href;
  render();
  input("file").focus();
});

// ---- Copy buttons.

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($(button.dataset.copy!).textContent ?? "");
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select and copy";
    }
    setTimeout(() => (button.textContent = "Copy"), 1600);
  });
}

load();
form.addEventListener("input", render);
form.addEventListener("change", render);
form.addEventListener("submit", (event) => event.preventDefault());
render();
