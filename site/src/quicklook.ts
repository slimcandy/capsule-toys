// AR Quick Look from a web page: a link with rel="ar", an <img> as its first
// child, and options in the URL's #fragment. That's the whole API.
// https://developer.apple.com/documentation/arkit/adding-an-apple-pay-button-or-a-custom-action-in-ar-quick-look

export const APPLE_PAY_TYPES = ["plain", "pay", "buy", "check-out", "book", "donate", "subscribe"] as const;
export type ApplePayType = (typeof APPLE_PAY_TYPES)[number];

export const CUSTOM_HEIGHTS = ["small", "medium", "large"] as const;
export type CustomHeight = (typeof CUSTOM_HEIGHTS)[number];

export interface Banner {
  /** Text of the button in the banner. Ignored when there's an Apple Pay button. */
  callToAction?: string;
  applePayButtonType?: ApplePayType;
  checkoutTitle?: string;
  checkoutSubtitle?: string;
  price?: string;
  /** An HTTPS page that replaces the whole banner. */
  custom?: string;
  customHeight?: CustomHeight;
  /** The page shared from Quick Look's share sheet. */
  canonicalWebPageURL?: string;
  /** false: the model stays at its real size. */
  allowsContentScaling?: boolean;
}

/** Fragment keys in the order Apple's examples use them. */
const ORDER: (keyof Banner)[] = [
  "applePayButtonType", "callToAction", "checkoutTitle", "checkoutSubtitle", "price",
  "custom", "customHeight", "canonicalWebPageURL", "allowsContentScaling",
];

export interface Link {
  href: string;
  /** Things Quick Look would ignore or refuse, in plain words. */
  warnings: string[];
}

export function arLink(file: string, banner: Banner = {}): Link {
  const warnings: string[] = [];
  const values: Partial<Record<keyof Banner, string>> = {};

  for (const key of ORDER) {
    const value = banner[key];
    if (value === undefined || value === "") continue;
    if (key === "allowsContentScaling") {
      // Scaling is on by default; only "off" needs saying.
      if (value === false) values[key] = "0";
      continue;
    }
    values[key] = String(value);
  }

  if (values.applePayButtonType && values.callToAction) {
    warnings.push("An Apple Pay button replaces the custom button text.");
    delete values.callToAction;
  }
  if ((values.applePayButtonType || values.callToAction) && !values.checkoutTitle) {
    warnings.push("A banner with a button needs a title.");
  }
  if (values.custom) {
    if (!/^https:\/\//.test(values.custom)) warnings.push("A custom banner must be an absolute https:// URL.");
    if (values.applePayButtonType || values.callToAction) {
      warnings.push("A custom banner replaces the button, title, subtitle and price.");
    }
  } else if (values.customHeight) {
    warnings.push("Banner height only applies to a custom banner.");
    delete values.customHeight;
  }

  const fragment = Object.entries(values)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return { href: fragment ? `${file}#${fragment}` : file, warnings };
}

/** Whether this browser opens rel="ar" links in AR Quick Look. */
export function supportsAR(): boolean {
  return document.createElement("a").relList.supports("ar");
}

const BUTTON_TAPPED = "_apple_ar_quicklook_button_tapped";

let anchor: HTMLAnchorElement | null = null;

/**
 * Opens a model in AR Quick Look from script. Safari needs a real link with
 * an <img> as its first child, so a hidden one is kept on the page. Call it
 * within a few seconds of a tap: Safari only lets a tap open AR.
 */
export function openAR(href: string, id: string) {
  if (!anchor) {
    anchor = document.createElement("a");
    anchor.rel = "ar";
    anchor.className = "sr-only";
    anchor.setAttribute("aria-hidden", "true");
    anchor.tabIndex = -1;
    anchor.append(document.createElement("img"));
    document.body.append(anchor);
  }
  anchor.href = href;
  anchor.dataset.id = id;
  anchor.click();
}

/** Calls back with the model id when someone taps the banner button inside AR. */
export function onBannerTap(callback: (id: string) => void) {
  document.addEventListener("message", (event) => {
    if ((event as MessageEvent).data !== BUTTON_TAPPED) return;
    const target = event.target as HTMLElement | null;
    const id = target?.dataset?.id;
    if (id) callback(id);
  }, true);
}
