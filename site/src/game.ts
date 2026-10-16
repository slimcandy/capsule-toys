import { renderSVG } from "uqr";
import { collect, collection } from "./album.ts";
import { banner, creditLine, file, models, pick, RARITY_NAMES, thumb, type Model } from "./catalog.ts";
import { arLink, openAR, supportsAR } from "./quicklook.ts";
import { sound } from "./sound.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const SITE = "https://ar.avolkov.dev/";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canAR = supportsAR();

const knob = $<HTMLButtonElement>("knob");
const knobArt = knob.querySelector<HTMLElement>(".knob-art")!;
const play = $<HTMLButtonElement>("play");
const reveal = $("reveal");

/** The capsule's picture for each rarity: blue, purple, glowing gold. */
const capsuleArt = (model: Model) => `/art/capsule-${model.rarity}.png`;

let next = pick();
let current: Model | null = null;
let busy = false;

// ---- Quick Look. The title, rarity and credit are shown inside AR, on a
// banner page of our own at the bottom of the view.

function link(model: Model) {
  return arLink(file(model), {
    custom: new URL(banner(model), location.origin).href,
    customHeight: "small",
    canonicalWebPageURL: SITE,
  }).href;
}

/** Warm the cache for the next capsule, so AR opens faster. */
function prefetch(model: Model) {
  void fetch(file(model), { priority: "low" } as RequestInit).catch(() => {});
  new Image().src = capsuleArt(model);
}

// ---- The knob: one full turn clockwise. A ratchet, so it keeps where you
// left it and never turns back, with a hard stop at the end.

const FULL = 360;
const TOOTH = 30;
const PLAY = 10;
let turn = 0;
let drag: { angle: number; reached: number } | null = null;

function setTurn(value: number) {
  turn = value;
  knob.style.setProperty("--turn", value.toFixed(1));
}

function angleAt(event: PointerEvent) {
  const box = knob.getBoundingClientRect();
  const dx = event.clientX - (box.left + box.width / 2);
  const dy = event.clientY - (box.top + box.height / 2);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

knob.addEventListener("pointerdown", (event) => {
  if (busy) return;
  sound.unlock();
  knob.setPointerCapture(event.pointerId);
  drag = { angle: angleAt(event), reached: turn };
});

knob.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const angle = angleAt(event);
  let delta = angle - drag.angle;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;
  drag.angle = angle;
  const value = Math.min(FULL, Math.max(turn + delta, drag.reached - PLAY));
  if (Math.floor(value / TOOTH) > Math.floor(turn / TOOTH)) sound.tick();
  if (value === FULL && turn < FULL) sound.stop();
  drag.reached = Math.max(drag.reached, value);
  setTurn(value);
});

function letGo() {
  if (!drag) return;
  drag = null;
  if (turn >= FULL) void vend();
  // Most of the way there: the mechanism takes over.
  else if (turn >= FULL * 0.7) void spin(400);
}
knob.addEventListener("pointerup", letGo);
knob.addEventListener("pointercancel", letGo);

// Keyboard: Enter or Space turns it in one go.
knob.addEventListener("click", (event) => {
  if (event.detail === 0 && !busy) {
    sound.unlock();
    void spin(700);
  }
});

play.addEventListener("click", () => {
  if (busy) return;
  sound.unlock();
  sound.press();
  void spin(650);
});

/** The knob turns itself the rest of the way, clicking, then vends. */
async function spin(duration: number) {
  if (busy) return;
  busy = true;
  play.disabled = true;
  const from = turn;
  const ms = reducedMotion ? 0 : duration * ((FULL - from) / FULL);
  const teeth = Math.floor(FULL / TOOTH) - Math.floor(from / TOOTH);
  for (let i = 1; i <= teeth; i++) setTimeout(() => sound.tick(), (ms * i) / (teeth + 1));
  if (ms > 0) {
    await knobArt.animate([{ rotate: `${from}deg` }, { rotate: `${FULL}deg` }], {
      duration: ms,
      easing: "cubic-bezier(0.45, 0, 0.55, 1)",
      fill: "forwards",
    }).finished;
  }
  setTurn(FULL);
  knobArt.getAnimations().forEach((a) => a.cancel());
  sound.stop();
  await vend();
}

