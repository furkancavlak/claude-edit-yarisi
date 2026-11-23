# Changes in this fork (compared to upstream capcut-mcp v0.1.0, commit 50beafd)

Found while two models (Claude Opus 5.5 and Claude Fable 5.2) edited real footage with this server in an edit race.

## Bug fixes

1. **Video length was wrong (clips froze).** For video files `_addMedia` kept the material `duration` of the
   template draft's first clip (in our case 19.7 s) instead of the new file's length (audio was already probed).
   CapCut then treated every video file as that long, so a longer clip froze after that point and the timeline lied about
   what was usable.
   Now video and audio material durations are both probed from the file with ffprobe (`src/core.js`, `_addMedia`).
2. **Images had the same wrong duration.** Stills now get CapCut's own photo duration (3 h, `10800000000` µs);
   the segment's own time range trims it, exactly like CapCut does when you drop a photo on the timeline.
3. **Text stroke, shadow and background were saved but not drawn.** CapCut only renders them when the text
   material's `check_flag` has the matching bit: stroke `8`, background `16`, shadow `32` (base value `7`).
   `capcut_style_text` sets and clears these bits together with the style data (`src/ek-yazi.js`).
4. **Cloned drafts came out locked.** `capcut_clone_draft` copied CapCut's `.locked` file, so the new draft looked
   "open in CapCut" and `capcut_save` refused it. The lock file is no longer copied (`cloneDraft`).

## New tools

| Tool | What it does |
|---|---|
| `capcut_set_crop` | crop a video/photo segment to a rectangle of the source frame (fractions 0..1); a segment that shares its material gets its own copy first |
| `capcut_duplicate_segment` | copy a video/photo segment to a new top video track (picture-in-picture, e.g. a streamer webcam window: duplicate, crop the copy, scale + move it) |
| `capcut_read_timeline` `detail:true` | per segment: transform, source size, crop, linked transitions / effects / filters / masks / animations, text and its style |
| `capcut_list_effects` | everything the effect tools can use: template items + local catalog items, names and default durations |
| `capcut_add_effect` | add a transition (stored on the earlier clip of a pair), a video effect or a filter, by name |
| `capcut_add_sticker` | add a sticker copied from the template draft |
| `capcut_add_mask` | add a mask copied from the template draft, with width / height / centre / round corner / feather / invert |
| `capcut_animate_text` | copy a text in/out animation that exists in the template draft onto a text segment |
| `capcut_style_text` | outline, drop shadow, background box, size, colour; warns when a line is likely wider than the canvas |
| `capcut_text_animation` | CapCut built-in text animations by name (in / out / loop), no template needed (CapCut downloads them on open) |
| `capcut_preview_frame` | approximate PNG of one moment of the timeline (ffmpeg): layers, crop, scale, position, texts |

## Other changes

- `CAPCUT_TEMPLATE_DRAFT` now defaults to `SABLON-YARIS` (upstream: `0723`, the upstream author's own draft).
  The effect, sticker, mask and text-animation tools read the same template; `CAPCUT_EFFECT_TEMPLATE` and
  `CAPCUT_MASK_TEMPLATE` can point them at other drafts.
- **Local effect catalog instead of shipped data.** `npm run catalog` (`scripts/build-catalog.mjs`) reads the panel
  cache of *your own* CapCut install (`<CapCut>/User Data/Cache/ressdk_db/*/rp.db`, read-only), keeps only free
  (non-VIP) transitions, video effects and filters, and writes `catalog.local.json` (git-ignored). `src/ek-efekt.js`
  loads that file (or the path in `CAPCUT_CATALOG`). No CapCut data is part of this repository.
- `capcut_read_timeline` shows unsaved session edits when the draft is open in the current session.
- Some helpers of `src/core.js` are exported (`TEMPLATE_DRAFT`, `uid`, `clone`, `findMat`, `harvest`, `probeDur`, `probeWH`).
- `server.js` loads the extension modules `src/ek-efekt.js` and `src/ek-yazi.js`; if one fails, the server still starts and
  prints why on stderr.
- `capcut_preview_frame` font can be set with `CAPCUT_PREVIEW_FONT` (default Arial Bold on Windows / macOS, DejaVu Sans Bold on Linux).

## Known limits (still true)

- The draft format is undocumented; a CapCut update can change it. Keep the `.mcpbak` backups.
- Catalog items are not cloned from a real CapCut-made material, so CapCut must download them by id when the draft
  opens (internet needed). Template items are the safest.
- The race showed the CapCut route is harder for a model than writing the video as code: it needed many more tool
  calls and the result was weaker (see `../SONUCLAR.md`).
