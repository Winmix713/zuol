import React from 'react';
import { Frame, Folder, Square, Type } from 'lucide-react';
import type { LayerType, LabelColor } from '../types/layers';
import { LABEL_COLORS } from '../types/layers';

const TYPE_ICONS: Record<LayerType, React.ElementType> = {
  FRAME: Frame,
  GROUP: Folder,
  SHAPE: Square,
  TEXT: Type
};

interface TypeIconProps {
  type: LayerType;
  color: string;
  labelColor?: LabelColor | null;
}

export function TypeIcon({ type, color, labelColor }: TypeIconProps) {
  const Icon = TYPE_ICONS[type];

  return (
    <span className="relative">
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-md transition-transform duration-150 group-hover:scale-110"
        style={{
          background: `linear-gradient(140deg, ${color}33, ${color}14)`,
          boxShadow: `inset 0 0 0 1px ${color}40, 0 0 10px ${color}22`
        }}>
        
        <Icon size={13} style={{ color }} />
      </span>
      {labelColor &&
      <span
        className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-black/50"
        style={{ background: LABEL_COLORS[labelColor] }} />

      }
    </span>);

}