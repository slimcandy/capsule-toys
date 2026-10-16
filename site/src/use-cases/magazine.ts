import { arLinks, arrive } from "../use-case.ts";

// "Read on", tapped inside AR: back to the paragraph after that figure.
arLinks((id) => {
  const next = document.getElementById(`after-${id}`);
  if (next) arrive(next);
});
