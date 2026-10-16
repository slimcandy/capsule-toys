import { describe, expect, test } from "vitest";
import { creditLine, models, pick, WEIGHT } from "../site/src/catalog.ts";

/** A random() that walks evenly through [0, 1), for exact counts. */
function sweep(steps: number) {
  let i = 0;
  return () => (i++ % steps + 0.5) / steps;
}

describe("pick", () => {
  test("never repeats the last model", () => {
    const random = sweep(50);
    for (const model of models) {
      for (let i = 0; i < 50; i++) expect(pick(model.id, random).id).not.toBe(model.id);
    }
  });

  test("odds follow the rarity weights", () => {
    const steps = 10_000;
    const random = sweep(steps);
    const counts = new Map<string, number>();
    for (let i = 0; i < steps; i++) {
      const id = pick(undefined, random).id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const total = models.reduce((sum, m) => sum + WEIGHT[m.rarity], 0);
    for (const model of models) {
      expect(counts.get(model.id)! / steps).toBeCloseTo(WEIGHT[model.rarity] / total, 2);
    }
  });

  test("every model can be picked", () => {
    const random = sweep(1000);
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(pick(undefined, random).id);
    expect(seen.size).toBe(models.length);
  });
});

describe("catalog", () => {
  test("every model has a known rarity and a credit", () => {
    for (const model of models) {
      expect(Object.keys(WEIGHT)).toContain(model.rarity);
      expect(model.credit.author).toBeTruthy();
      expect(creditLine(model)).toMatch(/CC0|CC BY 4.0|Own scan/);
    }
  });
});
