// Packages the desktop app for Windows 7/8/8.1 with the community Electron
// build from https://github.com/e3kskoy7wqk/Electron-for-windows-7. Upstream
// Electron dropped those systems after version 22, so the runtime is the only
// piece that differs from the normal electron-builder pipeline: fetch the fork's
// dist zip, hand it to electron-builder as electronDist.
//
// Run it through `npm run build:desktop:win7` so the web export and the daemon
// bundles are built first.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(desktopDir, ".electron-win7");
const forkUrl = "https://github.com/e3kskoy7wqk/Electron-for-windows-7";

// Pin the asset and its hash so a re-uploaded release cannot silently become
// the runtime of an installer we hand to users. Both move together with the
// electron devDependency in packages/desktop/package.json.
const WIN7_ELECTRON_RELEASES = {
  "44.2.0": {
    url: "https://github.com/e3kskoy7wqk/Electron-for-windows-7/releases/download/v44.2.0/dist.zip",
    sha256: "c50ba2c10c87331ab961f60569e4d906c8514921ac17e138fd0da21ee4ddb2b1",
  },
};

function log(message) {
  console.log(`[win7] ${message}`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function readElectronVersion() {
  const packageJson = JSON.parse(await fs.readFile(path.join(desktopDir, "package.json"), "utf8"));
  const version = packageJson.devDependencies?.electron;
  if (!version) {
    throw new Error("@getpaseo/desktop needs an electron devDependency to pick the runtime");
  }
  return version.replace(/^[^\d]*/, "");
}

async function download(url, destination) {
  log(`downloading ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || response.body == null) {
    throw new Error(`download failed with ${response.status} for ${url}`);
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  const partialPath = `${destination}.part`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partialPath));
    await fs.rename(partialPath, destination);
  } finally {
    await fs.rm(partialPath, { force: true });
  }
}

async function ensureWin7Electron(version) {
  const release = WIN7_ELECTRON_RELEASES[version];
  if (!release) {
    throw new Error(
      `No Windows 7 Electron pinned for Electron ${version}. Add its release asset ` +
        `(and sha256) to WIN7_ELECTRON_RELEASES in ${fileURLToPath(import.meta.url)} from ${forkUrl}.`,
    );
  }

  const zipPath = path.join(cacheDir, `electron-v${version}-win32-x64-win7.zip`);
  if (await fileExists(zipPath)) {
    if ((await sha256(zipPath)) === release.sha256) {
      log(`reusing ${path.relative(process.cwd(), zipPath)}`);
      return zipPath;
    }
    log("cached runtime does not match the pinned hash; downloading again");
    await fs.rm(zipPath, { force: true });
  }

  await download(release.url, zipPath);
  const actual = await sha256(zipPath);
  if (actual !== release.sha256) {
    await fs.rm(zipPath, { force: true });
    throw new Error(
      `sha256 mismatch for ${release.url}: expected ${release.sha256}, got ${actual}`,
    );
  }
  return zipPath;
}

function runElectronBuilder(zipPath) {
  const cli = createRequire(import.meta.url).resolve("electron-builder/out/cli/cli.js");
  const args = [
    cli,
    "--config",
    "electron-builder-win7.yml",
    "--win",
    "--x64",
    "--publish",
    "never",
    `-c.electronDist=${zipPath}`,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: desktopDir, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`electron-builder terminated with ${signal}`));
      else if (code !== 0) reject(new Error(`electron-builder exited with ${code}`));
      else resolve();
    });
  });
}

async function main() {
  const version = await readElectronVersion();
  const zipPath = await ensureWin7Electron(version);
  log(`packaging with Electron ${version} from the Windows 7 fork`);
  await runElectronBuilder(zipPath);
  log(`installer written to ${path.relative(process.cwd(), path.join(desktopDir, "release"))}`);
}

await main();
