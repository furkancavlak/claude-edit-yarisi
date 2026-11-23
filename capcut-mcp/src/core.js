// capcut-core: read/edit CapCut desktop draft projects by cloning real templates
// out of a base draft (the only reliable way to produce valid CapCut JSON).
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';

// ---- where the drafts live (override with CAPCUT_DRAFTS_DIR) ----
const STD_WIN = path.join(os.homedir(), 'AppData/Local/CapCut/User Data/Projects/com.lveditor.draft');
const STD_MAC = path.join(os.homedir(), 'Movies/CapCut/User Data/Projects/com.lveditor.draft');
const CANDIDATES = [
  process.env.CAPCUT_DRAFTS_DIR,
  'D:/Capcut/CapCut Drafts',
  STD_WIN,
  STD_MAC,
].filter(Boolean);
// pick the first candidate that exists; otherwise fall back to the OS-standard CapCut location
export const DRAFTS_DIR =
  CANDIDATES.find(d => { try { return fs.statSync(d).isDirectory(); } catch { return false; } })
  || (process.platform === 'win32' ? STD_WIN : STD_MAC);
// a draft known to contain video/text/audio layers, used to harvest templates.
// Fork default: SABLON-YARIS (a draft you make once in your own CapCut, see AGENTS.md). Upstream default was '0723'.
export const TEMPLATE_DRAFT = process.env.CAPCUT_TEMPLATE_DRAFT || 'SABLON-YARIS';

export const uid = () => crypto.randomUUID().toUpperCase();
export const clone = o => JSON.parse(JSON.stringify(o));
const US = 1e6;

