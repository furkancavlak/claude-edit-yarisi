#!/usr/bin/env node
// capcut-mcp: MCP stdio server exposing CapCut draft-editing tools.
// Editing tools accumulate in an in-memory session (open -> edit -> edit -> save);
// nothing touches disk until capcut_save. All times are in SECONDS at the tool boundary.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CapCutDraft, cloneDraft, listDrafts, DRAFTS_DIR } from './core.js';

const US = 1e6;
const open = new Map();                       // name -> live CapCutDraft (unsaved edits)
const get = name => { if (!open.has(name)) open.set(name, new CapCutDraft(name)); return open.get(name); };
const ok = obj => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const err = e => ({ content: [{ type: 'text', text: 'ERROR: ' + (e && e.message || e) }], isError: true });
const wrap = fn => async (a) => { try { return ok(await fn(a)); } catch (e) { return err(e); } };
const sec = v => v == null ? undefined : Math.round(v * US);

// media-placement option shape shared by add_video/image/audio
const placeOpts = {
  atSec: z.number().describe('start time on the timeline, seconds'),
  durSec: z.number().optional().describe('duration (default: full media length)'),
  srcStartSec: z.number().optional().describe('in-point inside the source file, seconds'),
  trackIndex: z.number().int().optional().describe('target track (index in the tracks list); a new track is made if omitted'),
  trackRenderIndex: z.number().int().optional().describe('layer order; higher = on top'),
  scale: z.number().optional(), posX: z.number().optional(), posY: z.number().optional(),
  rotation: z.number().optional(), opacity: z.number().optional(), volume: z.number().optional(), speed: z.number().optional(),
};
const optsFrom = a => ({ atUs: sec(a.atSec), durUs: sec(a.durSec), srcStartUs: sec(a.srcStartSec),
  trackIndex: a.trackIndex, trackRenderIndex: a.trackRenderIndex, scale: a.scale, posX: a.posX, posY: a.posY,
  rotation: a.rotation, opacity: a.opacity, volume: a.volume, speed: a.speed });

const s = new McpServer({ name: 'capcut', version: '0.1.0' });

s.tool('capcut_list_drafts', `List CapCut drafts in ${DRAFTS_DIR} with duration and lock status.`, {}, wrap(async () => ({ draftsDir: DRAFTS_DIR, drafts: listDrafts() })));

s.tool('capcut_read_timeline', 'Read a draft: canvas, fps, tracks and every segment (id, media, times, layer). Read-only. ' +
  'Shows unsaved session edits if the draft is open in this session, otherwise the file on disk. ' +
  'detail:true also returns per segment: clip transform (scaleX/scaleY, posX/posY, rotation, opacity, flip), source size and crop (left/top/right/bottom fractions, or "none") for video/photo, ' +
  'linked extras such as transitions, video effects, filters, masks and animations (kind, type, name, id; per-clip boilerplate like speeds/canvases is hidden), and for texts the text and its first style.',
  { draft: z.string(), detail: z.boolean().optional().describe('include transform / crop / effects / text per segment') },
  wrap(async ({ draft, detail }) => (open.has(draft) ? open.get(draft) : new CapCutDraft(draft)).timeline({ detail: !!detail })));

s.tool('capcut_clone_draft', 'Copy a draft folder to a new name (valid scaffolding). empty:true clears all clips/tracks for a fresh build.',
  { base: z.string(), newName: z.string(), empty: z.boolean().optional() },
  wrap(async ({ base, newName, empty }) => cloneDraft(base, newName, { empty: !!empty })));

s.tool('capcut_add_video', 'Add a video clip at a time on a track. Session edit; call capcut_save to persist.',
  { draft: z.string(), file: z.string(), ...placeOpts },
  wrap(async (a) => get(a.draft).addVideo(a.file, optsFrom(a))));

s.tool('capcut_add_image', 'Add an image at a time on a track.',
  { draft: z.string(), file: z.string(), ...placeOpts },
  wrap(async (a) => get(a.draft).addImage(a.file, optsFrom(a))));

