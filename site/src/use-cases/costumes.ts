import { arLinks } from "../use-case.ts";

interface Item {
  id: string;
  name: string;
  price: number;
  image: string;
  fromAR: boolean;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const bag = $<HTMLDialogElement>("bag");
const items: Item[] = [];

function product(id: string) {
  const li = document.querySelector<HTMLElement>(`.product[data-id="${id}"]`)!;
  return {
    id,
    name: li.dataset.name!,
    price: Number(li.dataset.price),
    image: li.querySelector("img")!.getAttribute("src")!,
  };
}

function render() {
  $("bag-count").textContent = String(items.length);
  $("bag-empty").hidden = items.length > 0;
  $("bag-total").textContent = `€${items.reduce((sum, item) => sum + item.price, 0)}`;
  const list = $("bag-items");
  list.replaceChildren(...items.map((item, index) => {
    const li = document.createElement("li");
    li.className = "flex items-center gap-4 py-4";
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = "";
    img.className = "lantern size-16 rounded-xl object-contain p-1.5";
    const text = document.createElement("div");
    text.className = "flex-1";
    const name = document.createElement("p");
    name.className = "font-bold";
    name.textContent = item.name;
    const note = document.createElement("p");
    note.className = "text-sm text-bone/60";
    note.textContent = item.fromAR ? `€${item.price} · added in AR` : `€${item.price}`;
    text.append(name, note);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-sm font-bold text-pumpkin-400 hover:text-pumpkin-300";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      items.splice(index, 1);
      render();
    });
    li.append(img, text, remove);
    return li;
  }));
}

function add(id: string, fromAR = false) {
  items.push({ ...product(id), fromAR });
  render();
}

function open(fromAR = false) {
  $("bag-from-ar").hidden = !fromAR;
  $("checkout-note").hidden = true;
  if (!bag.open) bag.showModal();
}

// "Buy with Apple Pay", tapped inside AR. A real shop would start an Apple Pay
// session here (Payment Request API); this one adds it to the bag.
arLinks((id) => {
  add(id, true);
  open(true);
});

for (const button of document.querySelectorAll<HTMLButtonElement>(".product .add")) {
  button.addEventListener("click", () => {
    add(button.closest<HTMLElement>(".product")!.dataset.id!);
    open();
  });
}
$("bag-open").addEventListener("click", () => open());
$("bag-close").addEventListener("click", () => bag.close());
bag.addEventListener("click", (event) => {
  if (event.target === bag) bag.close();
});
$("checkout").addEventListener("click", () => {
  $("checkout-note").hidden = false;
});
render();
