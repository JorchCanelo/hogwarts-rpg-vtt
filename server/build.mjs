// Empaqueta el servidor con esbuild. Las dependencias de npm quedan externas (incluida better-sqlite3, que es nativa);
// @vtt/shared se incluye dentro del bundle porque se publica como TypeScript.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((d) => d !== "@vtt/shared");

await build({
  entryPoints: ["src/main.ts", "src/index.ts"],
  outdir: "dist",
  bundle: true,
  splitting: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external,
  logLevel: "info",
});
