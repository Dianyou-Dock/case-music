import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const core = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const game = resolve(core, "../games/the-lost-storm");
const output = resolve(game, "dist-portal");
const target = resolve(core, "public/moyu-static");

if (!existsSync(resolve(game, "package.json"))) {
  throw new Error("摸鱼游戏子模块缺失，请先运行 git submodule update --init --recursive");
}

if (!existsSync(resolve(game, "node_modules"))) {
  execFileSync("npm", ["ci"], { cwd: game, stdio: "inherit" });
}

execFileSync("npm", ["run", "build:portal"], { cwd: game, stdio: "inherit" });
if (!existsSync(resolve(output, "index.html"))) {
  throw new Error("摸鱼游戏构建未生成 index.html");
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(output, target, { recursive: true });
console.log(`摸鱼游戏资源已复制到 ${target}`);
