export type LayerType = 'FRAME' | 'GROUP' | 'SHAPE' | 'TEXT';

export type BlendMode =
'normal' |
'multiply' |
'screen' |
'overlay' |
'darken' |
'lighten' |
'soft-light';

export type LabelColor = 'red' | 'amber' | 'green' | 'sky' | 'pink' | 'gray';

/**
 * Stable, id-based binding between a layer and a region of the card preview.
 * Renaming a layer no longer breaks the preview link (it used to be matched
 * by `name`). Seed layers carry an explicit region.
 */
export type CardRegion =
'frame' |
'header' |
'logo' |
'nav' |
'hero' |
'heroTitle' |
'heroBg' |
'creatorCard' |
'glow' |
'shadow';

export interface LayerNode {
  id: string;
  name: string;
  type: LayerType;
  color: string;
  children?: LayerNode[];
  parent_id?: string | null;
  order?: number;
  created_at?: string;
  updated_at?: string;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  blend_mode?: BlendMode;
  label_color?: LabelColor | null;
  tags?: string[];
  /** Optional explicit binding to a preview region (id-stable). */
  preview_region?: CardRegion | null;
}

export interface DragDropState {
  dragId: string | null;
  overId: string | null;
  overMode: 'before' | 'into';
}

export interface ContextMenuState {
  x: number;
  y: number;
  node: LayerNode;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

export const TYPE_ICONS: Record<LayerType, string> = {
  FRAME: 'frame',
  GROUP: 'folder',
  SHAPE: 'square',
  TEXT: 'text'
};

export const TYPE_COLORS: Record<LayerType, string> = {
  FRAME: '#4ADE80',
  GROUP: '#38BDF8',
  SHAPE: '#A78BFA',
  TEXT: '#FB923C'
};

export const BLEND_MODES: BlendMode[] = [
'normal',
'multiply',
'screen',
'overlay',
'darken',
'lighten',
'soft-light'];


export const BLEND_MODE_LABELS: Record<BlendMode, string> = {
  normal: 'Normal',
  multiply: 'Multiply',
  screen: 'Screen',
  overlay: 'Overlay',
  darken: 'Darken',
  lighten: 'Lighten',
  'soft-light': 'Soft Light'
};

export const LABEL_COLORS: Record<LabelColor, string> = {
  red: '#EF4444',
  amber: '#F59E0B',
  green: '#22C55E',
  sky: '#0EA5E9',
  pink: '#EC4899',
  gray: '#6B7280'
};