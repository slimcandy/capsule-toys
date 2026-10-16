import catalog from "../../models/catalog.json" with { type: "json" };

export type Camera = "wear" | "place";
export type Rarity = "common" | "rare" | "special";

export interface Model {
  id: string;
  title: string;
  /** "wear" opens the front camera and sits on your face; "place" goes on the floor. */
  camera: Camera;
  rarity: Rarity;
  credit: { author: string; licence: string; url?: string };
}

export const models = catalog as Model[];

export const file = (model: Model) => `/models/${model.id}.usdz`;
export const thumb = (model: Model) => `/thumbs/${model.id}.png`;
/** The page Quick Look shows at the bottom of the AR view. */
export const banner = (model: Model) => `/banner/${model.id}.html`;

/** How likely one model of each rarity is, next to one common model. */
export const WEIGHT: Record<Rarity, number> = { common: 1, rare: 0.45, special: 0.15 };

export const RARITY_NAMES: Record<Rarity, string> = { common: "Common", rare: "Rare", special: "Special" };

export const LICENCE_NAMES: Record<string, string> = {
  "CC0-1.0": "CC0",
  "CC-BY-4.0": "CC BY 4.0",
  own: "Own scan",
};

/** "by Thomas Flynn · CC BY 4.0", or "Made in code for Capsule Toys · CC0". */
export function creditLine(model: Model): string {
  const licence = LICENCE_NAMES[model.credit.licence] ?? model.credit.licence;
  const who = model.credit.author === "Capsule Toys" ? "Made in code for Capsule Toys" : `by ${model.credit.author}`;
  return `${who} · ${licence}`;
}

/**
 * A weighted random pick from the whole machine. random() is injectable for
 * tests; `last` is never picked twice in a row.
 */
export function pick(last?: string, random = Math.random): Model {
  let pool = models;
  if (pool.length > 1) pool = pool.filter((m) => m.id !== last);
  const total = pool.reduce((sum, m) => sum + WEIGHT[m.rarity], 0);
  let roll = random() * total;
  for (const model of pool) {
    roll -= WEIGHT[model.rarity];
    if (roll < 0) return model;
  }
  return pool[pool.length - 1];
}
