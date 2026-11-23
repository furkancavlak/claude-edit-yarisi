// ek-efekt: effect / transition / filter / sticker / mask tools for capcut-mcp.
// Everything is cloned from real CapCut-made materials in YOUR template draft (CAPCUT_TEMPLATE_DRAFT, default SABLON-YARIS),
// so the JSON matches what CapCut itself writes. Optional extra items come from a local catalog built from your own
// CapCut cache (see below). Only DRAFTS_DIR and TEMPLATE_DRAFT are taken from core.js.
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { DRAFTS_DIR, TEMPLATE_DRAFT } from './core.js';

const US = 1e6;
const uid = () => crypto.randomUUID().toUpperCase();
const clone = o => JSON.parse(JSON.stringify(o));
const EFFECT_TEMPLATE = process.env.CAPCUT_EFFECT_TEMPLATE || TEMPLATE_DRAFT;
const MASK_TEMPLATE = process.env.CAPCUT_MASK_TEMPLATE || EFFECT_TEMPLATE;

const readDraft = name => {
  const f = path.join(DRAFTS_DIR, name, 'draft_content.json');
  if (!fs.existsSync(f)) throw new Error(`template draft "${name}" not found in ${DRAFTS_DIR}. Make it once in CapCut (see AGENTS.md, "Template draft") or set CAPCUT_TEMPLATE_DRAFT.`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
};
let _tpl = null, _mask = null;
const tpl = () => _tpl || (_tpl = readDraft(EFFECT_TEMPLATE));
const maskTpl = () => _mask || (_mask = readDraft(MASK_TEMPLATE));
const safeMasks = () => { try { return maskTpl().materials.common_mask || []; } catch { return []; } };

// kind -> materials array key + predicate for the template material
const KINDS = {
  transition: { key: 'transitions', ok: m => m.type === 'transition' },
  video_effect: { key: 'video_effects', ok: m => m.type === 'video_effect' },
  filter: { key: 'effects', ok: m => m.type === 'filter' },
};

function findMat(content, id) {
  for (const k of Object.keys(content.materials || {})) {
    const arr = content.materials[k];
    if (Array.isArray(arr)) { const m = arr.find(x => x && x.id === id); if (m) return [k, m]; }
  }
  return [null, null];
}
const mats = (d, key) => (d.content.materials[key] = d.content.materials[key] || []);
function findSeg(d, segId) {
  for (const tr of d.content.tracks) { const s = (tr.segments || []).find(x => x.id === segId); if (s) return { tr, s }; }
  throw new Error(`segment not found: ${segId}`);
}
function nextRender(d) {
  let m = -1;
  for (const tr of d.content.tracks) for (const s of (tr.segments || [])) if ((s.render_index || 0) > m) m = s.render_index;
  return m + 1;
}
function recalcDuration(d) {
  let max = 0;
  for (const tr of d.content.tracks) for (const s of (tr.segments || [])) max = Math.max(max, s.target_timerange.start + s.target_timerange.duration);
  d.content.duration = Math.max(d.content.duration || 0, max);
}
// all distinct items of a list (dedupe by resource/effect id, else name)
function uniq(list) {
  const seen = new Set(), out = [];
  for (const m of list) { const k = String(m.resource_id || m.effect_id || m.sticker_id || m.name || m.id); if (seen.has(k)) continue; seen.add(k); out.push(m); }
  return out;
}
// case-insensitive name pick; no name = first. Error lists the available names.
const norm = s => String(s || '').replace(/İ/g, 'i').replace(/ı/g, 'i').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function pick(list, name, what) {
  if (!list.length) throw new Error(`template ${EFFECT_TEMPLATE} has no ${what}`);
  if (name == null || name === '') return list[0];
  const n = norm(name);
  const m = list.find(x => norm(x.name) === n) || list.find(x => norm(x.name).includes(n));
  if (!m) throw new Error(`no ${what} named "${name}". Available: ${list.map(x => x.name).join(', ')}`);
  return m;
}
// ---------------------------------------------------------------- local catalog
// Optional extra items (free transitions / video effects / filters) read from YOUR OWN CapCut panel cache.
// Nothing from CapCut is shipped with this repo: `npm run catalog` (scripts/build-catalog.mjs) reads
// <CapCut>/User Data/Cache/ressdk_db/*/rp.db on this machine and writes catalog.local.json (git-ignored).
// Without that file only the items in the template draft are available.
//   transitions: [name, resource_id, md5, defaultDurSec, is_overlap]
//   video_effects: [name, resource_id, md5, [[param, default], ...]]
//   filters: [name, resource_id, md5, vip]
// md5 = folder name CapCut uses in Cache/effect/<resource_id>/<md5>. Items you never used are not on disk yet;
// CapCut fetches them by id when the draft opens (internet needed).
const CATALOG_FILE = process.env.CAPCUT_CATALOG || fileURLToPath(new URL('../catalog.local.json', import.meta.url));
let CATALOG = { transitions: [], video_effects: [], filters: [] }, CATALOG_INFO = { file: CATALOG_FILE, loaded: false };
try {
  const j = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
  CATALOG = { transitions: j.transitions || [], video_effects: j.video_effects || [], filters: j.filters || [] };
  CATALOG_INFO = { file: CATALOG_FILE, loaded: true, builtAt: j.builtAt, cacheDir: j.effectCacheDir };
} catch { /* no local catalog: template items only */ }
const defaultCacheRoot = () => process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'CapCut', 'User Data', 'Cache')
  : path.join(os.homedir(), 'Movies', 'CapCut', 'User Data', 'Cache');
