import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const staticSource = resolve(rootDir, ".next", "static");
const standaloneNextDir = resolve(rootDir, ".next", "standalone", ".next");
const publicSource = resolve(rootDir, "public");
const standalonePublicDir = resolve(rootDir, ".next", "standalone", "public");

if (existsSync(staticSource)) {
  cpSync(staticSource, resolve(standaloneNextDir, "static"), { recursive: true });
}

if (existsSync(publicSource)) {
  cpSync(publicSource, standalonePublicDir, { recursive: true });
}