// ---- One play: the mechanism turns over, the globe rattles, a capsule
// drops, rolls out, pops, and AR opens. When you come back, the toy is on
// the shelf.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, reducedMotion ? Math.min(ms, 150) : ms));

/** The globe shivers: a copy of it, jittered over the picture. */
function rattle() {
  if (reducedMotion) return;
  const art = $("globe-art");
  art.classList.add("shaking");
  const frames = Array.from({ length: 14 }, () => ({
    translate: `${((Math.random() - 0.5) * 5).toFixed(1)}px ${((Math.random() - 0.5) * 5).toFixed(1)}px`,
    rotate: `${((Math.random() - 0.5) * 1.6).toFixed(2)}deg`,
  }));
  frames.push({ translate: "0 0", rotate: "0deg" });
  art.animate(frames, { duration: 560 }).finished.then(() => art.classList.remove("shaking"));
}

async function vend() {
  busy = true;
  play.disabled = true;
  const model = next;
  current = model;

  sound.clunk();
  rattle();
  sound.rattle();
  await wait(120);
  // A full turn: the knob is back where it started.
  setTurn(0);
  await wait(300);

  // One capsule drops into the tray, in its rarity's colour.
  const inChute = $<HTMLImageElement>("chute-capsule");
  inChute.src = capsuleArt(model);
  inChute.hidden = false;
  sound.drop();
  inChute.animate(
    [{ translate: "-50% -180%" }, { translate: "-50% 0" }, { translate: "-50% -16%" }, { translate: "-50% 0" }],
    { duration: 360, easing: "ease-in" },
  );
  await wait(460);

  // It rolls out towards you.
  const capsule = $("capsule");
  const glow = $("reveal-glow");
  const image = $<HTMLImageElement>("reveal-model");
  reveal.dataset.rarity = model.rarity;
  for (const half of capsule.querySelectorAll<HTMLImageElement>("img")) half.src = capsuleArt(model);
  capsule.hidden = false;
  image.src = thumb(model);
  image.alt = model.title;
  $("ticket").hidden = true;
  reveal.hidden = false;
  const from = inChute.getBoundingClientRect();
  const to = capsule.getBoundingClientRect();
  inChute.hidden = true;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s = from.width / to.width;
  $("reveal-backdrop").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "both" });
  await capsule.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(-200deg)` },
      { transform: "translate(0, -12%) scale(1.05) rotate(-15deg)", offset: 0.7 },
      { transform: "translate(0, 0) scale(1) rotate(0deg)" },
    ],
    { duration: 520, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "both" },
  ).finished;
  // A wobble, like it's about to burst.
  await capsule.animate([{ rotate: "0deg" }, { rotate: "-9deg" }, { rotate: "8deg" }, { rotate: "-5deg" }, { rotate: "0deg" }], { duration: 300 }).finished;

  // Pop.
  sound.pop(model.rarity);
  const fly = { duration: 520, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)", fill: "forwards" as const };
  $("capsule-top").animate([{ transform: "none", opacity: 1 }, { transform: "translate(-30%, -120%) rotate(-35deg)", opacity: 0 }], fly);
  $("capsule-bottom").animate([{ transform: "none", opacity: 1 }, { transform: "translate(20%, 110%) rotate(25deg)", opacity: 0 }], fly);
  glow.animate([{ opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1.1 }, { opacity: 0.75, scale: 1 }], { duration: 700, fill: "forwards" });
  image.animate([{ opacity: 0, scale: 0.4, translate: "0 18%" }, { opacity: 1, scale: 1, translate: "0 0" }], { duration: 520, easing: "cubic-bezier(0.2, 1.4, 0.4, 1)", fill: "forwards" });

  // It's yours.
  collect(model.id);
  renderShelves();
  next = pick(model.id);
  await wait(420);

  if (canAR) {
    // Still within Safari's few seconds after the tap: AR opens by itself.
    openAR(link(model), model.id);
    // If it didn't open (the tap was too long ago), the toy is on the shelf anyway.
    setTimeout(() => {
      if (document.visibilityState === "visible" && current === model && !reveal.hidden) void finish();
    }, 3000);
  } else {
    showTicket(model);
  }
  prefetch(next);
}

// Back from AR: straight back to the machine.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && canAR && current && !reveal.hidden) void finish();
});

/** On a Mac or Android there's no AR: the toy's details, and a QR code to play on an iPhone. */
function showTicket(model: Model) {
  const stamp = $("ticket-rarity");
  stamp.textContent = RARITY_NAMES[model.rarity];
  stamp.dataset.rarity = model.rarity;
  $("ticket-title").textContent = model.title;
  $("ticket-credit").textContent = creditLine(model);
  $("ticket-qr").innerHTML = renderSVG(SITE);
  const ticket = $("ticket");
  ticket.hidden = false;
  ticket.animate([{ opacity: 0, translate: "0 16px" }, { opacity: 1, translate: "0 0" }], { duration: 260, easing: "ease-out" });
  $("ticket-close").focus({ preventScroll: true });
}

/** A toy from the shelf, on a device without AR. */
function present(model: Model) {
  current = model;
  busy = true;
  reveal.dataset.rarity = model.rarity;
  const image = $<HTMLImageElement>("reveal-model");
  image.src = thumb(model);
  image.alt = model.title;
  image.animate([{ opacity: 1 }], { duration: 0, fill: "forwards" });
  $("reveal-glow").animate([{ opacity: 0.75 }], { duration: 0, fill: "forwards" });
  $("capsule").hidden = true;
  reveal.hidden = false;
  $("reveal-backdrop").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: "both" });
  showTicket(model);
}

$("ticket-close").addEventListener("click", () => void finish());
reveal.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("ticket").hidden) void finish();
});

/** The reveal closes and the toy drops onto its shelf. */
async function finish() {
  if (reveal.hidden) return;
  const model = current;
  const image = $("reveal-model");
  const fade = reveal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" }).finished;
  const slot = model && document.querySelector<HTMLElement>(`.toy[data-id="${model.id}"] img`);
  if (slot && !reducedMotion) {
    const from = image.getBoundingClientRect();
    const to = slot.getBoundingClientRect();
    if (to.top < innerHeight && to.bottom > 0) {
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      slot.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` }, { transform: "none" }],
        { duration: 520, easing: "cubic-bezier(0.3, 0.9, 0.3, 1.1)" },
      );
      setTimeout(() => sound.shelf(), 480);
    }
  }
  await fade;
  reveal.hidden = true;
  for (const el of reveal.querySelectorAll<HTMLElement>(".capsule, .capsule-top, .capsule-bottom, .reveal-glow, .reveal-model, .reveal-backdrop")) {
    el.getAnimations().forEach((a) => a.cancel());
  }
  reveal.getAnimations().forEach((a) => a.cancel());
  current = null;
  busy = false;
  play.disabled = false;
}

