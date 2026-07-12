import React, { useMemo, useState } from 'react';
import { Figma } from 'lucide-react';
import type { LayerNode, CardRegion, BlendMode } from '../types/layers';
import { flattenNodes } from '../lib/tree-utils';
interface CardPreviewProps {
  selectedIds: Set<string>;
  layers: LayerNode[];
}
interface RegionState {
  /** The layer currently bound to this region (if any). */
  node: LayerNode | null;
  selected: boolean;
  /** An ancestor of the bound layer is selected. */
  ancestorSelected: boolean;
  hidden: boolean;
  opacity: number;
  color: string | null;
  blend: BlendMode;
}
const EMPTY_REGION: RegionState = {
  node: null,
  selected: false,
  ancestorSelected: false,
  hidden: false,
  opacity: 1,
  color: null,
  blend: 'normal'
};
/**
 * Resolve every region purely from `preview_region` bindings (id-stable) and
 * the layer's live properties. Renaming a layer no longer affects the preview.
 */
function useRegions(layers: LayerNode[], selectedIds: Set<string>) {
  return useMemo(() => {
    const flat = flattenNodes(layers);
    // Map region -> the (first) layer bound to it.
    const boundByRegion = new Map<CardRegion, LayerNode>();
    for (const node of flat) {
      if (node.preview_region && !boundByRegion.has(node.preview_region)) {
        boundByRegion.set(node.preview_region, node);
      }
    }
    // Which layers have a selected ancestor (for ancestor-select styling)?
    const ancestorSelected = new Set<string>();
    function markDescendants(node: LayerNode) {
      node.children?.forEach((c) => {
        ancestorSelected.add(c.id);
        markDescendants(c);
      });
    }
    for (const node of flat) {
      if (selectedIds.has(node.id)) markDescendants(node);
    }
    // A region is "effectively hidden" if the bound layer OR any ancestor is hidden.
    const hiddenIds = new Set<string>();
    function walk(nodes: LayerNode[], parentHidden: boolean) {
      for (const n of nodes) {
        const hidden = parentHidden || n.visible === false;
        if (hidden) hiddenIds.add(n.id);
        if (n.children) walk(n.children, hidden);
      }
    }
    walk(layers, false);
    const resolve = (region: CardRegion): RegionState => {
      const node = boundByRegion.get(region) ?? null;
      if (!node) return EMPTY_REGION;
      return {
        node,
        selected: selectedIds.has(node.id),
        ancestorSelected:
        ancestorSelected.has(node.id) && !selectedIds.has(node.id),
        hidden: hiddenIds.has(node.id),
        opacity: (node.opacity ?? 100) / 100,
        color: node.color ?? null,
        blend: (node.blend_mode ?? 'normal') as BlendMode
      };
    };
    return {
      resolve
    };
  }, [layers, selectedIds]);
}
function outlineFor(state: RegionState, hovered: boolean) {
  if (state.selected)
  return {
    outline: '1.5px solid rgba(74,222,128,0.9)',
    shadow: '0 0 16px rgba(74,222,128,0.35)'
  };
  if (hovered)
  return {
    outline: '1.5px solid rgba(74,222,128,0.5)',
    shadow: '0 0 10px rgba(74,222,128,0.18)'
  };
  if (state.ancestorSelected)
  return {
    outline: '1px dashed rgba(74,222,128,0.35)',
    shadow: 'none'
  };
  return {
    outline: 'none',
    shadow: 'none'
  };
}
interface RegionLabelProps {
  show: boolean;
  text: string;
  className?: string;
}
function RegionLabel({ show, text, className = '' }: RegionLabelProps) {
  if (!show) return null;
  return (
    <div
      className={`absolute px-2 py-0.5 rounded text-[10px] font-medium text-emerald-300 whitespace-nowrap z-50 ${className}`}
      style={{
        background: 'rgba(74, 222, 128, 0.15)',
        border: '1px solid rgba(74, 222, 128, 0.3)',
        backdropFilter: 'blur(8px)'
      }}>
      
      {text}
    </div>);

}
export function CardPreview({ selectedIds, layers }: CardPreviewProps) {
  const { resolve } = useRegions(layers, selectedIds);
  const [hovered, setHovered] = useState<CardRegion | null>(null);
  const frame = resolve('frame');
  const header = resolve('header');
  const logo = resolve('logo');
  const nav = resolve('nav');
  const hero = resolve('hero');
  const heroTitle = resolve('heroTitle');
  const heroBg = resolve('heroBg');
  const creator = resolve('creatorCard');
  const glow = resolve('glow');
  const shadow = resolve('shadow');
  const isHovered = (r: CardRegion) => hovered === r;
  const nameOf = (s: RegionState, fallback: string) => s.node?.name ?? fallback;
  return (
    <div className="relative flex h-full w-full items-center justify-center select-none">
      {/* Restrained ambient glow — kept subtle so functional state dominates */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full blur-[120px]"
        style={{
          width: 420,
          height: 420,
          background: 'rgba(74, 222, 128, 0.06)'
        }} />
      

      <div
        className="relative"
        style={{
          width: 380,
          height: 520
        }}>
        
        {/* FRAME */}
        <div
          onMouseEnter={() => setHovered('frame')}
          onMouseLeave={() => setHovered(null)}
          className="relative h-full w-full transition-all duration-300"
          style={{
            borderRadius: 40,
            opacity: frame.hidden ? 0.25 : frame.opacity,
            border:
            outlineFor(frame, isHovered('frame')).outline !== 'none' ?
            outlineFor(frame, isHovered('frame')).outline :
            '1px solid rgba(255,255,255,0.1)',
            boxShadow:
            '0 40px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)' + (
            outlineFor(frame, isHovered('frame')).shadow !== 'none' ?
            `, ${outlineFor(frame, isHovered('frame')).shadow}` :
            ''),
            background: '#07090A'
          }}>
          
          <RegionLabel
            show={frame.selected}
            text={nameOf(frame, 'Frame')}
            className="-top-7 left-3" />
          

          {/* Background glow blobs — react to the glow/heroBg bindings */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              borderRadius: 40,
              zIndex: 0,
              mixBlendMode: glow.blend
            }}>
            
            <div
              className="absolute transition-all duration-500"
              style={{
                top: '10%',
                left: '5%',
                width: 288,
                height: 288,
                background: glow.color ?? '#A8FF50',
                filter: 'blur(60px)',
                opacity: glow.hidden ?
                0 :
                (glow.selected ? 0.6 : 0.4) * glow.opacity,
                borderRadius: '50%'
              }} />
            
            <div
              className="absolute transition-all duration-500"
              style={{
                bottom: '0%',
                right: '-10%',
                width: 320,
                height: 320,
                background: heroBg.color ?? '#7D52FF',
                filter: 'blur(80px)',
                opacity: heroBg.hidden ?
                0 :
                (heroBg.selected ? 0.5 : 0.32) * heroBg.opacity,
                borderRadius: '50%'
              }} />
            
          </div>

          {/* Shadow overlay indicator */}
          {(shadow.selected || isHovered('shadow')) && !shadow.hidden &&
          <div
            className="absolute inset-0 pointer-events-none z-30"
            style={{
              borderRadius: 40,
              background:
              'linear-gradient(to bottom, transparent 70%, rgba(0,0,0,0.3))',
              border: outlineFor(shadow, isHovered('shadow')).outline
            }} />

          }

          {/* Inner content */}
          <div
            className="relative flex h-full w-full flex-col justify-between p-8"
            style={{
              zIndex: 20
            }}>
            
            {/* HEADER */}
            <div
              onMouseEnter={() => setHovered('header')}
              onMouseLeave={() => setHovered(null)}
              className="relative flex items-start justify-between rounded-2xl transition-all duration-300"
              style={{
                opacity: header.hidden ? 0.25 : header.opacity,
                outline: outlineFor(header, isHovered('header')).outline,
                outlineOffset: 10,
                boxShadow: outlineFor(header, isHovered('header')).shadow
              }}>
              
              <RegionLabel
                show={header.selected}
                text={nameOf(header, 'Header')}
                className="-top-7 left-0" />
              

              {/* NAV */}
              <div
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHovered('nav');
                }}
                className="relative rounded-xl transition-all duration-300"
                style={{
                  opacity: nav.hidden ? 0.25 : nav.opacity,
                  outline: outlineFor(nav, isHovered('nav')).outline,
                  outlineOffset: 6,
                  boxShadow: outlineFor(nav, isHovered('nav')).shadow
                }}>
                
                <RegionLabel
                  show={nav.selected}
                  text={nameOf(nav, 'Nav')}
                  className="-top-6 left-0" />
                
                <p
                  className="mb-2 text-[9px] uppercase tracking-[0.3em]"
                  style={{
                    fontFamily: 'monospace',
                    color: 'rgba(255,255,255,0.4)'
                  }}>
                  
                  Prototype
                </p>
                <h2 className="text-xl font-bold leading-tight text-white">
                  Visual
                  <br />
                  Composition
                </h2>
              </div>

              {/* LOGO */}
              <div
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHovered('logo');
                }}
                className="relative transition-all duration-300"
                style={{
                  borderRadius: 16,
                  opacity: logo.hidden ? 0.25 : logo.opacity,
                  outline: outlineFor(logo, isHovered('logo')).outline,
                  outlineOffset: 4,
                  boxShadow: outlineFor(logo, isHovered('logo')).shadow
                }}>
                
                <RegionLabel
                  show={logo.selected}
                  text={nameOf(logo, 'Logo')}
                  className="-top-6 right-0" />
                
                <div
                  className="flex h-10 w-10 items-center justify-center"
                  style={{
                    borderRadius: 16,
                    background: logo.color ?
                    `${logo.color}22` :
                    'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}>
                  
                  <Figma
                    className="h-5 w-5"
                    style={{
                      color: logo.color ?? '#fff'
                    }} />
                  
                </div>
              </div>
            </div>

            {/* HERO */}
            <div className="pointer-events-none absolute left-0 top-1/2 w-full -translate-y-1/2 text-center">
              <div
                onMouseEnter={() => setHovered('hero')}
                onMouseLeave={() => setHovered(null)}
                className="pointer-events-auto relative inline-block transition-all duration-300"
                style={{
                  borderRadius: 20,
                  opacity: hero.hidden ? 0.25 : hero.opacity,
                  outline: outlineFor(hero, isHovered('hero')).outline,
                  outlineOffset: 16,
                  boxShadow: outlineFor(hero, isHovered('hero')).shadow
                }}>
                
                <RegionLabel
                  show={hero.selected}
                  text={nameOf(hero, 'Hero')}
                  className="-top-9 left-1/2 -translate-x-1/2" />
                
                <h1
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHovered('heroTitle');
                  }}
                  className="block text-[96px] font-black leading-none tracking-tighter transition-all duration-300"
                  style={{
                    fontFamily: 'system-ui',
                    opacity: heroTitle.hidden ? 0.25 : heroTitle.opacity,
                    background: heroTitle.selected ?
                    'linear-gradient(to bottom, #fff, rgba(74,222,128,0.5))' :
                    'linear-gradient(to bottom, #fff, rgba(255,255,255,0.10))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    outline: outlineFor(heroTitle, isHovered('heroTitle')).
                    outline,
                    outlineOffset: 8,
                    padding: '0 8px'
                  }}>
                  
                  GLOW
                </h1>
                <RegionLabel
                  show={heroTitle.selected}
                  text={nameOf(heroTitle, 'Hero Title')}
                  className="-top-7 left-1/2 -translate-x-1/2" />
                
              </div>
            </div>

            {/* CREATOR CARD */}
            <div
              onMouseEnter={() => setHovered('creatorCard')}
              onMouseLeave={() => setHovered(null)}
              className="relative w-full transition-all duration-300"
              style={{
                borderRadius: 24,
                opacity: creator.hidden ? 0.25 : creator.opacity,
                outline: outlineFor(creator, isHovered('creatorCard')).outline,
                outlineOffset: 4,
                boxShadow: outlineFor(creator, isHovered('creatorCard')).shadow
              }}>
              
              <RegionLabel
                show={creator.selected}
                text={nameOf(creator, 'Content')}
                className="-top-7 left-0" />
              
              <div
                className="flex items-center gap-4 p-4"
                style={{
                  borderRadius: 24,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}>
                
                <div
                  className="h-12 w-12 flex-shrink-0 rounded-full"
                  style={{
                    padding: 2,
                    background: 'linear-gradient(135deg, #A8FF50, #7D52FF)',
                    boxShadow: '0 0 20px rgba(168,255,80,0.3)'
                  }}>
                  
                  <div
                    className="flex h-full w-full items-center justify-center rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #1a9e60, #3b82f6)',
                      border: '2px solid #07090A'
                    }}>
                    
                    <span className="text-xs font-bold text-white">GS</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white">Creator</h3>
                  <p className="text-[10px] font-medium text-white/50">
                    @glow_studio_pro
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: '#A8FF50',
                      boxShadow: '0 0 6px #A8FF50'
                    }} />
                  
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      background: 'rgba(255,255,255,0.10)'
                    }}
                    aria-hidden="true">
                    
                    →
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}