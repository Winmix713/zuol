# Premium Layer Editor — Feature Development Roadmap

> **Document type:** Product Plan
> **Revision date:** June 2026
> **Status:** Active — Sprint 1 shipped, Sprint 2 next

---

## 1. Product Context

The Premium Layer Editor is a browser-based design tooling interface built on **React, TypeScript, Tailwind CSS, and Supabase**. It currently delivers a fully functional layer tree with multi-select, drag-and-drop reordering, in-memory undo/redo history, a live card preview with selection-to-region inspection, a Supabase-backed persistence layer, and — as of Sprint 1 — a full Property Inspector and client-side Export/Code Generation.

The `LayerNode` data model already carries the structural depth needed to support a far richer editing experience — `visible`, `locked`, `opacity`, `blend_mode`, `label_color`, and `tags` are all stored per node. The gap between the current state and a professional-grade design tool is primarily a **UI gap, not a data-model gap**. That makes the near-term roadmap unusually tractable: most of the value can be unlocked without schema migrations.

---

## 2. Goals

- Elevate the editor from a layer management panel into a complete, single-surface design authoring environment.
- Maintain the current aesthetic quality standard: every new panel and control must match the existing dark-surface, emerald-accent visual language.
- Keep Supabase as the single source of truth for all persistent state — no client-only data silos.
- Deliver features in an order that maximizes early demonstrability for stakeholder reviews.

---

## 3. Current Capabilities (Baseline)

| Capability | Status |
|---|---|
| Hierarchical layer tree (FRAME / GROUP / SHAPE / TEXT) | ✅ Shipped |
| Multi-select with shift/ctrl and keyboard navigation | ✅ Shipped |
| Drag-and-drop reordering and reparenting | ✅ Shipped |
| Visibility, lock, opacity, blend mode per layer | ✅ Shipped |
| Label color coding and custom tags | ✅ Shipped |
| Full-text search with type / visibility / depth filters | ✅ Shipped |
| Context menu (rename, duplicate, delete, mark color, tags) | ✅ Shipped |
| In-memory undo/redo with keyboard shortcuts | ✅ Shipped |
| Live card preview with selection-to-region highlight inspector | ✅ Shipped |
| Supabase persistence (load/save on change) | ✅ Shipped |
| **Property Inspector panel (Sprint 1)** | ✅ Shipped |
| **Export / Code Generation — CSS, Tailwind, JSON (Sprint 1)** | ✅ Shipped |

---

## 4. Feature Directions

Six development directions are identified below. Each section describes the capability, what the current codebase already provides, what is still missing, and what Supabase data model changes (if any) are required.

---

### 4.1 Property Inspector Panel ✅ Shipped (Sprint 1)

**Category:** Quick win — high impact, low lift
**Estimated effort:** 2–3 days

**What it is.** A third panel positioned to the right of the card preview that exposes every attribute of the currently selected layer as interactive, editable controls. This is the most impactful near-term investment because the data already exists in `LayerNode` — only the editing surface was absent.

**Delivered.** The shipped panel (`src/components/PropertyInspector.tsx`) edits every persisted `LayerNode` field: a fill color control (HEX input + native swatch, with RGB/HSL read-only views), an opacity slider, a blend-mode dropdown, visibility and lock toggles, mark-color swatches, and a tag editor. All edits route through the history-aware setter so they are undoable and persist via the existing debounced Supabase save. The Card Preview updates synchronously on every change.

**Deferred to a later schema-bearing sprint.** Transform (X/Y/W/H/rotation), stroke (`stroke_color`, `stroke_width`, `stroke_style`), typography (`font_family`, `font_size`, `font_weight`, `line_height`, `letter_spacing`, `text_align`), shadow/blur effects, and edge-pinning constraints (`constraints` JSONB) all require new columns and were intentionally left out of the no-migration Sprint 1.

**Dependencies (when extended).** One Supabase migration to add columns for typography, stroke, shadow, and constraints. Consider a single JSONB column for extended properties to avoid column proliferation on the `layers` table.

---

### 4.2 Export and Code Generation ✅ Shipped (Sprint 1)

**Category:** Quick win — high impact, low lift
**Estimated effort:** 1–2 days

**What it is.** Derive usable, copy-pasteable code from the current layer selection, bridging the design-to-development handoff gap with a pure client-side rendering pass over data already available.

**Delivered.** `src/lib/codegen.ts` provides pure helpers consumed by the Inspector's "Export & Code" drawer and the context menu:

- **CSS generator** — produces a formatted rule block (`color`/`background-color`, `opacity`, `mix-blend-mode`, `display`) per selected layer, with one-click copy.
- **Tailwind class inference** — maps stored values to the nearest utilities (`opacity-80`, `mix-blend-multiply`, arbitrary color value) as a single-line string.
- **JSON export** — serializes the selection (or full subtree) and offers a file download.
- **Context menu integration** — "Copy CSS" and "Copy as JSON" entries call `navigator.clipboard.writeText()`.

