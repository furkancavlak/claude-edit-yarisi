# capcut-mcp (edit race fork)

> **This is a fork.** The original [capcut-mcp](https://github.com/JmsLdrn/capcut-mcp) is by
> [James Aldrin Boncales](https://jmsldrn.com), MIT License (kept in [`LICENSE-upstream`](LICENSE-upstream)).
> This copy adds four bug fixes, ten new tools and a detail mode for `capcut_read_timeline`, all found necessary while Claude Opus 5.5 and Claude Fable 5.2 edited real
> footage with it. What changed: [`CHANGES.md`](CHANGES.md). What came from where: [`NOTICE.md`](NOTICE.md).

An MCP server that lets Claude **read and edit CapCut desktop draft projects**: add/move/trim/split clips, text,
audio, images; crop, picture-in-picture, transitions, effects, filters, masks, stickers, text style and animation;
validate; save. It works by cloning real segment/material templates out of an existing draft (the only reliable way
to produce valid CapCut JSON), and it saves atomically with a backup and a validation pass.

> **Not affiliated with CapCut or ByteDance.** CapCut's draft format is proprietary and undocumented; this tool
> reads/writes it defensively (clone-from-template, backups, validation), but a CapCut update can shift the schema.
> **Keep the backups it makes.** No CapCut data, drafts or media are shipped here.

## Requirements
- **Node 18+** (Node **22.13+** for the optional `npm run catalog`, it uses the built-in `node:sqlite`)
- **ffmpeg/ffprobe** on PATH (media duration/resolution, preview frames)
- **CapCut desktop** (Windows layout assumed; the macOS path is auto-detected too)

## Install
```bash
cd capcut-mcp
npm install
claude mcp add capcut --scope user -- node "/ABSOLUTE/PATH/TO/capcut-mcp/src/server.js"
```
…or copy `mcp.json.example` to a project `.mcp.json` and fill in the absolute path. Restart Claude Code; the tools
appear as `mcp__capcut__*`. Codex and other MCP clients: register the same `node <path>/src/server.js` stdio command.

## Configure (env, optional)
- `CAPCUT_DRAFTS_DIR`: your CapCut drafts folder. Auto-detects `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft`
  (Windows) and `~/Movies/CapCut/User Data/Projects/com.lveditor.draft` (macOS). Set it if your drafts live elsewhere.
- `CAPCUT_TEMPLATE_DRAFT`: the template draft (default **`SABLON-YARIS`**). See the next section.
- `CAPCUT_EFFECT_TEMPLATE`, `CAPCUT_MASK_TEMPLATE`: other drafts for effects / masks (default: the template draft).
- `CAPCUT_CATALOG`: path of the local catalog (default `capcut-mcp/catalog.local.json`).
- `CAPCUT_PREVIEW_FONT`: a bold `.ttf` for `capcut_preview_frame`.

## The template draft (make it once, in your own CapCut)
Every new clip, text or effect is cloned from something CapCut itself wrote, so the server needs one draft of yours
that contains each kind of thing. Make a new CapCut project, name it **`SABLON-YARIS`**, and put in it:

| Put this in the template | Needed for |
|---|---|
| canvas 9:16 (1080x1920), or whatever your videos use | new drafts cloned from it keep this canvas |
| two short video clips side by side on the main track | `capcut_add_video`, `capcut_add_image` |
| one **transition** between those two clips | `capcut_add_effect` kind transition (also the base for catalog transitions) |
| one **video effect** on a clip | kind video_effect |
| one **filter** on a clip | kind filter |
| one **text** layer (any words) | `capcut_add_text`, `capcut_style_text` |
| one **audio** clip (music or sound) | `capcut_add_audio` |
| optional: a **sticker**, a **mask** on a clip, a text **in-animation** | `capcut_add_sticker`, `capcut_add_mask`, `capcut_animate_text` |

Close CapCut (it must be closed whenever this server saves). Check it with `capcut_read_timeline`
(`draft: "SABLON-YARIS", detail: true`) and `capcut_list_effects`. Use your own media; the template only stores paths.
Start every new edit with `capcut_clone_draft` (`base: "SABLON-YARIS", newName: "<name>", empty: true`) and never
edit the template itself.

## More effects: local catalog (optional)
```bash
npm run catalog
```
Open the Transitions, Effects and Filters panels in CapCut once (scroll a little), close CapCut, then run it. It reads
your own CapCut panel cache read-only (`<CapCut>/User Data/Cache/ressdk_db/*/rp.db`; SQLite may refresh its `rp.db-shm`
index file, the data itself is not touched), keeps free (non-VIP) items only and writes `catalog.local.json`
(git-ignored, do not share it). `capcut_list_effects` then also lists those names, in your CapCut UI language.

## Workflow (important)
1. **Close CapCut.** It autosaves on a timer and clobbers outside edits. `capcut_save` refuses if CapCut is running or
   the draft's `.locked` file exists (override with `force: true` only if you know it is safe).
2. Edits are a **session**: tools accumulate changes in memory. Nothing hits disk until **`capcut_save`**.
3. `capcut_save` writes `draft_content.json` (+ meta) **atomically** after a `.mcpbak` backup and runs `capcut_validate`.
4. Reopen the draft in CapCut and export from there.

All times at the tool boundary are in **seconds**.

## Tools
| Tool | Purpose |
|---|---|
| `capcut_list_drafts` | list drafts + duration + lock status |
| `capcut_read_timeline` | canvas, fps, tracks, every segment; `detail:true` adds transform, crop, effects, text style |
| `capcut_clone_draft` | copy a draft (optionally emptied) for a fresh build |
| `capcut_add_video / _image / _audio` | place media at a time on a track |
| `capcut_add_text` | text overlay |
| `capcut_add_track` | new video/audio/text/sticker track |
| `capcut_move_segment` / `_trim_segment` / `_split_segment` / `_delete_segment` | re-cut and retime |
| `capcut_set_props` | scale / position / rotation / opacity / volume / speed / visibility |
| `capcut_set_crop` | crop a clip to a part of its source frame |
| `capcut_duplicate_segment` | copy a clip to a new top track (picture-in-picture, webcam window) |
| `capcut_list_effects` | transitions, video effects, filters, stickers, masks, text animations you can use |
| `capcut_add_effect` | transition / video effect / filter by name |
| `capcut_add_sticker` / `capcut_add_mask` | sticker and mask copied from the template |
| `capcut_style_text` | outline, shadow, background box, size, colour (+ overflow warning) |
| `capcut_text_animation` | built-in text in / out / loop animations by name |
| `capcut_animate_text` | copy a text animation that exists in the template |
| `capcut_preview_frame` | approximate PNG of one moment (ffmpeg) |
| `capcut_raw_patch` | advanced deep-merge escape hatch |
| `capcut_validate` | overlaps, duplicate ids, missing media |
| `capcut_save` / `capcut_discard` | persist / drop the session |

## Companion skill
[`skills/capcut-reels/`](skills/capcut-reels/SKILL.md) (from upstream) teaches the production pipeline around these
tools. Copy the folder into your Claude skills directory to install it.

## Architecture
- `src/core.js`: pure engine (`CapCutDraft` class + `cloneDraft`/`listDrafts`). Testable without MCP.
- `src/server.js`: thin MCP stdio server; declares the core tools and loads the extensions.
- `src/ek-efekt.js` (effects, stickers, masks) and `src/ek-yazi.js` (text style, text animation, preview): extensions
  (`ek` = "extra" in Turkish).
- `scripts/build-catalog.mjs`: builds the optional local catalog.

## License & credits
Original capcut-mcp: MIT (c) 2026 [James Aldrin Boncales](https://jmsldrn.com), see `LICENSE-upstream`.
Fork changes: (c) 2026 Furkan Cavlak, MIT + attribution condition, see [`../LICENSE`](../LICENSE).

*Always keep a copy of important drafts before batch-editing. This software is provided "as is", without warranty.*
