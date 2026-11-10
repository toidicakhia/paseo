# desktop

Electron desktop app for Paseo.

## Windows 7 installer

`npm run build:desktop:win7` from the repository root writes
`Paseo-Setup-<version>-win7-x64.exe` and the portable `Paseo-Setup-<version>-win7-x64.zip` to
`packages/desktop/release`.

Upstream Electron dropped Windows 7/8/8.1 after version 22, so the runtime comes from
https://github.com/e3kskoy7wqk/Electron-for-windows-7. `scripts/build-win7.mjs` downloads that
fork's dist zip, checks the pinned sha256, and hands it to electron-builder as `electronDist`;
`electron-builder-win7.yml` carries the Windows 7 packaging config. When the `electron`
devDependency moves, pin the fork release for that version or the build stops with an explicit
error.

The fork patches Chromium for those systems; Paseo does not. Treat the artifact as best-effort.
Known gaps:

- Terminals. `node-pty` on Windows is ConPTY-only, which needs Windows 10 1809 or newer.
- Auto-update. The installer carries no publish config, because the regular Windows build needs
  Windows 10.
- Code signing. The installer is unsigned, so Windows prompts with an unknown publisher.
