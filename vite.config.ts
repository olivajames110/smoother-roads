import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Same rule as src/lib/slug.ts: the name before the first comma, lowercased, dashes
const clean = (s: string) =>
  s
    .split(",")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Area URLs (/smoother-roads/courchevel) on GitHub Pages: a copy of index.html per listed area, so
// those links load with a normal 200 (link previews work), and 404.html for anything else the app
// knows (requests from the database, older ids).
function areaPages(): Plugin {
  return {
    name: "area-pages",
    apply: "build",
    closeBundle() {
      const dist = "dist";
      const index = join(dist, "index.html");
      copyFileSync(index, join(dist, "404.html"));
      // the Vote page: /smoother-roads/vote
      mkdirSync(join(dist, "vote"), { recursive: true });
      copyFileSync(index, join(dist, "vote", "index.html"));
      const { areas } = JSON.parse(readFileSync("public/areas.json", "utf8")) as { areas: { id: string; name: string }[] };
      const count = new Map<string, number>();
      for (const a of areas) count.set(clean(a.name), (count.get(clean(a.name)) ?? 0) + 1);
      for (const a of areas) {
        const s = clean(a.name);
        for (const p of new Set([s && count.get(s) === 1 ? s : a.id, a.id])) {
          mkdirSync(join(dist, p), { recursive: true });
          copyFileSync(index, join(dist, p, "index.html"));
        }
      }
    },
  };
}

// The site lives under /smoother-roads/ on GitHub Pages; absolute paths so area URLs load their assets
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/smoother-roads/" : "/",
  plugins: [react(), areaPages()],
}));
