import type { LayerNode, BlendMode, LayerType, CardRegion } from '../types/layers';
import { uid } from './tree-utils';

/**
 * Pure, client-side code generation utilities for the Property Inspector /
 * Export panel. No backend, no schema dependencies — everything is derived
 * from the fields already present on `LayerNode`.
 */

const CSS_BLEND_MODES: Record<BlendMode, string> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'soft-light': 'soft-light'
};

/** Normalize a hex string into a comparable lowercase 6-digit form. */
function normalizeHex(hex: string): string {
  let h = hex.trim().replace('#', '').toLowerCase();
  if (h.length === 3) {
    h = h.
    split('').
    map((c) => c + c).
    join('');
  }
  return h.slice(0, 6);
}

export function hexToRgb(hex: string): {r: number;g: number;b: number;} {
  const h = normalizeHex(hex);
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n))).
  toString(16).
  padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(
r: number,
g: number,
b: number)
: {h: number;s: number;l: number;} {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

export function formatRgbString(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

export function formatHslString(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Build a formatted CSS rule block for a single layer. */
export function generateCss(node: LayerNode): string {
  const lines: string[] = [];
  const opacity = node.opacity ?? 100;
  const blend = (node.blend_mode ?? 'normal') as BlendMode;

  if (node.type === 'TEXT') {
    lines.push(`color: ${node.color};`);
  } else {
    lines.push(`background-color: ${node.color};`);
  }

  if (opacity !== 100) {
    lines.push(`opacity: ${(opacity / 100).toFixed(2)};`);
  }
  if (blend !== 'normal') {
    lines.push(`mix-blend-mode: ${CSS_BLEND_MODES[blend]};`);
  }
  if (node.visible === false) {
    lines.push('display: none;');
  }

  const selector = `.${slugify(node.name)}`;
  return `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}`;
}

/** Map stored property values onto the closest Tailwind utility classes. */
export function generateTailwind(node: LayerNode): string {
  const classes: string[] = [];
  const opacity = node.opacity ?? 100;
  const blend = (node.blend_mode ?? 'normal') as BlendMode;

  // Opacity → nearest Tailwind step (0–100 by 5).
  if (opacity !== 100) {
    const step = Math.round(opacity / 5) * 5;
    classes.push(`opacity-${step}`);
  }

  const blendMap: Record<BlendMode, string> = {
    normal: '',
    multiply: 'mix-blend-multiply',
    screen: 'mix-blend-screen',
    overlay: 'mix-blend-overlay',
    darken: 'mix-blend-darken',
    lighten: 'mix-blend-lighten',
    'soft-light': 'mix-blend-soft-light'
  };
  if (blendMap[blend]) classes.push(blendMap[blend]);

  if (node.visible === false) classes.push('hidden');

  // Color is a custom value — emit an arbitrary-value utility.
  const colorPrefix = node.type === 'TEXT' ? 'text' : 'bg';
  classes.push(`${colorPrefix}-[${node.color}]`);

  return classes.join(' ');
}

/** Strip children for a clean, serializable export of the selected subtree. */
export function nodeToExportJson(node: LayerNode): Record<string, unknown> {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    color: node.color,
    visible: node.visible ?? true,
    locked: node.locked ?? false,
    opacity: node.opacity ?? 100,
    blend_mode: node.blend_mode ?? 'normal',
    label_color: node.label_color ?? null,
    tags: node.tags ?? [],
    children: node.children?.map(nodeToExportJson) ?? []
  };
}

export function slugify(name: string): string {
  return (
    name.
    trim().
    toLowerCase().
    replace(/[^a-z0-9]+/g, '-').
    replace(/^-+|-+$/g, '') || 'layer');

}

/** Copy text to the clipboard, resolving true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Trigger a browser download of a text payload. */
export function downloadFile(
  filename: string,
  content: string,
  mime = 'application/json'
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Versioned export format ──────────────────────────────────────────────────

export const EXPORT_FORMAT = 'layer-editor';
export const EXPORT_VERSION = 1;

export interface LayerExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  project: { name: string };
  layers: ReturnType<typeof nodeToExportJson>[];
  exportedAt: string;
}

export function buildExportPayload(
  layers: LayerNode[],
  projectName: string
): LayerExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    project: { name: projectName },
    layers: layers.map(nodeToExportJson),
    exportedAt: new Date().toISOString(),
  };
}

// ─── Import validation ────────────────────────────────────────────────────────

const ALLOWED_TYPES: LayerType[] = ['FRAME', 'GROUP', 'SHAPE', 'TEXT'];
const ALLOWED_REGIONS: CardRegion[] = [
  'frame', 'header', 'logo', 'nav', 'hero', 'heroTitle',
  'heroBg', 'creatorCard', 'glow', 'shadow',
];

export interface ImportError {
  path: string;
  message: string;
}

export interface ImportResult {
  ok: boolean;
  layers: LayerNode[];
  errors: ImportError[];
  warnings: ImportError[];
}