**Deferred.** SVG/PNG/WebP raster export was left out to avoid the `html2canvas` dependency in this pass; it can be added with native `XMLSerializer` (SVG) and an offscreen-canvas rasterizer (PNG) later.

**Dependencies.** None — no Supabase changes, no new npm packages for the shipped scope.

---

### 4.3 Persistent Version History and Named Snapshots — ⏭️ Sprint 2 (next)

**Category:** Meaningful upgrade — moderate lift
**Estimated effort:** 3–4 days

**What it is.** Persist the undo/redo history across sessions and add named, human-readable snapshots that function as an audit trail and safety net.

**Current state.** `useHistory` maintains a 50-entry in-memory stack. On page close, all history is lost. There is no way to label a state or return to it after a session ends.

**What needs building.**

- Supabase `history_snapshots` table: `id` (uuid), `name` (text), `created_at` (timestamptz), `tree_state` (jsonb — full flattened `LayerNode[]`), `is_auto` (boolean), `thumbnail_url` (text, nullable).
- Auto-snapshot trigger: on a 5-minute interval and on significant destructive events (bulk delete, drag reparent), save a snapshot silently with an auto-generated name ("Auto-save 14:32").
- Manual snapshot: a "Save version" button in the panel header opens a popover with a name input; on confirm the current tree is serialized and written to `history_snapshots`.
- Version browser: a dropdown alongside Undo/Redo lists the 20 most recent snapshots in reverse-chronological order with name, timestamp, and a "Restore" button.
- Diff preview *(stretch)*: before restoring, show a count of added, removed, and modified layers vs. the current state.
- Branching *(stretch)*: "Fork from this version" copies a snapshot into a new project document for safe experimentation.

**Dependencies.** One Supabase migration for the `history_snapshots` table with an RLS policy matching the existing single-tenant `layers` pattern (anon + authenticated CRUD).

---

### 4.4 Component and Symbol System — Sprint 3

**Category:** Meaningful upgrade — moderate lift
**Estimated effort:** 5–7 days

**What it is.** Promote any layer or group to a reusable master component. Instances can be placed anywhere in the tree; editing the master propagates to all instances automatically. This is the foundational feature of any serious design-system workflow.

**Current state.** The `LayerType` enum has no Component type. There is no master/instance relationship in the data model.

**What needs building.**

- `components` table: `id`, `master_layer_id` (uuid FK to `layers`), `name`, `created_at`.
- `component_instances` table: `id`, `component_id` (FK), `instance_layer_id` (FK), `overrides` (jsonb — per-instance property overrides).
- "Create Component" context-menu action: promotes the selected layer to a master, inserts a `components` row, and adds a `component_id` column to `layers` for linking.
- Instance creation: dragging a component from a library panel into the tree creates a `component_instances` row and renders an instance node with a badge.
- Master propagation: when a master updates, a `useEffect` in `useLayers` applies the delta to all instances, skipping overridden properties.
- Component badge: `TypeIcon` gains a diamond indicator for masters and a linked-diamond variant for instances.
- Context-menu additions: "Detach Instance", "Reset Overrides", "Go to Main Component".
- Component library panel: a searchable, scrollable grid of all project components; drag-to-canvas to place an instance.

**Dependencies.** Two Supabase migrations (`components`, `component_instances`) plus a nullable `component_id` column on `layers`. New RLS policies following the existing single-tenant pattern.

---

### 4.5 Real-Time Collaboration — Sprint 4

**Category:** Big bet — high complexity, high ceiling
**Estimated effort:** 7–10 days

**What it is.** Multiple users editing the same card simultaneously with live cursor presence, granular conflict resolution, and graceful offline degradation — the single largest perceived capability leap and the feature most likely to drive team-level adoption.

**Current state.** All edits are single-user. Supabase is already in the stack (auth and realtime primitives ship in `@supabase/supabase-js` v2). There is no presence, broadcast, or multi-client reconciliation logic.

**What needs building.**

- Supabase Realtime broadcast channel per card document; each client subscribes on mount and broadcasts layer mutations to minimize latency.
- Presence tracking: each client registers a payload with user id, display name, color, and current `focusedLayerId`; Supabase Presence tracks join/leave.
- Collaborator avatars in the panel header; clicking one scrolls the tree to that user's focused layer.
- Cursor overlay: the focused layer's row shows a colored left-border accent in each collaborator's presence color, distinct from the local emerald selection accent.
- Optimistic UI: local mutations apply instantly, broadcast, then reconcile against Supabase on reconnect.
- Conflict strategy: last-write-wins at the property level. For `locked` layers, the server rejects mutations from any client other than the lock holder, enforced via an RLS policy checking a `locked_by` column.
- `locked_by` column on `layers` (uuid, nullable): set to the editing session ID on edit start, cleared on blur or disconnect.
- Connection status badge ("Live" / "Reconnecting…" / "Offline") with a queued-changes count in offline mode.
- Activity feed *(stretch)*: a collapsible list of recent edit events.

