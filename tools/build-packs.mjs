// Builds the system compendiums (packs/) from the JSON sources in src/packs/.
//   npm install        (once)
//   npm run packs:build
//
// Pictures: drop an image named after the entry into assets/compendium/<pack>/
// (e.g. "fn-p90.webp" for "FN P90"; the name is the entry name lower-cased,
// everything except a-z/0-9 replaced by "-"). The build picks it up
// automatically, no JSON editing needed. Supported: webp png jpg jpeg svg avif.
// The build also writes tools/image-checklist.csv listing entries that still
// use a placeholder icon.
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "src", "packs");
const OUT = path.join(root, "packs");
const IMG = path.join(root, "assets", "compendium");
const URL_BASE = "systems/sgrpg/assets/compendium";
const EXT = ["webp", "png", "jpg", "jpeg", "svg", "avif"];

export const slug = (s) =>
  s.normalize("NFKD").replace(/[^\x00-\x7F]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "entry";

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const rows = [["pack", "folder", "name", "current image", "image file to add"]];
let overrides = 0;
const seenGroups = new Set();

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const pack of fs.readdirSync(SRC).filter((d) => fs.statSync(path.join(SRC, d)).isDirectory())) {
  const folders = new Map();
  const walk = (dir) => fs.readdirSync(dir).forEach((f) => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) return walk(p);
    if (!f.endsWith(".json")) return;
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (j._key?.startsWith("!folders!")) folders.set(j._id, j);
  });
  walk(path.join(SRC, pack));
  const folderPath = (id) => { const p = []; while (id && folders.has(id)) { p.push(folders.get(id).name); id = folders.get(id).folder; } return p.reverse().join("/"); };

  const seen = new Map();
  await compilePack(path.join(SRC, pack), path.join(OUT, pack), {
    log: false, recursive: true,
    transformEntry: (entry) => {
      if (entry._key?.startsWith("!actors!")) {
        // NPC actors: own picture (assets/compendium/npcs/<slug>.ext) or the group picture (_<group>.ext)
        const sl = slug(entry.name);
        const group = entry.flags?.["sgrpg-npcs"]?.group;
        const has = (n) => EXT.find((e) => fs.existsSync(path.join(IMG, pack, `${n}.${e}`)));
        let base = sl, ext = has(sl);
        if (!ext && group) { base = `_${group}`; ext = has(base); }
        // framed token variants (_<group>-token.ext) are used for the token; the portrait falls back to the token until one exists
        const ownTok = has(`${sl}-token`);
        const tokBase = ownTok ? `${sl}-token` : (group ? `_${group}-token` : null);
        const tokExt = ownTok || (tokBase && has(tokBase));
        if (ext || tokExt) {
          entry.img = ext ? `${URL_BASE}/${pack}/${base}.${ext}` : `${URL_BASE}/${pack}/${tokBase}.${tokExt}`; overrides++;
          const tokenSrc = tokExt ? `${URL_BASE}/${pack}/${tokBase}.${tokExt}` : entry.img;
          entry.prototypeToken = { ...(entry.prototypeToken || {}), texture: { src: tokenSrc } };
        } else if (group && !seenGroups.has(group)) {
          seenGroups.add(group);
          rows.push([pack, folderPath(entry.folder), `(group) ${group}`, entry.img, `assets/compendium/${pack}/_${group}.webp`]);
        }
        return;
      }
      if (!entry._key?.startsWith("!items!")) return;
      const sl = slug(entry.name);
      if (seen.has(sl)) console.warn(`  note: "${entry.name}" shares its image name "${sl}" with another entry in ${pack}`);
      seen.set(sl, true);
      let ipack = pack;
      let ext = EXT.find((e) => fs.existsSync(path.join(IMG, ipack, `${sl}.${e}`)));
      // class abilities that are also feats reuse the feat picture
      if (!ext && pack === "class-abilities") { ipack = "feats"; ext = EXT.find((e) => fs.existsSync(path.join(IMG, ipack, `${sl}.${e}`))); }
      if (ext) { const img = `${URL_BASE}/${ipack}/${sl}.${ext}`; if (entry.img !== img) overrides++; entry.img = img; }
      if (!entry.img || entry.img.startsWith("icons/svg/"))
        rows.push([pack, folderPath(entry.folder), entry.name, entry.img, `assets/compendium/${pack}/${sl}.webp`]);
    },
  });
  console.log(`built ${pack}`);
}
fs.writeFileSync(path.join(root, "tools", "image-checklist.csv"), rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
console.log(`done. ${overrides} image(s) taken from assets/compendium, ${rows.length - 1} entries still on a placeholder (tools/image-checklist.csv)`);
