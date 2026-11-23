#!/usr/bin/env node
// cc-kontrol: READ-ONLY check of finished CapCut race drafts.
// Prints canvas, length, validate() result, per-track segment counts, effect counts, and problems:
// gaps on the main video track, freezes (a segment reads past the end of its media file), scale > 2x.
//
// Usage:  node yaris/araclar/cc-kontrol.mjs <draft name> [<draft name> ...]
// Env:    CAPCUT_MCP_DIR   capcut-mcp folder (default: ../../capcut-mcp next to this file)
//         CAPCUT_DRAFTS_DIR / CAPCUT_TEMPLATE_DRAFT  same meaning as in capcut-mcp
// Needs ffprobe on PATH. Never writes anything.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv.length < 3) { console.error('usage: node cc-kontrol.mjs <draft name> [...]'); process.exit(1); }
process.env.CAPCUT_TEMPLATE_DRAFT ??= 'SABLON-YARIS';
const mcpDir = process.env.CAPCUT_MCP_DIR ? path.resolve(process.env.CAPCUT_MCP_DIR) : null;
const coreUrl = mcpDir ? pathToFileURL(path.join(mcpDir, 'src', 'core.js')).href : new URL('../../capcut-mcp/src/core.js', import.meta.url).href;
const core = await import(coreUrl);

const US = 1e6;
const BORING = ['speeds', 'canvases', 'sound_channel_mappings', 'vocal_separations', 'placeholder_infos', 'material_colors'];
const probeCache = {};
function probe(p) {
  if (p in probeCache) return probeCache[p];
  let d = null;
  try { d = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).toString()); } catch { d = null; }
  return (probeCache[p] = Number.isFinite(d) ? d : null);
}

for (const name of process.argv.slice(2)) {
  const d = new core.CapCutDraft(name);
  const c = d.content, m = c.materials;
  const byId = {};
  for (const k of Object.keys(m)) if (Array.isArray(m[k])) for (const x of m[k]) if (x && x.id) byId[x.id] = { kind: k, x };
  console.log(`\n=== ${name} === canvas ${c.canvas_config?.width}x${c.canvas_config?.height} | length ${(c.duration / US).toFixed(1)} s | validate ${JSON.stringify(d.validate()).slice(0, 160)}`);
  const counts = {}, problems = [];
  c.tracks.forEach((t, ti) => {
    const segs = [...t.segments].sort((a, b) => a.target_timerange.start - b.target_timerange.start);
    let end = 0;
    for (const s of segs) {
      const st = s.target_timerange.start / US, du = s.target_timerange.duration / US;
      if (ti === 0 && t.type === 'video' && st - end > 0.05) problems.push(`gap on main track ${end.toFixed(2)}-${st.toFixed(2)} s`);
      end = Math.max(end, st + du);
      for (const r of s.extra_material_refs || []) { const k = byId[r]?.kind; if (k && !BORING.includes(k)) counts[k] = (counts[k] || 0) + 1; }
      const mat = byId[s.material_id];
      if (mat && (mat.kind === 'videos' || mat.kind === 'audios') && mat.x.type !== 'photo') {
        const fileDur = mat.x.path ? probe(mat.x.path) : null;
        const srcEnd = (s.source_timerange.start + s.source_timerange.duration) / US;
        if (fileDur && srcEnd > fileDur + 0.1) problems.push(`track ${ti} ${t.type} @${st.toFixed(1)}s source ends ${srcEnd.toFixed(1)} s > file ${fileDur.toFixed(1)} s (${path.basename(mat.x.path)}) -> freeze`);
        if (mat.kind === 'videos') {
          const sc = s.clip?.scale?.x || 1;
          if (sc > 2.05) problems.push(`track ${ti} @${st.toFixed(1)}s scale ${sc.toFixed(2)} (> 2x)`);
        }
      }
    }
    console.log(`  track ${ti} ${t.type}: ${segs.length} seg, ends ${end.toFixed(1)} s`);
  });
  console.log(`  refs: ${JSON.stringify(counts)}`);
  const fx = ['video_effects', 'effects', 'transitions', 'stickers', 'common_mask', 'material_animations', 'texts', 'audios', 'videos'];
  console.log(`  materials: ${fx.map(k => `${k}=${(m[k] || []).length}`).join(' ')}`);
  console.log(problems.length ? '  PROBLEMS:\n   - ' + problems.join('\n   - ') : '  no problems found');
}
