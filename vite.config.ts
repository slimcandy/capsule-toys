import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vitest/config";
import { bannerHTML } from "./site/src/banner.ts";
import { models } from "./site/src/catalog.ts";

/** One static banner page per model, for AR Quick Look's `custom` banner. */
function banners(): Plugin {
  return {
    name: "capsule-toys:banners",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const id = req.url?.match(/^\/banner\/([\w-]+)\.html$/)?.[1];
        const model = models.find((m) => m.id === id);
        if (!model) return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(bannerHTML(model));
      });
    },
    generateBundle() {
      for (const model of models) {
        this.emitFile({ type: "asset", fileName: `banner/${model.id}.html`, source: bannerHTML(model) });
      }
    },
  };
}

export default defineConfig({
  root: "site",
  plugins: [tailwindcss(), banners()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    // Three plain pages; the browser moves between them with view transitions.
    rollupOptions: {
      input: {
        game: "site/index.html",
        how: "site/how-it-works.html",
        create: "site/create.html",
      },
    },
  },
  test: { root: "." },
});