s.tool('capcut_add_audio', 'Add an audio clip at a time on a track.',
  { draft: z.string(), file: z.string(), ...placeOpts },
  wrap(async (a) => get(a.draft).addAudio(a.file, optsFrom(a))));

s.tool('capcut_add_text', 'Add a text overlay. Requires a text template (a draft with a text layer; see CAPCUT_TEMPLATE_DRAFT).',
  { draft: z.string(), text: z.string(), atSec: z.number(), durSec: z.number().optional(),
    fontSize: z.number().optional(), color: z.string().optional().describe('hex e.g. #ffffff'),
    posX: z.number().optional(), posY: z.number().optional(), trackIndex: z.number().int().optional() },
  wrap(async (a) => get(a.draft).addText(a.text, { atUs: sec(a.atSec), durUs: sec(a.durSec), fontSize: a.fontSize, color: a.color, posX: a.posX, posY: a.posY, trackIndex: a.trackIndex })));

s.tool('capcut_add_track', 'Add a new track (video | audio | text | sticker).',
  { draft: z.string(), type: z.enum(['video', 'audio', 'text', 'sticker']).optional(), name: z.string().optional() },
  wrap(async ({ draft, type, name }) => ({ trackIndex: get(draft).addTrack(type || 'video', name) })));

s.tool('capcut_move_segment', 'Move a segment to a new start time and optionally another track.',
  { draft: z.string(), segmentId: z.string(), atSec: z.number(), trackIndex: z.number().int().optional() },
  wrap(async ({ draft, segmentId, atSec, trackIndex }) => get(draft).moveSegment(segmentId, sec(atSec), trackIndex)));

s.tool('capcut_trim_segment', 'Change a segment start / duration / source in-point (seconds).',
  { draft: z.string(), segmentId: z.string(), atSec: z.number().optional(), durSec: z.number().optional(), srcStartSec: z.number().optional() },
  wrap(async ({ draft, segmentId, atSec, durSec, srcStartSec }) => get(draft).trimSegment(segmentId, { atUs: sec(atSec), durUs: sec(durSec), srcStartUs: sec(srcStartSec) })));

s.tool('capcut_split_segment', 'Split a segment into two at a timeline time.',
  { draft: z.string(), segmentId: z.string(), atSec: z.number() },
  wrap(async ({ draft, segmentId, atSec }) => get(draft).splitSegment(segmentId, sec(atSec))));

s.tool('capcut_delete_segment', 'Remove a segment.',
  { draft: z.string(), segmentId: z.string() }, wrap(async ({ draft, segmentId }) => get(draft).deleteSegment(segmentId)));

s.tool('capcut_set_props', 'Set transform / opacity / volume / speed / visibility on a segment.',
  { draft: z.string(), segmentId: z.string(), scale: z.number().optional(), scaleX: z.number().optional(), scaleY: z.number().optional(),
    posX: z.number().optional(), posY: z.number().optional(), rotation: z.number().optional(), opacity: z.number().optional(),
    volume: z.number().optional(), speed: z.number().optional(), visible: z.boolean().optional() },
  wrap(async (a) => get(a.draft).setProps(a.segmentId, a)));