const CACHE_DIR = (CATALOG_INFO.cacheDir || process.env.CAPCUT_EFFECT_CACHE_DIR || path.join(defaultCacheRoot(), 'effect')).split(String.fromCharCode(92)).join('/');
const CAT_KEY = { transition: 'transitions', video_effect: 'video_effects', filter: 'filters' };
function catalogMaterial(kind, name, exactOnly) {
  const rows = CATALOG[CAT_KEY[kind]] || [];
  if (!rows.length) return null;
  let r;
  if (name == null || name === '') r = rows[0];
  else { const n = norm(name); r = rows.find(x => norm(x[0]) === n) || (exactOnly ? null : rows.find(x => norm(x[0]).includes(n))); }
  if (!r) return null;
  const K = KINDS[kind];
  const base = (tpl().materials[K.key] || []).find(K.ok);
  const c = base ? clone(base) : {};
  const rid = r[1];
  Object.assign(c, { name: r[0], effect_id: rid, resource_id: rid, path: CACHE_DIR + '/' + rid + '/' + r[2], category_id: '', category_name: '', request_id: '', type: kind });
  if (kind === 'transition') { c.duration = Math.round(r[3] * US); c.is_overlap = !!r[4]; c.adjust_params = []; c.third_resource_id = '0'; c.source_platform = 1; c.platform = 'all'; }
  if (kind === 'video_effect') { c.adjust_params = (r[3] || []).map(([n, v]) => ({ name: n, value: v, default_value: v })); c.value = 1; }
  if (kind === 'filter') { c.value = 1; c.adjust_params = []; c.third_resource_id = '0'; }
  return c;
}
function templateMaterial(kind, name) {
  const K = KINDS[kind];
  if (!K) throw new Error(`unknown kind "${kind}" (use transition | video_effect | filter)`);
  const list = uniq((tpl().materials[K.key] || []).filter(K.ok));
  const has = name != null && name !== '';
  if (!has && list.length) return { K, m: list[0] };          // default stays the template item
  const n = has ? norm(name) : '';
  let m = has ? list.find(x => norm(x.name) === n) : null;     // 1 template exact
  if (!m && has) m = catalogMaterial(kind, name, true);        // 2 catalog exact
  if (!m && has) m = list.find(x => norm(x.name).includes(n)); // 3 template partial
  if (!m) m = catalogMaterial(kind, name, false);              // 4 catalog partial / first
  if (!m) throw new Error(`no ${kind} named "${name}". Template: ${list.map(x => x.name).join(', ') || '-'}. Catalog: ${(CATALOG[CAT_KEY[kind]] || []).map(x => x[0]).join(', ')}`);
  return { K, m };
}
const animName = e => (e.animations || []).map(a => a.name).filter(Boolean).join(' + ');
function templateAnims() {
  return uniq((tpl().materials.material_animations || []).filter(e => (e.animations || []).length).map(e => ({ ...e, name: animName(e) || e.id })));
}
const HINT = ' First call capcut_list_effects to see every available item, then pass "name" and VARY the choices instead of repeating the same one.';