**Dependencies.** One Supabase migration for the `locked_by` column. Supabase Auth required for stable user identity (anonymous or email/password). All Realtime code lives in a new `useCollaboration` hook.

---

### 4.6 Interactive Prototype Mode — Sprint 5

**Category:** Big bet — high complexity, high ceiling
**Estimated effort:** 10–14 days

**What it is.** Define connections between layers — trigger on click or hover, navigate to a target layer, play a transition — and play them back interactively in the card preview. This transitions the product from a layer editor into a complete design tool.

**Current state.** `CardPreview` is a static render. There is no concept of connections, states, or transitions in the data model.

**What needs building.**

- `layer_connections` table: `id`, `source_layer_id` (FK), `target_layer_id` (FK), `trigger` (click/hover/drag/press-hold), `transition` (fade/slide-left/slide-right/scale/push/dissolve), `duration_ms` (int), `easing` (text), `created_at`.
- Connection creation UI: a "Connect" mode toggle swaps the drag cursor for a connector cursor; clicking source then target creates a connection.
- Connection wires: thin curved SVG arrows overlaid on the layer tree, color-coded by trigger type.
- Prototype mode toggle ("P" shortcut or header button) switches `CardPreview` into interactive playback; connected sources respond to their triggers.
- Playback engine: a `usePrototype` hook manages the active state, transition animations (CSS transitions / Web Animations API), and traversed-state history.
- Transition library: fade, slide (four directions), scale, push, dissolve — configurable duration (default 300 ms) and easing.
- Reset control: an overlay button returns to the initial state (also via Esc).
- Shareable preview links *(stretch)*: a read-only route serving a stripped `CardPreview` with embedded connection data, via a Supabase Edge Function.

**Dependencies.** One Supabase migration for `layer_connections`. A new `usePrototype` hook and significant `CardPreview` playback additions.

---

## 5. Recommended Sequencing

| Sprint | Direction | Effort | Status | Primary reason |
|---|---|---|---|---|
| 1 | Property Inspector | 2–3 days | ✅ Done | `LayerNode` already holds most fields. Only UI was missing. Immediately transforms perceived quality. |
| 1 | Export / Code Gen | 1–2 days | ✅ Done | Zero backend changes. Shares the selection model with the Inspector. Shipped in the same sprint. |
| 2 | Version History | 3–4 days | ⏭️ Next | One new table. Builds on the existing `useHistory` machinery. Makes all future iteration safer. |
| 3 | Component System | 5–7 days | Planned | Requires the stable property-editing layer from Sprint 1. Unlocks design-system scale. |
| 4 | Real-Time Collaboration | 7–10 days | Planned | Supabase Realtime keeps it tractable. Biggest team-facing capability. |
| 5 | Prototype Mode | 10–14 days | Planned | Most ambitious. Requires stable editing, components, and a connection data model. Ships last. |

**Sprint 1 rationale (delivered).** Property Inspector and Export shared the same selection model (`selectedIds`), required no new Supabase tables for their core functionality, and delivered the highest ratio of user-perceived value to engineering effort.

---

## 6. Technical Dependencies and Risks

| Direction | Supabase schema change | New React hooks | Key risk |
|---|---|---|---|
| Property Inspector | New columns (typography, stroke, shadow, constraints) *when extended* | None (extends `useLayers`) | Column proliferation on `layers` — consider a JSONB column for extended properties |
| Export / Code Gen | None | None | SVG/PNG rasterization fidelity for complex blend modes |
| Version History | `history_snapshots` table | None (extends `useHistory`) | JSONB tree blobs can grow large for deep trees — consider compression |
| Component System | `components`, `component_instances` tables, `component_id` on `layers` | `useComponents` | Override-merge logic has non-trivial edge cases |
| Realtime Collaboration | `locked_by` column on `layers` | `useCollaboration` | Auth strategy — anonymous sessions vs. named users |
| Prototype Mode | `layer_connections` table | `usePrototype` | Transition animation performance on low-power devices |

---

## 7. Success Metrics (Definition of Done per Direction)

- **Property Inspector** *(met)* — All persisted `LayerNode` fields editable through the panel; changes survive a reload; Card Preview updates synchronously.
- **Export** *(met)* — CSS output is valid and copy-ready; JSON re-imports cleanly via the existing `loadLayers` path.
- **Version History** — Snapshots persist across browser sessions; restoring returns the tree to an identical state, verified by `flattenTree` output.
- **Component System** — Editing a master's name propagates to all instances within 200 ms; detached instances are fully independent thereafter.
- **Realtime Collaboration** — Two tabs reflect each other's mutations within 500 ms under normal network conditions; offline edits sync on reconnect without data loss.
- **Prototype Mode** — A click-trigger connection plays a fade transition and lands on the target layer's visual state; Esc returns to the initial state.
