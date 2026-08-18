import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const indexPath = resolve(dist, "index.html");
let html = await readFile(indexPath, "utf8");
const cssHref = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/)?.[1];
const jsSrc = html.match(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/)?.[1];
if (!cssHref || !jsSrc)
  throw new Error("Не найдены файлы сборки для встраивания");
const localPath = (value) => resolve(dist, value.replace(/^\.\//, ""));
// CSS is moved from dist/assets into dist/index.html. Rebase its asset URLs to
// the HTML location so images also work when the file is opened via file:///.
const css = (await readFile(localPath(cssHref), "utf8")).replaceAll(
  "../Assets/",
  "./Assets/",
);
const js = await readFile(localPath(jsSrc), "utf8");
html = html
  .replace(/<link[^>]+href="[^"]+\.css"[^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script[^>]+src="[^"]+\.js"[^>]*><\/script>/, "");
html = `${html}\n<script>${js}</script>`;
await writeFile(indexPath, html, "utf8");
console.log("Создан автономный dist/index.html для запуска через file:///");
