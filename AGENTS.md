# Pi-lot

VSCodium extension: a chat panel in the secondary sidebar (the right panel Copilot uses). The browser mock is fake. The extension talks to a local `pi --mode rpc --no-session` process.

## Layout

- `src/extension.ts` only hosts the view. It reads `poc/index.html` and points the stylesheet and script at `poc/`. Do not copy the mock into the extension.
- `poc/` is also opened directly in a browser. That page fakes a right-hand window on a teal desktop (`width: min(420px, 100%)`, `#008080`). The extension adds `class="extension"` on `<html>` so the window fills the webview and the teal page background is hidden. Keep that split. Do not bake the extension layout into the browser mock.
- The view container key is `viewsContainers.secondarySidebar`. It needs VS Code / VSCodium **1.106+**. Older builds ignore it. `auxiliarybar` is the old name; do not use it.
- 98.css is loaded from unpkg. The webview CSP must allow `https://unpkg.com` for styles and fonts. The Extension Development Host needs network or the chrome is unstyled.

## UI that is already decided

Windows 98 / AIM transcript, not chat bubbles. 98.css for chrome. Times New Roman in the transcript. You in blue, Pi-lot in red.

- Model and Think selectors share a row with New Chat. No buddy name, no warning line, no "You:" label on the composer.
- Status bar, left to right: input tokens, output tokens, context percent, then the selected model and thinking level (`pi-lot high` in the mock).
- The browser mock counts tokens with `ceil(chars / 4)` and fake windows (small 8k, default 32k, large 128k). Do not treat that as a tokenizer. The extension uses Pi's `get_session_stats` and the model's `contextWindow` instead.
- Assistant turns have a collapsible Thinking block (`▶` / `▼`). New replies open it while waiting, then collapse it. Tool calls are appended there as `[toolName]`. The browser mock opens on a seeded exchange. The extension starts on starters after "Connecting to Pi…". New Chat clears to starters in both.

## Packaging

`npm run package` compiles and writes `pi-lot-<version>-dev.<time>.vsix`. It does not change `package.json`. The GitHub release workflow packs the plain version. There is no LICENSE (`--skip-license`). `repository` is set so vsce can rewrite the README release link. `.vscodeignore` drops `src`, `tsconfig.json`, and source maps. Do not run either unless a package was asked for.

## Pi

- `pi` must be on the Extension Development Host PATH. Windows spawns it with `shell: true` because `pi.cmd` will not start otherwise. The working directory is the workspace folder, or the extension folder if none is open.
- RPC is JSONL on stdin/stdout. Split on LF only and strip a trailing CR (`src/lines.ts`). Do not use Node `readline`. `test/lines.test.mjs` imports the compiled `out/lines.js`, so compile before running it.
- The webview posts `prompt`, `model`, `think`, and `new`. The extension maps those to `prompt`, `set_model`, `set_thinking_level`, and `new_session`.
- Model option values are `provider\tid`. Thinking levels come from Pi, not the hardcoded low/medium/high list.
- `poc/app.js` keeps the fake replies when `acquireVsCodeApi` is missing. Do not make the browser page require the extension.
- Sessions are ephemeral (`--no-session`).

## Do not

- Replace 98.css with a custom skin of the same controls.
- Widen `tsconfig` `lib` further without a reason. `DOM` is there so `TextDecoder` typechecks in the extension host.
