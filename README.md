# GitHub Issue Importer — Figma Plugin

A Figma plugin that fetches a GitHub issue from a private or public repository and renders it into a Figma frame as styled text, preserving the markdown formatting from the issue body.

## Features

- Imports issue **title** and **description** directly into a Figma frame
- Preserves markdown formatting:
  - **Bold**, *italic*, ***bold+italic***
  - `inline code` (monospace, red tint)
  - Fenced code blocks (grey background frame, Courier New)
  - Headings H1–H3 (24 / 20 / 16 px)
  - Unordered (`•`) and ordered lists — consecutive items grouped into a single text node
  - Blockquotes (italic, grey)
  - ~~Strikethrough~~
  - [Hyperlinks](https://example.com) (blue, clickable in Figma)
  - Horizontal rules
- Saves your PAT and repository to Figma's local client storage (persists per Figma account, never leaves your machine)
- Reuses a selected frame (clearing its contents) or creates a new 800 px auto-layout frame at the viewport centre
- Frame is named `#<number>: <title>` automatically

## File Structure

```
figma-github/
├── manifest.json   # Plugin metadata and network permissions
├── code.js         # Plugin sandbox — all Figma API calls
└── ui.html         # Plugin UI — fetch, parse, and send data to code.js
```

No build step. No dependencies. Load the files directly in Figma.

## Setup

### 1. Get a GitHub Personal Access Token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens**
2. Generate a new token (classic or fine-grained)
3. Required scopes:
   - Classic PAT: `repo` (full repo access, needed for private repos)
   - Fine-grained PAT: `Contents` → Read-only on the target repository

### 2. Load the plugin in Figma

1. Open **Figma desktop** (the plugin requires the desktop app)
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Select `figma-github/manifest.json`
4. The plugin now appears under **Plugins → Development → GitHub Issue Importer**

## Usage

1. Run the plugin from **Plugins → Development → GitHub Issue Importer**
2. Enter your **Personal Access Token** (use the eye icon to reveal it)
3. Enter the **Repository** in `owner/repo` format (e.g. `acme/backend`)
4. Enter the **Issue Number** (e.g. `42`)
5. Click **Fetch & Import** (or press Enter)

The plugin fetches the issue, parses the markdown body, and inserts it into Figma:

- If a **Frame is selected**: its contents are replaced with the issue content
- If **nothing is selected**: a new frame is created at the viewport centre

Settings (token + repo) are auto-saved on blur and pre-filled the next time you open the plugin.

## Markdown Rendering

| Markdown syntax | Figma output |
|---|---|
| `# H1` / `## H2` / `### H3` | Inter Bold 24 / 20 / 16 px |
| `**bold**` or `__bold__` | Inter Bold |
| `*italic*` or `_italic_` | Inter Italic |
| `***bold italic***` | Inter Bold Italic |
| `` `inline code` `` | Courier New 13 px, red tint |
| ```` ```code block``` ```` | Grey frame, Courier New 13 px |
| `- item` / `* item` / `+ item` | `•` prefix, indented |
| `1. item` | Numbered prefix, indented |
| `> quote` | Inter Italic, grey |
| `~~strike~~` | Strikethrough decoration |
| `[text](url)` | Blue hyperlink |
| `---` / `***` / `___` | Horizontal rule (em-dash string) |

H4–H6 are rendered as H3. Images are not supported (the alt text is rendered as plain text). HTML tags within markdown are rendered as-is.

Headings receive an invisible 12 px spacer node inserted before them in the auto-layout frame. Combined with the frame's uniform 12 px item gap, this gives headings 36 px of space above them versus 12 px between all other blocks. The spacer is named `.spacer` in the Figma layer panel. To adjust the amount, change the argument to `createSpacer()` in `code.js`.

## Architecture

The plugin follows Figma's mandatory two-layer architecture:

```
ui.html (iframe)                    code.js (plugin sandbox)
────────────────                    ────────────────────────
On open → request saved settings
                                    clientStorage.getAsync
                                    → return token + repo
Fill inputs

User clicks Fetch & Import
  ↓
fetch() → api.github.com
  ↓
parseMarkdown() → blocks[]
  ↓
postMessage('insert-issue')
                                    loadAllFonts() [parallel]
                                    getOrCreateFrame()
                                    createTitleNode()
                                    for each block:
                                      createBlockNode()
                                      applyInlineFormatting()
                                    scrollAndZoomIntoView()
                                    → postMessage('insert-complete')
Show success message
```

`fetch()` is called from the UI layer (the iframe) because the plugin sandbox has no network access. The `networkAccess.allowedDomains` field in `manifest.json` permits requests to `https://api.github.com`.

Fonts are loaded with `figma.loadFontAsync` before any text node is created. The following variants are pre-loaded: Inter Regular, Bold, Italic, Bold Italic, and Courier New Regular.

## Error Messages

| Message | Cause |
|---|---|
| Invalid token. Check your PAT and try again. | HTTP 401 — token is wrong or expired |
| Access forbidden. Make sure your PAT has the repo scope. | HTTP 403 — token lacks permissions |
| Rate limit exceeded. Resets at HH:MM:SS. | HTTP 403 with `X-RateLimit-Remaining: 0` |
| Issue not found. Check the repository name and issue number. | HTTP 404 — wrong repo or issue number |

## Limitations

- Requires Figma **desktop** (browser-based Figma blocks plugin network requests to external APIs)
- Does not support issue comments — only the issue body is imported
- Nested inline formatting (e.g. bold text inside a link) renders the outermost style only
- Tables are rendered as plain text
- Images render as their alt text