// ---- The cabinet: what you've collected, in order. Empty shelves stay empty.

const PER_ROW = 4;
$("total-count").textContent = String(models.length);

function renderShelves() {
  const have = collection();
  $("caught-count").textContent = String(have.length);
  const rows = Math.ceil(models.length / PER_ROW);
  $("shelves").replaceChildren(
    ...Array.from({ length: rows }, (_, row) => {
      const shelf = document.createElement("ul");
      shelf.className = "shelf";
      shelf.setAttribute("role", "list");
      for (let i = 0; i < PER_ROW; i++) {
        const li = document.createElement("li");
        const model = models.find((m) => m.id === have[row * PER_ROW + i]);
        if (model) li.append(toy(model));
        shelf.append(li);
      }
      return shelf;
    }),
  );
}

function toy(model: Model) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "toy";
  button.dataset.id = model.id;
  button.dataset.rarity = model.rarity;
  const img = document.createElement("img");
  img.src = thumb(model);
  img.alt = "";
  img.width = 160;
  img.height = 160;
  const name = document.createElement("span");
  name.textContent = model.title;
  button.append(img, name);
  button.title = `${RARITY_NAMES[model.rarity]} · ${creditLine(model)}`;
  button.setAttribute("aria-label", `${model.title}, ${RARITY_NAMES[model.rarity]}. ${canAR ? "See it in AR again" : creditLine(model)}`);
  button.addEventListener("click", () => {
    if (busy) return;
    sound.unlock();
    if (canAR) openAR(link(model), model.id);
    else present(model);
  });
  return button;
}

renderShelves();
prefetch(next);
