// ek-yazi.js: text styling (stroke / shadow / background), overflow warning, approximate frame preview.
// Loaded by server.js via register(s, { get, wrap, z, sec, US }). Self-contained helpers (no core.js internals needed).
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import path from 'path';
import { execFileSync } from 'child_process';

const US = 1e6;
// Calibration (a 1080x1920 draft): a 26-char bold UPPERCASE title at font size 14, scale 1 overflowed;
// scale 0.754 fixed it (~84% width). => one bold UPPERCASE char ~ 3.3 px per font-size unit at scale 1 on a 1080-wide canvas
// (mixed-case ~2.8). One font-size unit ~ 4.6 px of em height (used by the preview).
const PX_EM = 4.6, PX_UP = 3.3, PX_MIX = 2.8;
// font used by capcut_preview_frame (any bold TTF works; override with CAPCUT_PREVIEW_FONT)
const PREVIEW_FONT = process.env.CAPCUT_PREVIEW_FONT || (process.platform === 'win32' ? 'C:/Windows/Fonts/arialbd.ttf'
  : process.platform === 'darwin' ? '/System/Library/Fonts/Supplemental/Arial Bold.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');

// CapCut international text animations: name -> [title, resource_id, effect_id]. Source: VectCutAPI pyJianYingDraft/metadata/capcut_text_animation_meta.py
// (CapCut_Text_intro / _outro / _loop_anim). CapCut fetches the resource by resource_id on open (internet needed). Default duration 0.5 s.
const ANIMS = {
  in: {
    'typewriter': ['Typewriter', '7210980292243231233', '7210980292243231233'],
    'fade in': ['Fade In', '6724916044072227332', '6724916044072227332'],
    'glitch': ['Glitch', '7077812383946641921', '7077812383946641921'],
    'pop up': ['Pop Up', '7145435451946439170', '7145435451946439170'],
    'blur': ['Blur', '6923135604519604737', '6923135604519604737'],
    'zoom in': ['Zoom In', '6724919499042066958', '6724919499042066958'],
    'bounce in': ['Bounce In', '6887766069587481090', '6887766069587481090'],
    'slide up': ['Slide Up', '6763470111253729803', '6763470111253729803'],
  },
  out: {
    'fade out': ['Fade Out', '6724919382104871427', '6724919382104871427'],
    'blur': ['Blur', '6923134492760609282', '6923134492760609282'],
    'zoom in': ['Zoom In', '6724919767200698884', '6724919767200698884'],
    'typewriter': ['Typewriter', '7210980400984756738', '7210980400984756738'],
    'slide down': ['Slide Down', '7403256664498901520', '7403256664498901520'],
    'dissolve': ['Dissolve', '6873386286082691586', '6873386286082691586'],
  },
  loop: {
    'wave': ['Wave', '6724927688047333891', '6724927688047333891'],
    'flash': ['Flash', '6724921437930394120', '6724921437930394120'],
    'pulse': ['Pulse', '6724919955654971918', '6724919955654971918'],
    'tremble': ['Tremble', '6790246693674684942', '6790246693674684942'],
    'jump': ['Jump', '6724920002958332420', '6724920002958332420'],
    'shake': ['Shake', '7161320851327947265', '7161320851327947265'],
    'swing': ['Swing', '6724921579517514248', '6724921579517514248'],
  },

};
// check_flag bits (pyJianYingDraft text_segment.py export_material): base 7, border |8, background |16, shadow |32.
const FLAG_BORDER = 8, FLAG_BG = 16, FLAG_SHADOW = 32;
const setBit = (m, bit, on) => { m.check_flag = on ? ((m.check_flag ?? 7) | bit) : ((m.check_flag ?? 7) & ~bit); };

const hexRgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const findMat = (c, id) => { for (const k of Object.keys(c.materials || {})) if (Array.isArray(c.materials[k])) { const m = c.materials[k].find(x => x && x.id === id); if (m) return m; } return null; };
const charW = (line) => (line === line.toUpperCase() ? PX_UP : PX_MIX);
function fit(text, size, scale, canvasW) {
  const k = canvasW / 1080;
  const lines = String(text).split(/\r?\n/);
  const widths = lines.map(l => l.length * charW(l) * size * scale * k);
  const longest = Math.max(...widths, 0), li = widths.indexOf(longest);
  const maxChars = Math.floor(0.9 * canvasW / (charW(lines[li] || 'A') * size * scale * k));
  return { longestLine: lines[li], estWidthPx: Math.round(longest), canvasW, pctOfWidth: Math.round(100 * longest / canvasW), maxCharsPerLineAtThisSize: maxChars, overflow: longest > 0.9 * canvasW };
}

export function register(s, ctx) {
  const { get, wrap, z } = ctx;

  s.tool('capcut_style_text',
    'Style an existing text segment: outline (border), drop shadow, background box, size, colour. Writes both the material fields and the per-style data in the text content JSON so CapCut renders it. ' +
    'Colours are hex like #000000. borderWidth ~0.04 thin, 0.08 default, 0.15 thick. shadowDistance ~5. ' +
    'SIZE RULE (1080-wide canvas, scale 1, bold caps): one character is about 3.3 x fontSize px wide (mixed case ~2.8 x). The usable width is ~970 px, so max chars per line ~ 290 / (fontSize x scale) for CAPS (e.g. fontSize 14 -> ~20 chars, fontSize 12 -> ~24, fontSize 10 -> ~29). ' +
    'CapCut does NOT wrap automatically here: insert "\\n" yourself or lower fontSize/scale. The result contains fitWarning when the longest line likely exceeds 90% of the canvas width.',
    { draft: z.string(), segmentId: z.string(),
      borderColor: z.string().optional(), borderWidth: z.number().optional(),
      shadow: z.boolean().optional(), shadowColor: z.string().optional(), shadowDistance: z.number().optional(),
      backgroundColor: z.string().optional(), backgroundAlpha: z.number().optional(), backgroundStyle: z.number().optional().describe('1 or 2; CapCut saves 2 when the box is toggled on (default 2)'),
      fontSize: z.number().optional(), color: z.string().optional() },
    wrap(async (a) => {
      const d = get(a.draft), c = d.content;
      let seg = null;
      for (const t of c.tracks) { const f = (t.segments || []).find(x => x.id === a.segmentId); if (f) seg = f; }
      if (!seg) throw new Error('segment not found: ' + a.segmentId);
      const m = findMat(c, seg.material_id);
      if (!m || m.type !== 'text') throw new Error('segment is not a text segment');
      const cj = JSON.parse(m.content);
      const styles = cj.styles || (cj.styles = []);
      const applied = [];
      if (a.fontSize != null) { m.font_size = a.fontSize; styles.forEach(st => st.size = a.fontSize); applied.push('fontSize'); }
      if (a.color) { m.text_color = a.color; styles.forEach(st => st.fill = { alpha: 1, content: { render_type: 'solid', solid: { alpha: 1, color: hexRgb(a.color) } } }); m.use_effect_default_color = false; applied.push('color'); }
      if (a.borderColor || a.borderWidth != null) {
        const col = a.borderColor || m.border_color || '#000000', w = a.borderWidth != null ? a.borderWidth : (m.border_width || 0.08);
        m.border_color = col; m.border_width = w; m.border_alpha = 1; m.border_mode = 0; setBit(m, FLAG_BORDER, w > 0);
        styles.forEach(st => { st.strokes = [{ content: { render_type: 'solid', solid: { alpha: 1, color: hexRgb(col) } }, width: w, alpha: 1 }]; });
        applied.push('border');
      }
      if (a.shadow != null || a.shadowColor || a.shadowDistance != null) {
        const on = a.shadow !== false, col = a.shadowColor || '#000000', dist = a.shadowDistance != null ? a.shadowDistance : 5;
        m.has_shadow = on; m.shadow_color = col; m.shadow_alpha = 0.9; m.shadow_distance = dist; m.shadow_smoothing = 0.45; m.shadow_angle = -45;
        m.shadow_point = { x: 0.6363961030678928, y: -0.6363961030678928 }; setBit(m, FLAG_SHADOW, on);
        styles.forEach(st => { if (on) st.shadows = [{ content: { render_type: 'solid', solid: { alpha: 1, color: hexRgb(col) } }, alpha: 0.9, angle: -45, diffuse: 0.15, distance: dist }]; else delete st.shadows; });
        applied.push('shadow');
      }
      if (a.backgroundColor || a.backgroundAlpha != null) {
        const col = a.backgroundColor || m.background_color || '#000000', al = a.backgroundAlpha != null ? a.backgroundAlpha : 1;
        m.background_color = col; m.background_alpha = al; m.background_style = a.backgroundStyle || 2; setBit(m, FLAG_BG, true); m.background_round_radius = m.background_round_radius || 0.2;
        styles.forEach(st => { st.background = { alpha: al, color: col, round_radius: m.background_round_radius, style: m.background_style, width: m.background_width ?? 0.14, height: m.background_height ?? 0.14, horizontal_offset: 0, vertical_offset: 0 }; });
        applied.push('background');
      }
      m.content = JSON.stringify(cj);
      const size = styles[0] && styles[0].size || m.font_size || 15, scale = seg.clip?.scale?.x ?? 1;
      const f = fit(cj.text, size, scale, c.canvas_config?.width || 1080);
      const out = { segmentId: a.segmentId, applied, text: cj.text, fontSize: size, scale, fit: f };
      if (f.overflow) out.fitWarning = `Longest line "${f.longestLine}" is ~${f.pctOfWidth}% of canvas width (limit 90%). Break the line with \\n, lower fontSize, or set scale <= ${(0.9 / (f.pctOfWidth / 100) * scale).toFixed(2)} via capcut_set_props.`;
      return out;
    }));

  s.tool('capcut_text_animation',
    'Add an in / out / loop animation to a text segment (CapCut international built-in animations; CapCut downloads the resource on open, so internet is needed). kind = in|out|loop. ' +
    'Names - in: ' + Object.keys(ANIMS.in).join(', ') + '; out: ' + Object.keys(ANIMS.out).join(', ') + '; loop: ' + Object.keys(ANIMS.loop).join(', ') + '. ' +
    'durSec default 0.5 (in/out); loop fills the time between in and out (add in/out first). Replaces an existing animation of the same kind. name "none" removes that kind.',
    { draft: z.string(), segmentId: z.string(), kind: z.enum(['in', 'out', 'loop']), name: z.string(), durSec: z.number().optional() },
    wrap(async (a) => {
      const d = get(a.draft), c = d.content;
      let seg = null;
      for (const t of c.tracks) { const f = (t.segments || []).find(x => x.id === a.segmentId); if (f) seg = f; }
      if (!seg) throw new Error('segment not found: ' + a.segmentId);
      const m = findMat(c, seg.material_id);
      if (!m || m.type !== 'text') throw new Error('segment is not a text segment');
      const arr = c.materials.material_animations || (c.materials.material_animations = []);
      let ma = (seg.extra_material_refs || []).map(id => arr.find(x => x.id === id)).find(Boolean);
      if (!ma) { ma = { id: crypto.randomUUID().toUpperCase(), type: 'sticker_animation', animations: [], multi_language_current: 'none' }; arr.push(ma); (seg.extra_material_refs = seg.extra_material_refs || []).push(ma.id); }
      ma.animations = (ma.animations || []).filter(x => x.type !== a.kind);
      const total = seg.target_timerange.duration;
      if (String(a.name).toLowerCase() !== 'none') {
        const key = String(a.name).toLowerCase().replace(/_/g, ' ').trim();
        const hit = ANIMS[a.kind][key] || Object.entries(ANIMS[a.kind]).find(([k]) => k.includes(key))?.[1];
        if (!hit) throw new Error('unknown ' + a.kind + ' animation "' + a.name + '". Available: ' + Object.keys(ANIMS[a.kind]).join(', '));
        const [title, rid, eid] = hit;
        const inA = ma.animations.find(x => x.type === 'in'), outA = ma.animations.find(x => x.type === 'out');
        let dur = Math.min(Math.round((a.durSec ?? 0.5) * US), total), start = 0;
        if (a.kind === 'out') start = total - dur;
        if (a.kind === 'loop') { start = inA ? inA.start + inA.duration : 0; dur = total - start - (outA ? outA.duration : 0); if (dur <= 0) throw new Error('no room for loop animation'); }
        ma.animations.push({ anim_adjust_params: null, platform: 'all', panel: '', material_type: 'sticker', name: title, id: eid, type: a.kind, resource_id: rid, start, duration: dur, category_id: '', category_name: '', path: '', request_id: '' });
      }
      return { segmentId: a.segmentId, animations: ma.animations.map(x => ({ kind: x.type, name: x.name, startSec: x.start / US, durSec: x.duration / US })) };
    }));

  s.tool('capcut_preview_frame',
    'Render an APPROXIMATE PNG of the timeline at time atSec (ffmpeg): video/photo layers in render order with crop, scale and position, plus active texts drawn with a generic bold font (colour/outline/size approximate, no real fonts, no effects/animations). ' +
    'Use it to check framing and text overflow before opening CapCut. Returns the PNG path and the list of active segments.',
    { draft: z.string(), atSec: z.number(), out: z.string().optional().describe('output PNG path (default: temp folder)') },
    wrap(async ({ draft, atSec, out }) => {
      const c = get(draft).content, t = Math.round(atSec * US);
      const W = c.canvas_config?.width || 1080, H = c.canvas_config?.height || 1920;
      const active = [];
      for (const tr of c.tracks) for (const sg of (tr.segments || [])) {
        const tt = sg.target_timerange; if (t < tt.start || t >= tt.start + tt.duration || sg.visible === false) continue;
        const m = findMat(c, sg.material_id); if (!m || (tr.type !== 'video' && tr.type !== 'text')) continue;
        active.push({ sg, m, kind: tr.type, ord: (sg.render_index || 0) * 1000 + (sg.track_render_index || 0) });
      }
      active.sort((p, q) => p.ord - q.ord);
      const inputs = ['-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:d=1`];
      const parts = []; let last = '0:v', n = 1, inN = 1; const tmps = []; const texts = [];
      const q = p => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
      for (const { sg, m, kind } of active) {
        if (kind === 'text' || m.type === 'text') {
          const cj = JSON.parse(m.content), st = cj.styles?.[0] || {}, sc = sg.clip?.scale?.x ?? 1, k = W / 1080;
          const fs_ = Math.max(8, Math.round((st.size || m.font_size || 15) * PX_EM * sc * k));
          const col = (st.fill?.content?.solid?.color || [1, 1, 1]).map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
          const f = path.join(os.tmpdir(), `capprev-${process.pid}-${n}.txt`); fs.writeFileSync(f, cj.text, 'utf8'); tmps.push(f);
          const cx = W / 2 + (sg.clip?.transform?.x || 0) * W / 2, cy = H / 2 - (sg.clip?.transform?.y || 0) * H / 2;
          const bw = st.strokes?.[0] ? Math.max(1, Math.round((st.strokes[0].width || 0.08) * fs_ * 0.5)) : 0;
          const bc = st.strokes?.[0] ? '0x' + (st.strokes[0].content.solid.color).map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('') : 'black';
          const sh = st.shadows?.[0] ? ':shadowx=4:shadowy=4:shadowcolor=black' : '';
          const box = m.background_style > 0 && (m.check_flag & 16) && m.background_color ? `:box=1:boxcolor=${m.background_color.replace('#', '0x')}@${m.background_alpha ?? 1}:boxborderw=${Math.round(fs_ * 0.3)}` : '';
          parts.push(`[${last}]drawtext=fontfile='${q(PREVIEW_FONT)}':textfile='${q(f)}':fontsize=${fs_}:fontcolor=0x${col}:borderw=${bw}:bordercolor=${bc}${sh}${box}:x=${Math.round(cx)}-text_w/2:y=${Math.round(cy)}-text_h/2:line_spacing=${Math.round(fs_ * 0.15)}[v${n}]`);
          texts.push(cj.text); last = `v${n}`; n++; continue;
        }
        if (!m.path || !fs.existsSync(m.path)) continue;
        const off = (t - sg.target_timerange.start) / US * (sg.speed || 1) + (sg.source_timerange?.start || 0) / US;
        if (m.type === 'photo') inputs.push('-loop', '1', '-i', m.path); else inputs.push('-ss', String(Math.max(0, off)), '-i', m.path);
        const cr = m.crop || {}, x0 = cr.upper_left_x ?? 0, y0 = cr.upper_left_y ?? 0, x1 = cr.upper_right_x ?? 1, y1 = cr.lower_left_y ?? 1;
        const cw = (m.width || W) * (x1 - x0), ch = (m.height || H) * (y1 - y0), base = Math.min(W / cw, H / ch);
        const w = Math.max(2, Math.round(cw * base * (sg.clip?.scale?.x ?? 1))), h = Math.max(2, Math.round(ch * base * (sg.clip?.scale?.y ?? 1)));
        const cx = W / 2 + (sg.clip?.transform?.x || 0) * W / 2, cy = H / 2 - (sg.clip?.transform?.y || 0) * H / 2;
        let f = `[${inN++}:v]crop=iw*${x1 - x0}:ih*${y1 - y0}:iw*${x0}:ih*${y0},scale=${w}:${h}`;
        if (sg.clip?.flip?.horizontal) f += ',hflip'; if (sg.clip?.flip?.vertical) f += ',vflip';
        if (sg.clip?.rotation) f += `,rotate=${(-sg.clip.rotation * Math.PI / 180).toFixed(5)}:c=none:ow=rotw(${(-sg.clip.rotation * Math.PI / 180).toFixed(5)}):oh=roth(${(-sg.clip.rotation * Math.PI / 180).toFixed(5)})`;
        if ((sg.clip?.alpha ?? 1) < 1) f += `,format=rgba,colorchannelmixer=aa=${sg.clip.alpha}`;
        parts.push(`${f}[l${n}]`, `[${last}][l${n}]overlay=x=${Math.round(cx)}-w/2:y=${Math.round(cy)}-h/2:eof_action=pass[v${n}]`);
        last = `v${n}`; n++;
      }
      const outP = out || path.join(os.tmpdir(), `capcut-preview-${draft}-${Math.round(atSec * 1000)}.png`);
      const args = ['-y', '-v', 'error', ...inputs, ...(parts.length ? ['-filter_complex', parts.join(';'), '-map', `[${last}]`] : []), '-frames:v', '1', outP];
      try { execFileSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }); }
      catch (e) { throw new Error('ffmpeg failed: ' + String(e.stderr || e.message).slice(-700)); }
      finally { tmps.forEach(f => { try { fs.unlinkSync(f); } catch {} }); }
      return { png: outP, note: 'APPROXIMATE preview: generic font, no effects/animations/masks', canvas: `${W}x${H}`, atSec,
        layers: active.filter(x => x.kind !== 'text' && x.m.type !== 'text').map(x => x.m.material_name || x.m.path), texts };
    }));
}