function validateNode(
  raw: unknown,
  path: string,
  seenIds: Set<string>,
  errors: ImportError[],
  warnings: ImportError[]
): LayerNode | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ path, message: 'Node must be an object.' });
    return null;
  }
  const node = raw as Record<string, unknown>;

  // id — generate a fresh one if missing or duplicate to avoid collisions
  let id: string;
  if (typeof node.id === 'string' && node.id.trim()) {
    if (seenIds.has(node.id)) {
      warnings.push({ path, message: `Duplicate id "${node.id}" — replaced with a new id.` });
      id = uid();
    } else {
      id = node.id;
    }
  } else {
    warnings.push({ path, message: 'Missing id — generated a new one.' });
    id = uid();
  }
  seenIds.add(id);

  // name
  const name = typeof node.name === 'string' && node.name.trim()
    ? node.name.trim()
    : 'Unnamed Layer';

  // type
  if (!ALLOWED_TYPES.includes(node.type as LayerType)) {
    errors.push({ path, message: `Invalid type "${node.type}". Allowed: ${ALLOWED_TYPES.join(', ')}.` });
    return null;
  }
  const type = node.type as LayerType;

  // color
  const color =
    typeof node.color === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(node.color)
      ? node.color
      : '#A78BFA';

  // opacity
  const rawOpacity = typeof node.opacity === 'number' ? node.opacity : 100;
  const opacity = Math.max(0, Math.min(100, rawOpacity));
  if (rawOpacity !== opacity) {
    warnings.push({ path, message: `opacity ${rawOpacity} clamped to ${opacity}.` });
  }

  // visible / locked
  const visible = node.visible !== false;
  const locked = node.locked === true;

  // blend_mode
  const ALLOWED_BLENDS = ['normal','multiply','screen','overlay','darken','lighten','soft-light'];
  const blend_mode = ALLOWED_BLENDS.includes(node.blend_mode as string)
    ? (node.blend_mode as LayerNode['blend_mode'])
    : 'normal';

  // tags
  const tags = Array.isArray(node.tags)
    ? node.tags.filter((t): t is string => typeof t === 'string')
    : [];

  // preview_region
  const preview_region = ALLOWED_REGIONS.includes(node.preview_region as CardRegion)
    ? (node.preview_region as CardRegion)
    : null;

  // label_color
  const ALLOWED_LABELS = ['red','amber','green','sky','pink','gray'];
  const label_color = ALLOWED_LABELS.includes(node.label_color as string)
    ? (node.label_color as LayerNode['label_color'])
    : null;

  // children (recursive)
  const children: LayerNode[] = [];
  if (Array.isArray(node.children)) {
    node.children.forEach((child, i) => {
      const validated = validateNode(child, `${path}.children[${i}]`, seenIds, errors, warnings);
      if (validated) children.push(validated);
    });
  }

  return { id, name, type, color, opacity, visible, locked, blend_mode, tags, preview_region, label_color, children };
}

/**
 * Parse and validate a raw JSON import. Accepts both the versioned format
 * (with `format` and `version` fields) and legacy plain arrays.
 */
export function parseImport(raw: unknown): ImportResult {
  const errors: ImportError[] = [];
  const warnings: ImportError[] = [];
  const seenIds = new Set<string>();

  let rawLayers: unknown[];

  if (Array.isArray(raw)) {
    // Legacy: plain array of nodes
    rawLayers = raw;
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (obj.format !== EXPORT_FORMAT) {
      warnings.push({ path: 'root', message: `Unknown format "${obj.format}" — proceeding anyway.` });
    }
    if (typeof obj.version === 'number' && obj.version > EXPORT_VERSION) {
      warnings.push({ path: 'root', message: `File version ${obj.version} is newer than supported (${EXPORT_VERSION}).` });
    }
    if (!Array.isArray(obj.layers)) {
      errors.push({ path: 'root.layers', message: 'Expected an array of layers.' });
      return { ok: false, layers: [], errors, warnings };
    }
    rawLayers = obj.layers;
  } else {
    errors.push({ path: 'root', message: 'Import must be an object or array.' });
    return { ok: false, layers: [], errors, warnings };
  }

  const layers: LayerNode[] = [];
  rawLayers.forEach((item, i) => {
    const node = validateNode(item, `layers[${i}]`, seenIds, errors, warnings);
    if (node) layers.push(node);
  });

  return {
    ok: errors.length === 0 && layers.length > 0,
    layers,
    errors,
    warnings,
  };
}

/**
 * Recursively assign fresh IDs to every node in a subtree.
 * This is required for merge mode so imported nodes never collide with
 * nodes already present in the editor tree — even deep descendants.
 *
 * Returns a new tree (does not mutate the input).
 */
export function remapAllIds(nodes: LayerNode[]): LayerNode[] {
  return nodes.map((node) => ({
    ...node,
    id:       uid(),
    children: remapAllIds(node.children ?? []),
  }));
}

/**
 * Prepare validated import nodes for a merge operation:
 * every node in every subtree gets a brand-new unique ID.
 */
export function prepareForMerge(nodes: LayerNode[]): LayerNode[] {
  return remapAllIds(nodes);
}

/**
 * Read a File object as text and run parseImport on it.
 */
export async function importFromFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      layers: [],
      errors: [{ path: 'file', message: 'File is not valid JSON.' }],
      warnings: [],
    };
  }
  return parseImport(raw);
}

/**
 * Read text from the clipboard and run parseImport on it.
 */
export async function importFromClipboard(): Promise<ImportResult> {
  let text: string;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    return {
      ok: false,
      layers: [],
      errors: [{ path: 'clipboard', message: 'Could not read clipboard.' }],
      warnings: [],
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      layers: [],
      errors: [{ path: 'clipboard', message: 'Clipboard content is not valid JSON.' }],
      warnings: [],
    };
  }
  return parseImport(raw);
}
