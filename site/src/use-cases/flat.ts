import { arLinks, arrive } from "../use-case.ts";

const form = document.getElementById("viewing-form") as HTMLFormElement;
const booked = document.getElementById("booked")!;

// "Book a viewing", tapped inside AR: Quick Look closes, and the form is waiting.
arLinks(() => {
  document.getElementById("from-ar")!.hidden = false;
  arrive(form);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const name = String(data.get("name")).trim().split(/\s+/)[0];
  document.getElementById("booked-text")!.textContent =
    `Thanks, ${name}. In a real agency, someone would now call to confirm ${data.get("slot")}.`;
  form.hidden = true;
  booked.hidden = false;
  arrive(booked);
});
