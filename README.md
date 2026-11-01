# Pi-lot

Chat panel in the secondary sidebar (the right panel Copilot uses). Windows 98 / AIM chrome. It talks to a local [Pi](https://pi.dev) process (`pi --mode rpc --no-session`). Sessions are not saved.

The page in `poc/` is a fake. Open `poc/index.html` in a browser to poke at the layout without VS Code. The extension loads that same page.

## Download

The [latest release](../../releases/latest) has a `.vsix`. Install it with **Extensions: Install from VSIX…**.

That link is empty until a release exists. See [Release](#release).

## Install

You need:

- [VS Code or VSCodium 1.106+](https://code.visualstudio.com/). Older builds ignore `viewsContainers.secondarySidebar`, so the panel never shows up.
- [Node.js](https://nodejs.org/) (to compile this repo).
- Pi on your `PATH`. Install it from [pi.dev](https://pi.dev), then check `pi --version`.

The Extension Development Host has to see that same `pi`. On Windows the extension starts it through the shell, because `pi.cmd` will not spawn otherwise.

Clone this repo, then:

```bash
npm install
```

## Run

Open this folder in VS Code or VSCodium. **Run Extension** (F5) compiles, then opens an Extension Development Host.

In that window, run **Open Pi-lot** from the command palette, or open the secondary sidebar and pick Pi-lot. The first screen says "Connecting to Pi…" until the process answers.

98.css loads from unpkg. If the host has no network, the window is unstyled.

To install a package instead of using the debugger: `npm run package`, then **Extensions: Install from VSIX…**. That writes `pi-lot-<version>-dev.<time>.vsix` and does not change `package.json`.

## Change it

| What | Where |
| --- | --- |
| Layout, transcript, fake replies | `poc/` |
| Webview host, message mapping | `src/extension.ts` |
| Pi process and JSONL | `src/pi-rpc.ts`, `src/lines.ts` |

The webview posts `prompt`, `model`, `think`, and `new`. The extension turns those into Pi's `prompt`, `set_model`, `set_thinking_level`, and `new_session`. Model values are `provider` + tab + model id. Thinking levels come from Pi.

`npm test` is not wired. The line splitter check is `node --test test/lines.test.mjs`, and it imports `out/lines.js`, so compile first.

## Release

`.github/workflows/release.yml` runs when a `v*` tag is pushed. It compiles, packs a `.vsix` without bumping the version, and publishes a GitHub release. That release shows on the repository home page.

The workflow file has to already be on the default branch. The tag must match `version` in `package.json`, because the filename comes from that field, not the tag.

```bash
# set "version" in package.json, commit it, then:
git tag v0.0.5
git push origin v0.0.5
```

`npm run package` is only the local dev pack. It uses `<version>-dev.<time>`, which sorts below the plain version, so a later release of the same `package.json` version replaces it. It does not change `package.json` or the tag.
