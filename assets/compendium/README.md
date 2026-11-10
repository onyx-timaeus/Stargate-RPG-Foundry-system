# Compendium pictures

Drop an image named after the entry into the folder of its compendium, then run `npm run packs:build`.
The file name is the entry name in lower case with everything except a-z/0-9 replaced by "-"
(`FN P90` -> `fn-p90.webp`, `Zat'nik'tel` -> `zat-nik-tel.webp`). Supported: webp, png, jpg, svg, avif.
256x256 WebP is plenty. `tools/image-checklist.csv` lists every entry that still has a placeholder
and the exact file name it expects.