// ---------------------------------------------------------------- list
export function listEffects() {
  const c = tpl(), M = c.materials;
  const strip = (m, extra = {}) => ({ name: m.name, resource_id: m.resource_id || m.effect_id, ...extra });
  return {
    template: EFFECT_TEMPLATE,
    note: 'Pass any "name" below to capcut_add_effect / capcut_add_sticker / capcut_add_mask / capcut_animate_text (case-insensitive). Template items are cloned from real CapCut-made materials in the template draft; catalog items come from the local catalog (if built).',
    transitions: uniq(M.transitions || []).map(m => strip(m, { defaultDurSec: m.duration / US, is_overlap: m.is_overlap })),
    video_effects: uniq(M.video_effects || []).map(m => strip(m, { adjust_params: (m.adjust_params || []).map(p => p.name) })),
    filters: uniq((M.effects || []).filter(m => m.type === 'filter')).map(m => strip(m, { intensity: m.value })),
    stickers: uniq(M.stickers || []).map(m => strip(m, { sticker_id: m.sticker_id })),
    catalog: {
      note: CATALOG_INFO.loaded ? 'Local catalog built from this machine own CapCut panel cache (names in your CapCut UI language, free items only). Pass these names to capcut_add_effect too; template items take priority on name clashes. Items are NOT cloned from a real CapCut draft: CapCut must have or fetch the effect by id when the draft opens.' : 'No local catalog (' + CATALOG_INFO.file + ' missing). Run `npm run catalog` in the capcut-mcp folder to build it from your own CapCut cache; until then only template items work.',
      transitions: CATALOG.transitions.map(r => ({ name: r[0], resource_id: r[1], defaultDurSec: r[3], is_overlap: !!r[4] })),
      video_effects: CATALOG.video_effects.map(r => ({ name: r[0], resource_id: r[1], adjust_params: r[3].map(p => p[0]) })),
      filters: CATALOG.filters.map(r => ({ name: r[0], resource_id: r[1] })),
    },
    text_animations: templateAnims().map(e => ({ name: e.name, types: (e.animations || []).map(a => a.type || a.category_name) })),
    masks: uniq(safeMasks()).map(m => strip(m, { shape: m.resource_type, config: m.config })),
  };
}

// ---------------------------------------------------------------- effect
export function addEffect(draft, { segmentId, kind, durSec, name }) {
  const { K, m } = templateMaterial(kind, name);
  const { tr, s } = findSeg(draft, segmentId);
  if (!['video', 'image', 'photo'].includes(tr.type)) throw new Error(`segment ${segmentId} is on a ${tr.type} track; effects go on video segments`);
  // validate transition target before touching anything
  let next = null;
  if (kind === 'transition') {
    const sorted = [...tr.segments].sort((a, b) => a.target_timerange.start - b.target_timerange.start);
    next = sorted[sorted.indexOf(s) + 1];
    if (!next) throw new Error('a transition needs a following clip on the same track; this segment is the last one');
  }
  // replace an existing one of the same kind on this segment
  const arr = mats(draft, K.key);
  s.extra_material_refs = (s.extra_material_refs || []).filter(id => {
    const [k, old] = findMat(draft.content, id);
    if (k === K.key && old && K.ok(old)) { const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1); return false; }
    return true;
  });
  const c = clone(m); c.id = uid();
  let info = {};
  if (kind === 'transition') {
    const cap = Math.floor(Math.min(s.target_timerange.duration, next.target_timerange.duration) / 2);
    const d = Math.min(durSec != null ? Math.round(durSec * US) : c.duration, cap);
    c.duration = d;
    info = { betweenSegments: [s.id, next.id], durSec: d / US, storedOn: 'first (earlier) clip' };
  } else if (kind === 'video_effect') {
    c.render_index = Math.max(11000, nextRender(draft)); // effects layer sits above clips, as in the template
  }
  arr.push(c);
  s.extra_material_refs.push(c.id);
  return { ok: true, kind, name: c.name, materialId: c.id, segmentId, ...info };
}

