// What you've collected, kept on this device only. Storage can be missing or
// blocked (private browsing): then the collection lasts until the tab closes.

const KEY = "capsule-toys:collection";
let memory: Record<string, number> = {};

function read(): Record<string, number> {
  try {
    return { ...memory, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return memory;
  }
}

/** Model ids in the order they were collected. */
export function collection(): string[] {
  return Object.entries(read())
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
}

export function collect(id: string) {
  const all = read();
  all[id] ??= Date.now();
  memory = all;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Kept in memory instead.
  }
}
