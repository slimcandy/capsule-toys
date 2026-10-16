import { LICENCE_NAMES, models } from "./catalog.ts";

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