// ---------------------------------------------------------------- sticker
export function addSticker(draft, { atSec, durSec, scale, posX, posY, name }) {
  const T = tpl();
  const tTrack = T.tracks.find(t => t.type === 'sticker');
  const tMat = pick(uniq(T.materials.stickers || []), name, 'sticker');
  let tSeg = null;
  for (const t of T.tracks) if (t.type === 'sticker') { tSeg = (t.segments || []).find(x => x.material_id === tMat.id); if (tSeg) break; }
  if (!tSeg && tTrack) tSeg = tTrack.segments[0];   // sticker material without own segment: reuse first sticker segment layout
  if (!tSeg || !tTrack) throw new Error(`template ${EFFECT_TEMPLATE} has no sticker segment`);
  const at = Math.round(atSec * US), dur = Math.round(durSec * US);
  if (dur <= 0) throw new Error('durSec must be > 0');

  const mat = clone(tMat); mat.id = uid(); mats(draft, 'stickers').push(mat);
  const refs = (tSeg.extra_material_refs || []).map(id => {
    const [k, m] = findMat(T, id); if (!m) return null;
    const cm = clone(m); cm.id = uid(); mats(draft, k).push(cm); return cm.id;
  }).filter(Boolean);

  // a sticker track with free room, else clone the template's (emptied) track
  const free = t => t.type === 'sticker' && !(t.segments || []).some(x => at < x.target_timerange.start + x.target_timerange.duration && x.target_timerange.start < at + dur);
  let track = draft.content.tracks.find(free);
  if (!track) { track = clone(tTrack); track.id = uid(); track.segments = []; draft.content.tracks.push(track); }

  const seg = clone(tSeg); seg.id = uid(); seg.material_id = mat.id; seg.extra_material_refs = refs;
  seg.target_timerange = { start: at, duration: dur };
  seg.clip = seg.clip || { alpha: 1, flip: { horizontal: false, vertical: false }, rotation: 0, scale: { x: 1, y: 1 }, transform: { x: 0, y: 0 } };
  if (scale != null) seg.clip.scale = { x: scale, y: scale };   // same mapping as core.js _applyProps
  if (posX != null) seg.clip.transform.x = posX;
  if (posY != null) seg.clip.transform.y = posY;
  seg.render_index = nextRender(draft);
  seg.track_render_index = draft.content.tracks.indexOf(track);
  track.segments.push(seg);
  recalcDuration(draft);
  return { ok: true, segmentId: seg.id, sticker: mat.name, startSec: atSec, durSec, trackIndex: draft.content.tracks.indexOf(track) };
}

// ---------------------------------------------------------------- mask
export function addMask(draft, { segmentId, width, height, centerX, centerY, roundCorner, feather, invert, name }) {
  const tm = pick(uniq(safeMasks()), name, 'mask');
  const { s } = findSeg(draft, segmentId);
  const arr = mats(draft, 'common_mask');
  s.extra_material_refs = (s.extra_material_refs || []).filter(id => { const i = arr.findIndex(x => x.id === id); if (i >= 0) { arr.splice(i, 1); return false; } return true; });
  const m = clone(tm); m.id = uid(); m.constant_material_id = uid();
  const cfg = m.config;
  if (width != null) cfg.width = width;
  if (height != null) cfg.height = height;
  if (centerX != null) cfg.centerX = centerX;
  if (centerY != null) cfg.centerY = centerY;
  if (roundCorner != null) cfg.roundCorner = roundCorner;
  if (feather != null) cfg.feather = feather;
  if (invert != null) cfg.invert = !!invert;
  arr.push(m); s.extra_material_refs.push(m.id); s.enable_video_mask = true;
  return { ok: true, segmentId, maskId: m.id, shape: m.name, config: cfg };
}

