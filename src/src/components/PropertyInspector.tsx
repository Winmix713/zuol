import React, { useEffect, useMemo, useState } from 'react';
import {
  SlidersHorizontal,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Code2,
  Braces,
  Copy,
  Check,
  Download,
  ChevronDown,
  Tag,
  X,
  Layers as LayersIcon } from
'lucide-react';
import type { LayerNode, BlendMode, LabelColor } from '../types/layers';
import { BLEND_MODES, BLEND_MODE_LABELS, LABEL_COLORS } from '../types/layers';
import { getCommonValue, MIXED } from '../lib/tree-utils';
import {
  generateCss,
  generateTailwind,
  nodeToExportJson,
  formatRgbString,
  formatHslString,
  copyToClipboard,
  downloadFile,
  slugify } from
'../lib/codegen';
interface PropertyInspectorProps {
  selectedNodes: LayerNode[];
  /** Apply a fill color to every selected node. */
  onColorChange: (ids: string[], color: string) => void;
  onOpacityChange: (ids: string[], opacity: number) => void;
  onBlendModeChange: (ids: string[], mode: BlendMode) => void;
  onSetVisible: (ids: string[], visible: boolean) => void;
  onSetLocked: (ids: string[], locked: boolean) => void;
  onLabelColor: (ids: string[], color: LabelColor | null) => void;
  onAddTag: (ids: string[], tag: string) => void;
  onRemoveTag: (ids: string[], tag: string) => void;
}
type ColorTab = 'hex' | 'rgb' | 'hsl';
type CodeTab = 'css' | 'tailwind' | 'json';
const labelColorKeys: LabelColor[] = [
'red',
'amber',
'green',
'sky',
'pink',
'gray'];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function SectionHeader({ children }: {children: React.ReactNode;}) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
      {children}
    </div>);

}
export function PropertyInspector({
  selectedNodes,
  onColorChange,
  onOpacityChange,
  onBlendModeChange,
  onSetVisible,
  onSetLocked,
  onLabelColor,
  onAddTag,
  onRemoveTag
}: PropertyInspectorProps) {
  const count = selectedNodes.length;
  const ids = useMemo(() => selectedNodes.map((n) => n.id), [selectedNodes]);
  const [colorTab, setColorTab] = useState<ColorTab>('hex');
  const [codeTab, setCodeTab] = useState<CodeTab>('css');
  const [codeOpen, setCodeOpen] = useState(true);
  const [blendOpen, setBlendOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  // Common (or mixed) values across the whole selection.
  const commonColor = getCommonValue(selectedNodes, (n) => n.color);
  const commonOpacity = getCommonValue(selectedNodes, (n) => n.opacity ?? 100);
  const commonBlend = getCommonValue(
    selectedNodes,
    (n) => (n.blend_mode ?? 'normal') as BlendMode
  );
  const commonVisible = getCommonValue(
    selectedNodes,
    (n) => n.visible !== false
  );
  const commonLocked = getCommonValue(selectedNodes, (n) => n.locked === true);
  const commonLabel = getCommonValue(
    selectedNodes,
    (n) => n.label_color ?? null
  );
  const colorValue = commonColor === MIXED ? '#000000' : commonColor;
  const [draftColor, setDraftColor] = useState<string>(colorValue);
  useEffect(() => {
    setDraftColor(colorValue);
  }, [colorValue]);
  const codeOutput = useMemo(() => {
    if (selectedNodes.length === 0)
    return {
      css: '',
      tailwind: '',
      json: ''
    };
    return {
      css: selectedNodes.map(generateCss).join('\n\n'),
      tailwind: selectedNodes.map(generateTailwind).join('\n'),
      json: JSON.stringify(
        selectedNodes.length === 1 ?
        nodeToExportJson(selectedNodes[0]) :
        selectedNodes.map(nodeToExportJson),
        null,
        2
      )
    };
  }, [selectedNodes]);
  const doCopy = async (key: string, value: string) => {
    if (await copyToClipboard(value)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => c === key ? null : c), 1400);
    }
  };
  const commitColor = (raw: string) => {
    const v = raw.startsWith('#') ? raw : `#${raw}`;
    if (HEX_RE.test(v)) onColorChange(ids, v);else
    setDraftColor(colorValue); // revert invalid input
  };
  const handleAddTag = () => {
    const t = newTag.trim();
    if (!t) return;
    onAddTag(ids, t);
    setNewTag('');
  };
  const isVisible = commonVisible === MIXED ? true : commonVisible;
  const isLocked = commonLocked === MIXED ? false : commonLocked;
  const opacityVal = commonOpacity === MIXED ? 100 : commonOpacity;
  const blendVal = commonBlend === MIXED ? 'normal' as BlendMode : commonBlend;
  const single = count === 1 ? selectedNodes[0] : null;
  const allTags = useMemo(() => {
    const set = new Set<string>();
    selectedNodes.forEach((n) => n.tags?.forEach((t) => set.add(t)));
    return [...set];
  }, [selectedNodes]);
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-panel">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3.5">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-[9px]"
          style={{
            background: 'linear-gradient(140deg, #38BDF833, #38BDF810)',
            boxShadow: 'inset 0 0 0 1px rgba(56,189,248,0.35)'
          }}>
          
          <SlidersHorizontal size={15} className="text-accent-secondary" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          Inspector
        </span>
        {count > 0 &&
        <span className="ml-auto truncate text-[11px] font-medium text-text-muted">
            {count === 1 ? single?.name : `${count} selected`}
          </span>
        }
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
        {count === 0 &&
        <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]">
              <LayersIcon size={20} className="text-text-muted" />
            </span>
            <p className="text-[12px] text-text-muted">
              Select one or more layers
              <br />
              to edit their properties
            </p>
          </div>
        }

        {count > 1 &&
        <div className="mb-4 rounded-[11px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-text-secondary">
            <span className="font-semibold text-text-primary">
              {count} layers
            </span>{' '}
            selected — editing common properties. Differing values show{' '}
            <span className="font-mono text-text-primary">Mixed</span>.
          </div>
        }

        {count > 0 &&
        <div className="space-y-5">
            {/* Quick toggles */}
            <div className="flex items-center gap-2">
              <button
              onClick={() => onSetVisible(ids, !isVisible)}
              aria-label={isVisible ? 'Hide selection' : 'Show selection'}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-2 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/50 ${commonVisible === MIXED ? 'border-white/[0.08] bg-white/[0.03] text-text-muted' : isVisible ? 'border-white/[0.08] bg-white/[0.03] text-text-secondary hover:bg-white/[0.06]' : 'border-red-500/30 bg-red-500/10 text-danger'}`}>
              
                {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                {commonVisible === MIXED ?
              'Mixed' :
              isVisible ?
              'Visible' :
              'Hidden'}
              </button>
              <button
              onClick={() => onSetLocked(ids, !isLocked)}
              aria-label={isLocked ? 'Unlock selection' : 'Lock selection'}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-2 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/50 ${commonLocked === MIXED ? 'border-white/[0.08] bg-white/[0.03] text-text-muted' : isLocked ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-white/[0.08] bg-white/[0.03] text-text-secondary hover:bg-white/[0.06]'}`}>
              
                {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                {commonLocked === MIXED ?
              'Mixed' :
              isLocked ?
              'Locked' :
              'Unlocked'}
              </button>
            </div>

            {/* Fill */}
            <section>
              <SectionHeader>Fill</SectionHeader>
              <div className="rounded-[11px] border border-white/[0.06] bg-black/30 p-3">
                <div className="flex items-center gap-3">
                  <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-[9px] ring-1 ring-inset ring-white/10">
                    <span
                    className="block h-full w-full"
                    style={{
                      background:
                      commonColor === MIXED ?
                      'repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%) 50% / 10px 10px' :
                      colorValue
                    }} />
                  
                    <input
                    type="color"
                    value={colorValue}
                    onChange={(e) => onColorChange(ids, e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Pick fill color" />
                  
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-1">
                      {(['hex', 'rgb', 'hsl'] as ColorTab[]).map((t) =>
                    <button
                      key={t}
                      onClick={() => setColorTab(t)}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors ${colorTab === t ? 'bg-sky-400/15 text-sky-300' : 'text-text-muted hover:text-text-secondary'}`}>
                      
                          {t}
                        </button>
                    )}
                    </div>
                    {colorTab === 'hex' ?
                  <input
                    type="text"
                    value={
                    commonColor === MIXED && draftColor === colorValue ?
                    '' :
                    draftColor
                    }
                    placeholder={commonColor === MIXED ? 'Mixed' : ''}
                    onChange={(e) => setDraftColor(e.target.value)}
                    onBlur={(e) => commitColor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                      commitColor(e.currentTarget.value);
                      if (e.key === 'Escape') setDraftColor(colorValue);
                    }}
                    className="w-full rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[12px] text-text-secondary outline-none ring-1 ring-inset ring-white/[0.06] focus:ring-accent-secondary/50"
                    aria-label="Hex color" /> :


                  <div className="select-all rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[12px] text-text-secondary ring-1 ring-inset ring-white/[0.06]">
                        {commonColor === MIXED ?
                    'Mixed' :
                    colorTab === 'rgb' ?
                    formatRgbString(colorValue) :
                    formatHslString(colorValue)}
                      </div>
                  }
                  </div>
                </div>
              </div>
            </section>

            {/* Opacity */}
            <section>
              <SectionHeader>
                <span className="flex-1">Opacity</span>
                <span className="font-mono text-[11px] tracking-normal text-text-secondary">
                  {commonOpacity === MIXED ? 'Mixed' : `${opacityVal}%`}
                </span>
              </SectionHeader>
              <input
              type="range"
              min={0}
              max={100}
              value={opacityVal}
              onChange={(e) =>
              onOpacityChange(ids, parseInt(e.target.value, 10))
              }
              className="h-1.5 w-full appearance-none rounded-full bg-zinc-700 accent-sky-400 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-secondary"
              aria-label="Opacity" />
            
            </section>

            {/* Blend mode */}
            <section>
              <SectionHeader>Effects</SectionHeader>
              <div className="relative">
                <button
                onClick={() => setBlendOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={blendOpen}
                className="flex w-full items-center justify-between rounded-[10px] border border-white/[0.06] bg-black/30 px-3 py-2 text-[12px] text-text-secondary transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/50">
                
                  <span className="text-text-muted">Blend mode</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {commonBlend === MIXED ?
                  'Mixed' :
                  BLEND_MODE_LABELS[blendVal]}
                    <ChevronDown
                    size={13}
                    className="text-text-muted transition-transform"
                    style={{
                      transform: blendOpen ? 'rotate(180deg)' : 'none'
                    }} />
                  
                  </span>
                </button>
                {blendOpen &&
              <div
                role="listbox"
                className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-white/[0.08] bg-panel-elevated/95 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                
                    {BLEND_MODES.map((mode) =>
                <button
                  key={mode}
                  role="option"
                  aria-selected={mode === blendVal}
                  onClick={() => {
                    onBlendModeChange(ids, mode);
                    setBlendOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-[12px] transition-colors ${mode === blendVal && commonBlend !== MIXED ? 'bg-sky-400/10 text-sky-300' : 'text-text-secondary hover:bg-white/[0.06]'}`}>
                  
                        {BLEND_MODE_LABELS[mode]}
                      </button>
                )}
                  </div>
              }
              </div>
            </section>

            {/* Label color */}
            <section>
              <SectionHeader>
                <Tag size={10} /> Mark color
                {commonLabel === MIXED &&
              <span className="ml-1 font-mono normal-case tracking-normal text-text-muted">
                    (Mixed)
                  </span>
              }
              </SectionHeader>
              <div className="flex items-center gap-2">
                {labelColorKeys.map((c) =>
              <button
                key={c}
                onClick={() =>
                onLabelColor(ids, commonLabel === c ? null : c)
                }
                className={`h-6 w-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${commonLabel === c ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-panel' : ''}`}
                style={{
                  background: LABEL_COLORS[c]
                }}
                aria-label={`Mark ${c}`}
                aria-pressed={commonLabel === c} />

              )}
                {commonLabel && commonLabel !== MIXED &&
              <button
                onClick={() => onLabelColor(ids, null)}
                className="ml-1 text-[11px] text-text-muted hover:text-text-secondary">
                
                    Clear
                  </button>
              }
              </div>
            </section>

            {/* Tags */}
            <section>
              <SectionHeader>
                <Tag size={10} /> Tags
              </SectionHeader>
              {allTags.length > 0 &&
            <div className="mb-2 flex flex-wrap gap-1.5">
                  {allTags.map((tag) =>
              <span
                key={tag}
                className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-text-secondary">
                
                      {tag}
                      <button
                  onClick={() => onRemoveTag(ids, tag)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label={`Remove tag ${tag}`}>
                  
                        <X size={10} />
                      </button>
                    </span>
              )}
                </div>
            }
              <div className="flex items-center gap-1.5">
                <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTag();
                }}
                placeholder={count > 1 ? 'Add tag to all…' : 'Add tag…'}
                className="w-full rounded-md bg-black/40 px-2 py-1.5 text-[11px] text-text-secondary outline-none ring-1 ring-inset ring-white/[0.06] placeholder:text-text-muted focus:ring-accent-secondary/50"
                aria-label="Add tag" />
              
                <button
                onClick={handleAddTag}
                className="rounded-md bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-white/[0.1] hover:text-text-primary">
                
                  Add
                </button>
              </div>
            </section>
          </div>
        }

        {/* Export / Code generation */}
        {count > 0 &&
        <section className="mt-5 border-t border-white/[0.06] pt-4">
            <button
            onClick={() => setCodeOpen((v) => !v)}
            aria-expanded={codeOpen}
            className="mb-3 flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted hover:text-text-secondary">
            
              <Code2 size={11} />
              <span className="flex-1 text-left">Export &amp; Code</span>
              <ChevronDown
              size={13}
              className="transition-transform"
              style={{
                transform: codeOpen ? 'rotate(180deg)' : 'none'
              }} />
            
            </button>

            {codeOpen &&
          <div className="space-y-3">
                <div className="flex items-center gap-1 rounded-[9px] bg-black/40 p-0.5">
                  {(['css', 'tailwind', 'json'] as CodeTab[]).map((t) =>
              <button
                key={t}
                onClick={() => setCodeTab(t)}
                className={`flex-1 rounded-[7px] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${codeTab === t ? 'bg-white/[0.08] text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
                
                      {t}
                    </button>
              )}
                </div>

                <div className="relative">
                  <pre className="max-h-44 overflow-auto rounded-[10px] border border-white/[0.06] bg-black/40 p-3 pr-10 text-[11px] leading-relaxed text-text-secondary [scrollbar-width:thin]">
                    <code className="whitespace-pre font-mono">
                      {codeOutput[codeTab] || '/* nothing to export */'}
                    </code>
                  </pre>
                  <button
                onClick={() => doCopy(codeTab, codeOutput[codeTab])}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-white/[0.06] text-text-secondary transition-colors hover:bg-white/[0.12] hover:text-text-primary"
                aria-label={`Copy ${codeTab}`}
                title={`Copy ${codeTab}`}>
                
                    {copied === codeTab ?
                <Check size={13} className="text-accent" /> :

                <Copy size={13} />
                }
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                onClick={() =>
                downloadFile(
                  `${single ? slugify(single.name) : 'layers'}.json`,
                  codeOutput.json,
                  'application/json'
                )
                }
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06]">
                
                    <Download size={13} /> JSON
                  </button>
                  <button
                onClick={() =>
                downloadFile(
                  `${single ? slugify(single.name) : 'layers'}.css`,
                  codeOutput.css,
                  'text/css'
                )
                }
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06]">
                
                    <Braces size={13} /> CSS
                  </button>
                </div>
              </div>
          }
          </section>
        }
      </div>
    </div>);

}