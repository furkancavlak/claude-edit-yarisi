# NOTICE: where this capcut-mcp comes from

This folder is a **fork of [capcut-mcp](https://github.com/JmsLdrn/capcut-mcp)** by
**James Aldrin Boncales** ([jmsldrn.com](https://jmsldrn.com)), MIT License, Copyright (c) 2026 James Aldrin Boncales.
The original license text is kept unchanged in [`LICENSE-upstream`](LICENSE-upstream). Forked from upstream commit
`50beafd` ("capcut-mcp v0.1.0 — public release prep"). All the hard groundwork (clone-from-template engine, atomic
save with backup, validation, the MCP server) is his.

Changes and additions made for the edit race (Furkan Cavlak, 2026) are under the repository root
[`LICENSE`](../LICENSE) (MIT + attribution condition). They are listed in [`CHANGES.md`](CHANGES.md).

| File | Origin |
|---|---|
| `src/core.js` | upstream, with our fixes and new methods (see CHANGES.md) |
| `src/server.js` | upstream, with new tools registered and extension loading |
| `src/ek-efekt.js` | new (effects, transitions, filters, stickers, masks, template text animations) |
| `src/ek-yazi.js` | new (text style, built-in text animations, preview frame) |
| `scripts/build-catalog.mjs` | new (builds `catalog.local.json` from your own CapCut cache) |
| `skills/capcut-reels/SKILL.md` | upstream, with a short section about the new tools |
| `README.md`, `mcp.json.example`, `package.json`, `package-lock.json` | upstream, edited for the fork |

Facts taken from other open-source projects (numbers only, no code copied):
- The `check_flag` bit values for text stroke / background / shadow (8 / 16 / 32) and the resource ids of CapCut's
  built-in text animations used in `src/ek-yazi.js` were looked up in the open-source
  [VectCutAPI](https://github.com/sun-guannan/VectCutAPI) copy of [pyJianYingDraft](https://github.com/GuanYixuan/pyJianYingDraft)
  (`metadata/capcut_text_animation_meta.py`, `text_segment.py`).

Not affiliated with CapCut or ByteDance. No CapCut data, drafts, effects or media are included in this repository.