s.tool('capcut_set_crop',
  'Crop a video/photo segment: keep only a rectangle of the SOURCE frame. left/top/right/bottom are the edges of the area you KEEP, as fractions 0..1 ' +
  'measured from the top-left corner of the source video (left < right, top < bottom). Example: a streamer webcam in the top-left of a 1920x1080 recording ' +
  'spanning x 0-410 px and y 165-405 px -> left 0, top 0.153, right 0.214, bottom 0.375. Full frame = 0,0,1,1 (removes the crop). ' +
  'If the clip shares its material with another segment (e.g. after a split), the clip first gets its own copy so the other segment is untouched. ' +
  'Webcam window / picture-in-picture recipe: capcut_duplicate_segment on the gameplay clip (the copy lands on a new video track on top), capcut_set_crop on the COPY ' +
  'to the webcam area, then capcut_set_props on the copy: scale (e.g. 0.4-0.6) to shrink it, posX/posY to move it into a corner. ' +
  'posX/posY are the clip centre offset in units of HALF the canvas: posX -1 = centre on the left edge, +1 = right edge; posY +1 = top edge, -1 = bottom edge (positive is UP). ' +
  'For a window of displayed size w x h px on a W x H canvas, top-left corner = posX -(1 - w/W), posY +(1 - h/H). ' +
  'The result includes approxSizeOnCanvasAtScale1 (the cropped area fitted to the canvas, before scale) to help compute w and h. Session edit; call capcut_save to persist.',
  { draft: z.string(), segmentId: z.string(),
    left: z.number().min(0).max(1).describe('left edge of the kept area, 0..1 of source width'),
    top: z.number().min(0).max(1).describe('top edge of the kept area, 0..1 of source height'),
    right: z.number().min(0).max(1).describe('right edge of the kept area, 0..1 of source width (> left)'),
    bottom: z.number().min(0).max(1).describe('bottom edge of the kept area, 0..1 of source height (> top)') },
  wrap(async ({ draft, segmentId, left, top, right, bottom }) => get(draft).setCrop(segmentId, { left, top, right, bottom })));

s.tool('capcut_duplicate_segment',
  'Copy a video/photo segment to a NEW video track on top of all video tracks (or to trackIndex, which must be a video track that is free in that time range), ' +
  'same timeline position and source in-point. Its material and linked effects/filters are copied with new ids, so cropping or restyling the copy never touches the original ' +
  '(transitions are not copied: a lone copy has no next clip). The copy layers above all video clips but stays under texts and stickers. Returns the new segmentId. ' +
  'Use it for picture-in-picture: keep the original full screen, then capcut_set_crop + capcut_set_props (scale, posX, posY) on the copy to make e.g. a webcam window in a corner. ' +
  'Session edit; call capcut_save to persist.',
  { draft: z.string(), segmentId: z.string(), trackIndex: z.number().int().optional().describe('existing video track to put the copy on; omit to create a new top track') },
  wrap(async ({ draft, segmentId, trackIndex }) => get(draft).duplicateSegment(segmentId, trackIndex)));

s.tool('capcut_raw_patch', 'Advanced escape hatch: deep-merge a JSON patch into draft_content (undocumented ops). Use with care.',
  { draft: z.string(), patch: z.record(z.any()) }, wrap(async ({ draft, patch }) => get(draft).rawPatch(patch)));

s.tool('capcut_validate', 'Check the (in-session) draft for overlaps, duplicate ids/render_index, missing media.',
  { draft: z.string() }, wrap(async ({ draft }) => get(draft).validate()));

s.tool('capcut_save', 'Write session edits to disk (backs up .mcpbak, validates). Refuses if CapCut is open unless force:true.',
  { draft: z.string(), force: z.boolean().optional() },
  wrap(async ({ draft, force }) => { const r = get(draft).save({ force: !!force }); open.delete(draft); return r; }));

s.tool('capcut_discard', 'Drop unsaved session edits and reload the draft from disk.',
  { draft: z.string() }, wrap(async ({ draft }) => { open.delete(draft); return { discarded: draft }; }));

// optional extension modules (each exports register(server, ctx))
for (const f of ['./ek-efekt.js', './ek-yazi.js']) {
  try { const m = await import(f); m.register(s, { get, wrap, z, sec, US }); }
  catch (e) { process.stderr.write(`[capcut-mcp] extension ${f} not loaded: ${e.message}\n`); }
}

const transport = new StdioServerTransport();
await s.connect(transport);
process.stderr.write(`[capcut-mcp] ready. drafts: ${DRAFTS_DIR}\n`);
