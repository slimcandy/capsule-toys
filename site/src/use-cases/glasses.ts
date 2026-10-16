import { arLinks } from "../use-case.ts";

// The banner in AR is Glint's own page, so there's no button to listen for.
arLinks();

const BASE = 149;
const price = document.getElementById("price")!;
for (const input of document.querySelectorAll<HTMLInputElement>('input[name="lenses"]')) {
  input.addEventListener("change", () => {
    price.textContent = `€${BASE + Number(input.value)}`;
  });
}