// ---------------------------------------------------------------- text animation
export function animateText(draft, { segmentId, name }) {
  const list = templateAnims();
  if (!list.length) throw new Error(`template ${EFFECT_TEMPLATE} has no text animation yet (in CapCut, give its text layer an in/out animation first), or use capcut_text_animation`);
  const e = pick(list, name, 'text animation');
  const { tr, s } = findSeg(draft, segmentId);
  if (tr.type !== 'text') throw new Error(`segment ${segmentId} is on a ${tr.type} track; pass a text segment`);
  const arr = mats(draft, 'material_animations');
  s.extra_material_refs = (s.extra_material_refs || []).filter(id => { const i = arr.findIndex(x => x.id === id); if (i >= 0) { arr.splice(i, 1); return false; } return true; });
  const c = clone(e); delete c.name; c.id = uid();
  arr.push(c); s.extra_material_refs.push(c.id);
  return { ok: true, segmentId, animation: e.name, materialId: c.id };
}

// ---------------------------------------------------------------- register
export function register(s, { get, wrap, z }) {
  s.tool('capcut_list_effects',
    'Read-only. Lists the transitions, video effects, filters, stickers and masks that capcut_add_effect / capcut_add_sticker / capcut_add_mask can use (cloned from real CapCut-made items in a template draft, so the set is small). Call this first to learn names and default durations.',
    {}, wrap(async () => listEffects()));

  s.tool('capcut_add_effect',
    'Attach a transition, a video effect or a filter to a video segment. kind="transition": CapCut stores a transition on the EARLIER clip (A) of a pair, with is_overlap=true; it blends A into the next clip B on the same track. So pass the segmentId of A (not B); A must have a clip after it. durSec is the transition length (default about 2 s; auto-capped at half of the shorter clip). kind="video_effect": the effect runs over the whole segment; durSec is ignored. kind="filter": colour filter over the whole segment; durSec ignored. Adding the same kind twice to one segment REPLACES the old one. Optional name picks a specific item (case-insensitive; default = first).' + HINT + ' Get segment ids from capcut_read_timeline; then capcut_validate and capcut_save (CapCut must be closed).',
    { draft: z.string(), segmentId: z.string().describe('video segment id; for transitions the first clip of the pair'), kind: z.enum(['transition', 'video_effect', 'filter']), durSec: z.number().optional().describe('transition length in seconds (transition only)'), name: z.string().optional().describe('item name from capcut_list_effects; default first') },
    wrap(async a => addEffect(get(a.draft), a)));

  s.tool('capcut_add_sticker',
    'Add a sticker copied from the template draft (it must contain at least one sticker) on a sticker track at atSec for durSec seconds. A sticker track is created if none has free room. It is placed above all existing layers. scale: 1 = natural size (same as capcut_set_props); posX/posY: offsets from the frame centre, 0 = centre. Optional name picks a sticker from capcut_list_effects (default = first).' + HINT,
    { draft: z.string(), atSec: z.number(), durSec: z.number(), scale: z.number().optional(), posX: z.number().optional(), posY: z.number().optional(), name: z.string().optional() },
    wrap(async a => addSticker(get(a.draft), a)));

  s.tool('capcut_add_mask',
    'Add a mask to a video segment (copied from a real CapCut mask in the template draft; its shape is whatever mask you put there). Geometry is in CapCut units: width/height are fractions of the clip frame (1 = full), centerX/centerY are offsets from the clip centre (0,0 = centre), roundCorner 0..1, feather 0 = hard edge, invert flips inside/outside. Defaults: the template mask geometry. A second mask on the same segment replaces the first. Optional name picks a mask shape from capcut_list_effects (default = first).' + HINT,
    { draft: z.string(), segmentId: z.string(), width: z.number().optional(), height: z.number().optional(), centerX: z.number().optional(), centerY: z.number().optional(), roundCorner: z.number().optional(), feather: z.number().optional(), invert: z.boolean().optional(), name: z.string().optional() },
    wrap(async a => addMask(get(a.draft), a)));

  s.tool('capcut_animate_text',
    'Give a text segment an in/out animation (CapCut keeps it in materials.material_animations, linked from the text segment). Pass the text segmentId (from capcut_read_timeline) and optionally name (an entry of text_animations in capcut_list_effects, case-insensitive; default first). An existing animation on that segment is replaced. Errors with "template has no text animation yet" if the template has none.' + HINT,
    { draft: z.string(), segmentId: z.string().describe('text segment id'), name: z.string().optional() },
    wrap(async a => animateText(get(a.draft), a)));
}
