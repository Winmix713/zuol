import type { LayerNode, BlendMode } from '../types/layers';

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
mime = 'application/json')
: void {
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