export function probeDur(file) {
  try { return Math.round(parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${file}"`).toString().trim()) * US); }
  catch { return 5 * US; }
}
export function probeWH(file) {
  try { const [w, h] = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "${file}"`).toString().trim().split('x').map(Number); return { w: w || 1920, h: h || 1080 }; }
  catch { return { w: 1920, h: 1080 }; }
}

// ---- template harvesting: pull one segment (+its material +extra_material_refs +a track) per type ----
export function findMat(content, id) {
  for (const k of Object.keys(content.materials || {})) {
    if (Array.isArray(content.materials[k])) { const m = content.materials[k].find(x => x && x.id === id); if (m) return [k, m]; }
  }
  return [null, null];
}
export function harvest(content) {
  const t = { tracks: {} };
  for (const track of content.tracks || []) {
    if (!t.tracks[track.type]) { const tk = clone(track); tk.segments = []; t.tracks[track.type] = tk; }
    for (const seg of (track.segments || [])) {
      const [, mat] = findMat(content, seg.material_id);
      const type = mat && mat.type ? mat.type : track.type;
      if (t[type]) continue;
      if (!mat) continue;
      const refs = (seg.extra_material_refs || []).map(id => { const [k, m] = findMat(content, id); return m ? { k, m: clone(m) } : null; }).filter(Boolean);
      t[type] = { seg: clone(seg), mat: clone(mat), refs };
    }
  }
  return t;
}

export function listDrafts() {
  let names = [];
  try { names = fs.readdirSync(DRAFTS_DIR).filter(n => { try { return fs.statSync(path.join(DRAFTS_DIR, n)).isDirectory() && fs.existsSync(path.join(DRAFTS_DIR, n, 'draft_content.json')); } catch { return false; } }); } catch {}
  return names.map(name => {
    const dir = path.join(DRAFTS_DIR, name);
    let dur = null;
    try { dur = JSON.parse(fs.readFileSync(path.join(dir, 'draft_content.json'), 'utf8')).duration / US; } catch {}
    return { name, locked: fs.existsSync(path.join(dir, '.locked')), durationSec: dur };
  });
}

// is CapCut running? (writing while open gets clobbered by autosave)
function capcutRunning() {
  if (process.platform !== 'win32') return false;
  try { return /CapCut\.exe/i.test(execSync('tasklist /FI "IMAGENAME eq CapCut.exe" /NH', { encoding: 'utf8' })); }
  catch { return false; }
}

export class CapCutDraft {
  constructor(name) {
    this.name = name;
    this.dir = path.join(DRAFTS_DIR, name);
    if (!fs.existsSync(path.join(this.dir, 'draft_content.json'))) throw new Error(`draft not found: ${name} (in ${DRAFTS_DIR})`);
    this.content = JSON.parse(fs.readFileSync(path.join(this.dir, 'draft_content.json'), 'utf8'));
    this.metaPath = path.join(this.dir, 'draft_meta_info.json');
    this.meta = fs.existsSync(this.metaPath) ? JSON.parse(fs.readFileSync(this.metaPath, 'utf8')) : null;
    this._tpl = null;
  }
  templates() {
    if (this._tpl) return this._tpl;
    let t = harvest(this.content);
    // fill any missing segment type from the template draft
    if (!t.video || !t.text || !t.audio) {
      try { const base = JSON.parse(fs.readFileSync(path.join(DRAFTS_DIR, TEMPLATE_DRAFT, 'draft_content.json'), 'utf8')); const bt = harvest(base);
        for (const k of ['video', 'audio', 'text', 'image']) if (!t[k] && bt[k]) t[k] = bt[k];
        for (const k of Object.keys(bt.tracks)) if (!t.tracks[k]) t.tracks[k] = bt.tracks[k];
      } catch {}
    }
    this._tpl = t; return t;
  }
  _mats(key) { this.content.materials[key] = this.content.materials[key] || []; return this.content.materials[key]; }
  _nextRender() { let m = -1; for (const tr of this.content.tracks) for (const s of (tr.segments || [])) if ((s.render_index || 0) > m) m = s.render_index; return m + 1; }

  // ---------- read ----------
  timeline({ detail = false } = {}) {
    const c = this.content;
    return {
      name: this.name, durationSec: +(c.duration / US).toFixed(3), fps: c.fps,
      canvas: c.canvas_config && { w: c.canvas_config.width, h: c.canvas_config.height, ratio: c.canvas_config.ratio },
      locked: fs.existsSync(path.join(this.dir, '.locked')), capcutRunning: capcutRunning(),
      tracks: (c.tracks || []).map((tr, ti) => ({
        index: ti, type: tr.type, name: tr.name, segments: (tr.segments || []).map(s => {
          const [mk, m] = findMat(c, s.material_id);
          const out = {
            id: s.id, material: m ? (m.material_name || (m.path || '').split(/[\\/]/).pop() || m.type) : null,
            atSec: +(s.target_timerange.start / US).toFixed(3), durSec: +(s.target_timerange.duration / US).toFixed(3),
            srcStartSec: +((s.source_timerange?.start || 0) / US).toFixed(3), renderIndex: s.render_index, trackRenderIndex: s.track_render_index,
          };
          if (detail) Object.assign(out, this._segDetail(s, mk, m));
          return out;
        }),
      })),
    };
  }
  // extra per-segment info for timeline({detail:true}): transform, crop, linked effects, text
  _segDetail(s, mk, m) {
    const c = this.content, d = { materialKind: mk, materialType: m ? m.type : null };
    if (m && m.name && !m.material_name) d.materialName = m.name;          // stickers, effects ...
    if (s.clip) d.clip = { scaleX: s.clip.scale?.x, scaleY: s.clip.scale?.y, posX: s.clip.transform?.x, posY: s.clip.transform?.y,
      rotation: s.clip.rotation, opacity: s.clip.alpha, flipH: !!s.clip.flip?.horizontal, flipV: !!s.clip.flip?.vertical };
    if (s.visible === false) d.visible = false;
    if (s.speed != null && s.speed !== 1) d.speed = s.speed;
    if (mk === 'videos') {
      d.sourceSize = { w: m.width, h: m.height };
      const cr = m.crop;
      if (cr) { const crop = { left: cr.upper_left_x, top: cr.upper_left_y, right: cr.lower_right_x, bottom: cr.lower_right_y };
        d.crop = (crop.left === 0 && crop.top === 0 && crop.right === 1 && crop.bottom === 1) ? 'none' : crop; }
      const shared = c.tracks.some(t => (t.segments || []).some(x => x !== s && x.material_id === m.id));
      if (shared) d.materialSharedWithOtherSegments = true;
    }
    if (mk === 'texts') {
      try { const j = JSON.parse(m.content); d.text = j.text; const st = (j.styles || [])[0];
        if (st) d.textStyle = { size: st.size, color: st.fill?.content?.solid?.color, font: st.font?.path ? st.font.path.split(/[\\/]/).pop() : undefined,
          stroke: (st.strokes && st.strokes.length) ? st.strokes : undefined, shadow: (st.shadows && st.shadows.length) ? st.shadows : undefined }; }
      catch { d.text = m.content; }
    }
    // linked extra materials, minus the per-clip boilerplate CapCut attaches to every clip
    const BORING = new Set(['speeds', 'placeholder_infos', 'canvases', 'sound_channel_mappings', 'material_colors', 'vocal_separations', 'beats']);
    d.extras = (s.extra_material_refs || []).map(id => { const [k, x] = findMat(c, id); return { k, x, id }; })
      .filter(({ k, x }) => x && !BORING.has(k) && !(k === 'material_animations' && !(x.animations || []).length))
      .map(({ k, x, id }) => {
        const e = { kind: k, type: x.type, name: x.name || x.material_name || '', id };
        if (k === 'transitions') e.durSec = +((x.duration || 0) / US).toFixed(3);
        if (k === 'common_mask' && x.config) e.config = x.config;
        if (k === 'material_animations') e.animations = x.animations.map(a => ({ type: a.type, name: a.name, durSec: +((a.duration || 0) / US).toFixed(3) }));
        return e;
      });
    return d;
  }

  // ---------- tracks ----------
  addTrack(type = 'video', name) {
    const tpl = this.templates().tracks[type] || this.templates().tracks.video;
    if (!tpl) throw new Error(`no track template for type ${type}`);
    const tk = clone(tpl); tk.id = uid(); tk.segments = []; tk.name = name || `${type} track`; tk.is_default_name = false;
    this.content.tracks.push(tk);
    return this.content.tracks.length - 1;
  }
  _resolveTrack(opts, type) {
    if (opts.trackIndex != null) { const tr = this.content.tracks[opts.trackIndex]; if (!tr) throw new Error(`no track at index ${opts.trackIndex}`); return tr; }
    if (opts.trackId) { const tr = this.content.tracks.find(t => t.id === opts.trackId); if (!tr) throw new Error(`no track ${opts.trackId}`); return tr; }
    let tr = this.content.tracks.find(t => t.type === type); if (tr) return tr;
    return this.content.tracks[this.addTrack(type)];
  }

  // ---------- add media (video/image/audio) ----------
  _addMedia(kind, file, opts) {
    if (!fs.existsSync(file)) throw new Error(`file not found: ${file}`);
    const type = kind === 'audio' ? 'audio' : (kind === 'image' ? 'photo' : 'video');
    const tplType = kind === 'image' ? (this.templates().image ? 'image' : 'video') : kind;
    const tpl = this.templates()[tplType] || this.templates().video;
    if (!tpl) throw new Error(`no ${kind} template available`);
    const dur = opts.durUs != null ? opts.durUs : probeDur(file);
    const mat = clone(tpl.mat); mat.id = uid(); mat.path = file.replace(/\\/g, '/'); mat.material_name = path.basename(file); mat.type = type;
    if (kind !== 'audio') { const { w, h } = probeWH(file); mat.width = w; mat.height = h; }
    mat.duration = kind === 'image' ? 10800000000 : probeDur(file); // fix: real duration for video/audio; stills get CapCut's 3 h photo duration (template duration was reused for both)
    ['local_material_id', 'origin_material_id', 'local_id', 'request_id', 'aigc_history_id', 'aigc_item_id'].forEach(k => { if (k in mat) mat[k] = ''; });
    const matKey = kind === 'audio' ? 'audios' : (kind === 'image' ? 'videos' : 'videos'); // CapCut stores images in videos[]
    this._mats(matKey).push(mat);
    const refs = tpl.refs.map(({ k, m }) => { const c = clone(m); c.id = uid(); this._mats(k).push(c); return c.id; });
    const seg = clone(tpl.seg); seg.id = uid(); seg.material_id = mat.id; seg.extra_material_refs = refs;
    const at = opts.atUs || 0;
    seg.target_timerange = { start: at, duration: dur };
    seg.source_timerange = { start: opts.srcStartUs || 0, duration: dur };
    this._applyProps(seg, opts);
    seg.render_index = this._nextRender();
    const track = this._resolveTrack(opts, kind === 'audio' ? 'audio' : 'video');
    seg.track_render_index = opts.trackRenderIndex != null ? opts.trackRenderIndex : (this.content.tracks.indexOf(track));
    track.segments.push(seg);
    this.content.duration = Math.max(this.content.duration || 0, at + dur);
    return { segmentId: seg.id, endUs: at + dur };
  }
  addVideo(file, opts = {}) { return this._addMedia('video', file, opts); }
  addImage(file, opts = {}) { return this._addMedia('image', file, opts); }
  addAudio(file, opts = {}) { return this._addMedia('audio', file, opts); }

  // ---------- text ----------
  addText(text, opts = {}) {
    const tpl = this.templates().text;
    if (!tpl) throw new Error('no text template found. Set CAPCUT_TEMPLATE_DRAFT to a draft that contains a text layer.');
    const mat = clone(tpl.mat); mat.id = uid();
    try {
      const content = JSON.parse(mat.content);
      content.text = text;
      if (content.styles && content.styles[0]) {
        content.styles[0].range = [0, text.length];
        if (opts.color) content.styles[0].fill = { content: { solid: { color: hexToRgb(opts.color) } } };
        if (opts.fontSize) content.styles[0].size = opts.fontSize;
      }
      mat.content = JSON.stringify(content);
    } catch { mat.content = JSON.stringify({ text, styles: [{ range: [0, text.length], size: opts.fontSize || 15, fill: { content: { solid: { color: hexToRgb(opts.color || '#ffffff') } } } }] }); }
    this._mats('texts').push(mat);
    const refs = tpl.refs.map(({ k, m }) => { const c = clone(m); c.id = uid(); this._mats(k).push(c); return c.id; });
    const seg = clone(tpl.seg); seg.id = uid(); seg.material_id = mat.id; seg.extra_material_refs = refs;
    const at = opts.atUs || 0, dur = opts.durUs || 3 * US;
    seg.target_timerange = { start: at, duration: dur };
    seg.source_timerange = { start: 0, duration: dur };
    this._applyProps(seg, opts);
    seg.render_index = this._nextRender();
    const track = this._resolveTrack(opts, 'text');
    seg.track_render_index = opts.trackRenderIndex != null ? opts.trackRenderIndex : this.content.tracks.indexOf(track);
    track.segments.push(seg);
    this.content.duration = Math.max(this.content.duration || 0, at + dur);
    return { segmentId: seg.id, endUs: at + dur };
  }

  // ---------- edit existing segments ----------
  _find(segId) { for (const tr of this.content.tracks) { const s = (tr.segments || []).find(x => x.id === segId); if (s) return { tr, s }; } throw new Error(`segment not found: ${segId}`); }
  moveSegment(segId, atUs, newTrackIndex) {
    const { tr, s } = this._find(segId); const dur = s.target_timerange.duration;
    s.target_timerange.start = atUs;
    if (newTrackIndex != null && this.content.tracks[newTrackIndex]) { tr.segments = tr.segments.filter(x => x.id !== segId); this.content.tracks[newTrackIndex].segments.push(s); }
    this._recalcDuration(); return { segmentId: segId, atSec: atUs / US, durSec: dur / US };
  }
  trimSegment(segId, { atUs, durUs, srcStartUs } = {}) {
    const { s } = this._find(segId);
    if (atUs != null) s.target_timerange.start = atUs;
    if (durUs != null) { s.target_timerange.duration = durUs; s.source_timerange.duration = durUs; }
    if (srcStartUs != null) s.source_timerange.start = srcStartUs;
    this._recalcDuration(); return { segmentId: segId };
  }
  splitSegment(segId, atUs) {
    const { tr, s } = this._find(segId);
    const t0 = s.target_timerange.start, d = s.target_timerange.duration;
    if (atUs <= t0 || atUs >= t0 + d) throw new Error('split point must be inside the segment');
    const left = atUs - t0;
    const right = clone(s); right.id = uid();
    // clone extra_material_refs so the two halves don't share state
    right.extra_material_refs = (s.extra_material_refs || []).map(id => { const [k, m] = findMat(this.content, id); if (!m) return id; const c = clone(m); c.id = uid(); this._mats(k).push(c); return c.id; });
    s.target_timerange.duration = left; s.source_timerange.duration = left;
    right.target_timerange = { start: atUs, duration: d - left };
    right.source_timerange = { start: (s.source_timerange.start || 0) + left, duration: d - left };
    right.render_index = this._nextRender();
    tr.segments.push(right);
    return { left: segId, right: right.id };
  }
  deleteSegment(segId) { const { tr } = this._find(segId); tr.segments = tr.segments.filter(x => x.id !== segId); this._recalcDuration(); return { deleted: segId }; }
  setProps(segId, props = {}) { const { s } = this._find(segId); this._applyProps(s, props); return { segmentId: segId, applied: Object.keys(props) }; }
  _applyProps(seg, p) {
    seg.clip = seg.clip || { alpha: 1, flip: { horizontal: false, vertical: false }, rotation: 0, scale: { x: 1, y: 1 }, transform: { x: 0, y: 0 } };
    if (p.scale != null) { seg.clip.scale = { x: p.scale, y: p.scale }; }
    if (p.scaleX != null) seg.clip.scale.x = p.scaleX;
    if (p.scaleY != null) seg.clip.scale.y = p.scaleY;
    if (p.posX != null) seg.clip.transform.x = p.posX;
    if (p.posY != null) seg.clip.transform.y = p.posY;
    if (p.rotation != null) seg.clip.rotation = p.rotation;
    if (p.opacity != null) seg.clip.alpha = p.opacity;
    if (p.volume != null) seg.volume = p.volume;
    if (p.visible != null) seg.visible = p.visible;
    if (p.speed != null) { seg.speed = p.speed; const spId = (seg.extra_material_refs || []).find(id => findMat(this.content, id)[0] === 'speeds'); if (spId) { const [, sp] = findMat(this.content, spId); if (sp) sp.speed = p.speed; } }
  }
  _recalcDuration() { let max = 0; for (const tr of this.content.tracks) for (const s of (tr.segments || [])) max = Math.max(max, s.target_timerange.start + s.target_timerange.duration); this.content.duration = max; }

  // ---------- crop / picture-in-picture ----------
  // give this segment its own copy of its material when another segment shares it (CapCut shares one material across split halves)
  _ownMaterial(seg) {
    const [k, m] = findMat(this.content, seg.material_id);
    if (!m) throw new Error(`material not found for segment ${seg.id}`);
    const shared = this.content.tracks.some(t => (t.segments || []).some(x => x !== seg && x.material_id === m.id));
    if (!shared) return m;
    const c = clone(m); c.id = uid(); this._mats(k).push(c); seg.material_id = c.id;
    return c;
  }
  setCrop(segId, { left = 0, top = 0, right = 1, bottom = 1 } = {}) {
    const { s } = this._find(segId);
    for (const [n, v] of Object.entries({ left, top, right, bottom })) if (!(typeof v === 'number' && v >= 0 && v <= 1)) throw new Error(`${n} must be a number between 0 and 1`);
    if (!(right - left > 0.001 && bottom - top > 0.001)) throw new Error('need left < right and top < bottom (they are edges of the area you KEEP, measured from the top-left corner of the source frame)');
    const [k] = findMat(this.content, s.material_id);
    if (k !== 'videos') throw new Error('crop works only on video/photo segments');
    const m = this._ownMaterial(s);
    m.crop = { upper_left_x: left, upper_left_y: top, upper_right_x: right, upper_right_y: top, lower_left_x: left, lower_left_y: bottom, lower_right_x: right, lower_right_y: bottom };
    if ('crop_ratio' in m) m.crop_ratio = 'free';
    if ('crop_scale' in m) m.crop_scale = 1;
    const cw = (m.width || 1920) * (right - left), ch = (m.height || 1080) * (bottom - top);
    const W = this.content.canvas_config?.width || 1920, H = this.content.canvas_config?.height || 1080;
    const fit = cw / ch > W / H ? { w: W, h: W * ch / cw } : { w: H * cw / ch, h: H };
    return { segmentId: segId, materialId: m.id, crop: { left, top, right, bottom }, croppedSourcePx: { w: Math.round(cw), h: Math.round(ch) },
      approxSizeOnCanvasAtScale1: { w: Math.round(fit.w), h: Math.round(fit.h), note: 'assumes CapCut fits the cropped area into the canvas; multiply by scale' } };
  }
  // copy a video-track segment (+ its own material + linked extra materials, all with new ids) onto a new top video track
  duplicateSegment(segId, trackIndex) {
    const { tr, s } = this._find(segId);
    if (tr.type !== 'video') throw new Error('duplicate_segment works only on segments of a video track (video or photo clips)');
    const [k, m] = findMat(this.content, s.material_id);
    if (!m) throw new Error(`material not found for segment ${segId}`);
    const a = s.target_timerange.start, b = a + s.target_timerange.duration;
    let track;
    if (trackIndex != null) {
      track = this.content.tracks[trackIndex];
      if (!track) throw new Error(`no track at index ${trackIndex}`);
      if (track.type !== 'video') throw new Error(`track ${trackIndex} is a ${track.type} track; pick a video track or omit trackIndex`);
      const clash = (track.segments || []).find(x => x.target_timerange.start < b && a < x.target_timerange.start + x.target_timerange.duration);
      if (clash) throw new Error(`track ${trackIndex} already has segment ${clash.id} in that time range; omit trackIndex to get a new track`);
    } else {
      const hadVideo = this.content.tracks.some(t => t.type === 'video');
      track = this.content.tracks[this.addTrack('video', 'pip')];
      if (hadVideo) track.flag = 2;                                       // CapCut marks overlay (non-main) video tracks with flag 2
    }
    const ti = this.content.tracks.indexOf(track);
    const mat = clone(m); mat.id = uid(); this._mats(k).push(mat);
    const seg = clone(s); seg.id = uid(); seg.material_id = mat.id;
    // copy linked materials with new ids; drop transitions (a lone copy on its own track has no next clip)
    seg.extra_material_refs = (s.extra_material_refs || []).map(id => {
      const [kk, mm] = findMat(this.content, id); if (!mm) return id;
      if (kk === 'transitions') return null;
      const c = clone(mm); c.id = uid(); if (kk === 'video_effects' && 'track_render_index' in c) c.track_render_index = ti;
      this._mats(kk).push(c); return c.id;
    }).filter(Boolean);
    // layer order: above every video segment, but below text/sticker/effect layers (render_index >= 10000)
    let ri = 0;
    for (const t of this.content.tracks) if (t.type === 'video') for (const x of (t.segments || [])) ri = Math.max(ri, (x.render_index || 0) + 1);
    const overlapsAt = r => this.content.tracks.some(t => (t.segments || []).some(x => x.render_index === r && x.target_timerange.start < b && a < x.target_timerange.start + x.target_timerange.duration));
    while (overlapsAt(ri)) ri++;
    seg.render_index = ri; seg.track_render_index = ti;
    track.segments.push(seg);
    this._recalcDuration();
    return { segmentId: seg.id, trackIndex: ti, materialId: mat.id, atSec: a / US, durSec: (b - a) / US, renderIndex: ri };
  }

  // escape hatch: apply a JSON-merge-style patch to content (advanced/undocumented ops)
  rawPatch(patch) { deepMerge(this.content, patch); return { ok: true }; }

  // ---------- validate ----------
  validate() {
    const c = this.content; const issues = [], warnings = [];
    const ids = new Set(); let dupMat = 0;
    for (const k of Object.keys(c.materials || {})) if (Array.isArray(c.materials[k])) for (const m of c.materials[k]) { if (ids.has(m.id)) dupMat++; ids.add(m.id); }
    if (dupMat) issues.push(`${dupMat} duplicate material id(s)`);
    let overlaps = 0;
    const ris = new Map();                                   // render_index -> [ {start,end} ] across all tracks
    for (const tr of c.tracks) {
      const ss = [...(tr.segments || [])].sort((a, b) => a.target_timerange.start - b.target_timerange.start);
      for (const s of ss) { const e = { a: s.target_timerange.start, b: s.target_timerange.start + s.target_timerange.duration }; (ris.get(s.render_index) || ris.set(s.render_index, []).get(s.render_index)).push(e); }
      for (let i = 1; i < ss.length; i++) if (ss[i].target_timerange.start < ss[i - 1].target_timerange.start + ss[i - 1].target_timerange.duration) overlaps++;
    }
    // a duplicate render_index only matters if those two segments actually overlap in time
    let riClash = 0;
    for (const arr of ris.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (arr[i].a < arr[j].b && arr[j].a < arr[i].b) riClash++;
    if (overlaps) issues.push(`${overlaps} overlapping segment(s) on a single track`);
    if (riClash) issues.push(`${riClash} overlapping segment pair(s) share a render_index (ambiguous layer order)`);
    else if (ris.size < [...ris.values()].reduce((n, a) => n + a.length, 0)) warnings.push('some non-overlapping segments share a render_index (harmless; CapCut does this for sequential clips)');
    for (const s of (c.materials?.videos || [])) if (s.path && !fs.existsSync(s.path)) issues.push(`missing media file: ${s.path}`);
    return { ok: issues.length === 0, issues, warnings };
  }

  // ---------- save ----------
  save({ force = false } = {}) {
    if (!force) {
      if (fs.existsSync(path.join(this.dir, '.locked'))) throw new Error('draft is locked (open in CapCut). Close CapCut, or pass force:true. Autosave will overwrite edits made while open.');
      if (capcutRunning()) throw new Error('CapCut is running. Close it before saving, or pass force:true.');
    }
    const v = this.validate();
    const cPath = path.join(this.dir, 'draft_content.json');
    try { fs.copyFileSync(cPath, cPath + '.mcpbak'); } catch {}
    const tmp = cPath + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.content)); fs.renameSync(tmp, cPath);
    if (this.meta) { try { fs.copyFileSync(this.metaPath, this.metaPath + '.mcpbak'); } catch {} const mt = this.metaPath + '.tmp'; fs.writeFileSync(mt, JSON.stringify(this.meta)); fs.renameSync(mt, this.metaPath); }
    return { saved: this.name, durationSec: +(this.content.duration / US).toFixed(3), validation: v };
  }
}

// clone a whole draft folder to a new name (valid scaffolding), optionally emptied
export function cloneDraft(base, newName, { empty = false } = {}) {
  const src = path.join(DRAFTS_DIR, base), dst = path.join(DRAFTS_DIR, newName);
  if (!fs.existsSync(path.join(src, 'draft_content.json'))) throw new Error(`base draft not found: ${base}`);
  if (fs.existsSync(dst)) throw new Error(`draft already exists: ${newName}`);
  fs.mkdirSync(dst, { recursive: true });
  for (const fn of fs.readdirSync(src)) { if (fn === '.locked') continue; /* fix: never copy CapCut's open-lock into the clone */ const s = path.join(src, fn); try { if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(dst, fn)); } catch {} }
  if (empty) {
    const d = new CapCutDraft(newName);
    for (const k of Object.keys(d.content.materials)) if (Array.isArray(d.content.materials[k])) d.content.materials[k] = [];
    for (const tr of d.content.tracks) tr.segments = [];
    d.content.duration = 0; d.content.id = uid(); d.content.name = newName;
    fs.writeFileSync(path.join(dst, 'draft_content.json'), JSON.stringify(d.content));
  }
  return { created: newName, dir: dst };
}

function hexToRgb(hex) { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }
function deepMerge(t, s) { for (const k of Object.keys(s)) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object') deepMerge(t[k], s[k]); else t[k] = s[k]; } return t; }

export const _us = US;
