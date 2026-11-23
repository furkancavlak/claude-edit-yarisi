#!/usr/bin/env node
// build-catalog: make catalog.local.json from YOUR OWN CapCut desktop panel cache (read-only).
//
// CapCut keeps the panel lists it has shown you (transitions, video effects, filters ...) in SQLite files:
//   <CapCut>/User Data/Cache/ressdk_db/<account>/rp.db   (table http_cache, urls starting with /artist/)
// This script opens them READ-ONLY, keeps only free (non-VIP) transitions, video effects and filters, and writes
//   capcut-mcp/catalog.local.json   (git-ignored; never commit or share it)
// ek-efekt.js loads that file so capcut_add_effect can use those items by name. Names are in your CapCut UI language.
// Nothing is downloaded. Open each panel (Transitions, Effects, Filters) once in CapCut first so the cache is filled.
//
// Usage:  node scripts/build-catalog.mjs [--cache <CapCut Cache dir>] [--db <rp.db> ...] [--out <file>]
// Needs Node 22.13+ (built-in node:sqlite).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const many = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : [])).filter(Boolean);

let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); }
catch { console.error('This script needs Node 22.13 or newer (built-in node:sqlite). Your Node: ' + process.version); process.exit(2); }

const defaultCache = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'CapCut', 'User Data', 'Cache')
  : path.join(os.homedir(), 'Movies', 'CapCut', 'User Data', 'Cache');
const cacheDir = opt('--cache') || process.env.CAPCUT_CACHE_DIR || defaultCache;
const out = opt('--out') || fileURLToPath(new URL('../catalog.local.json', import.meta.url));

let dbs = many('--db');
if (!dbs.length) {
  const root = path.join(cacheDir, 'ressdk_db');
  try { dbs = fs.readdirSync(root).map(d => path.join(root, d, 'rp.db')).filter(f => fs.existsSync(f)); } catch {}
}
if (!dbs.length) {
  console.error(`No rp.db found under ${path.join(cacheDir, 'ressdk_db')}.\nOpen CapCut, look at the Transitions / Effects / Filters panels once, close CapCut, then run again (or pass --cache / --db).`);
  process.exit(1);
}

// collect every { common_attr: { effect_id, ... } } object, first occurrence wins (keeps CapCut's panel order)
const items = new Map();
function walk(o) {
  if (Array.isArray(o)) { for (const v of o) walk(v); return; }
  if (!o || typeof o !== 'object') return;
  const ca = o.common_attr;
  if (ca && typeof ca === 'object' && ca.effect_id) { if (!items.has(ca.effect_id)) items.set(ca.effect_id, ca); return; }
  for (const v of Object.values(o)) walk(v);
}
let rows = 0;
for (const f of dbs) {
  let db;
  try { db = new DatabaseSync(f, { readOnly: true }); }
  catch (e) { console.error(`Cannot open ${f} read-only (${e.message}). Close CapCut and try again.`); continue; }
  try {
    for (const r of db.prepare("SELECT response_body FROM http_cache WHERE url LIKE '/artist/%'").iterate()) {
      rows++;
      const body = Buffer.isBuffer(r.response_body) || r.response_body instanceof Uint8Array ? Buffer.from(r.response_body).toString('utf8') : String(r.response_body || '');
      try { walk(JSON.parse(body)); } catch { /* not JSON */ }
    }
  } catch (e) { console.error(`Skipped ${f}: ${e.message}`); }
  finally { db.close(); }
}

const j = (s) => { try { return typeof s === 'string' && s ? JSON.parse(s) : (s && typeof s === 'object' ? s : {}); } catch { return {}; } };
const isVip = (ca) => j(ca.extra).is_vip === true || j(ca.business_info?.json_str).is_vip === true;
const round2 = (x) => Math.round(x * 100) / 100;

const cat = { transitions: [], video_effects: [], filters: [] };
const seenName = { 19: new Set(), 7: new Set(), 12: new Set() };   // one item per name and kind (CapCut sometimes lists two ids under one name)
let vip = 0;
for (const ca of items.values()) {
  const t = Number(ca.effect_type);
  if (![19, 7, 12].includes(t)) continue;
  if (isVip(ca)) { vip++; continue; }
  const name = ca.title, id = String(ca.effect_id), md5 = ca.md5 || '';
  if (!name || seenName[t].has(name)) continue;
  seenName[t].add(name);
  const sdk = j(ca.sdk_extra);
  if (t === 19) {          // transition
    const tr = sdk.transition || {};
    cat.transitions.push([name, id, md5, round2(Number(tr.defaultDura) || 0.5), tr.isOverlap !== false]);
  } else if (t === 7) {    // video effect
    const ps = (sdk.setting && sdk.setting.effect_adjust_params) || [];
    cat.video_effects.push([name, id, md5, ps.filter(p => p && p.effect_key).map(p => [p.effect_key, p.default ?? 0])]);
  } else {                 // filter
    cat.filters.push([name, id, md5, false]);
  }
}

const result = {
  note: 'Built locally from this machine own CapCut cache by scripts/build-catalog.mjs. Free items only. Do not commit or share.',
  builtAt: new Date().toISOString(),
  effectCacheDir: path.join(cacheDir, 'effect').split(path.sep).join('/'),
  transitions: cat.transitions, video_effects: cat.video_effects, filters: cat.filters,
};
fs.writeFileSync(out, JSON.stringify(result));
console.log(`read ${dbs.length} rp.db file(s), ${rows} cached panel responses, ${items.size} items`);
console.log(`free: ${cat.transitions.length} transitions, ${cat.video_effects.length} video effects, ${cat.filters.length} filters (skipped ${vip} VIP)`);
console.log(`wrote ${out}`);
if (!cat.transitions.length && !cat.video_effects.length && !cat.filters.length)
  console.log('Catalog is empty: open the Transitions, Effects and Filters panels in CapCut once (scroll a little), close CapCut, run again.');
