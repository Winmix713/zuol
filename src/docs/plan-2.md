**Here is the expanded, professionally structured product plan document, synthesizing all three source versions and grounded in the live codebase:**



**---**



**# Premium Layer Editor — Feature Development Roadmap**



**\*\*Document type:\*\* Product Plan**

**\*\*Revision date:\*\* June 2026**

**\*\*Status:\*\* Draft — pending prioritization sign-off**



**---**



**## 1. Product Context**



**The Premium Layer Editor is a browser-based design tooling interface built on React, TypeScript, Tailwind CSS, and Supabase. It currently delivers a fully functional layer tree with multi-select, drag-and-drop reordering, in-memory undo/redo history, live card preview with selection-to-region inspection, and a Supabase-backed persistence layer.**



**The `LayerNode` data model already carries the structural depth needed to support a far richer editing experience — `visible`, `locked`, `opacity`, `blend\_mode`, `label\_color`, and `tags` are all stored per node. The gap between the current state and a professional-grade design tool is primarily a UI gap, not a data-model gap. That makes the near-term roadmap unusually tractable: most of the value can be unlocked without schema migrations.**



**---**



**## 2. Goals**



**- Elevate the editor from a layer management panel into a complete, single-surface design authoring environment.**

**- Maintain the current aesthetic quality standard: every new panel and control must match the existing dark-surface, emerald-accent visual language.**

**- Keep Supabase as the single source of truth for all persistent state — no client-only data silos.**

**- Deliver features in an order that maximizes early demonstrability for stakeholder reviews.**



**---**



**## 3. Current Capabilities (Baseline)**



**| Capability | Status |**

**|---|---|**

**| Hierarchical layer tree (FRAME / GROUP / SHAPE / TEXT) | Shipped |**

**| Multi-select with shift/ctrl and keyboard navigation | Shipped |**

**| Drag-and-drop reordering and reparenting | Shipped |**

**| Visibility, lock, opacity, blend mode per layer | Shipped |**

**| Label color coding and custom tags | Shipped |**

**| Full-text search with type / visibility / depth filters | Shipped |**

**| Context menu (rename, duplicate, delete, mark color, tags) | Shipped |**

**| In-memory undo/redo with keyboard shortcuts | Shipped |**

**| Live card preview with selection-to-region highlight inspector | Shipped |**

**| Supabase persistence (load/save on change) | Shipped |**



**---**



**## 4. Feature Directions**



**Six development directions are identified below. Each section describes the capability, what the current codebase already provides, what is still missing, and what the Supabase data model changes (if any) are required.**



**---**



**### 4.1 Property Inspector Panel**



**\*\*Category:\*\* Quick win — high impact, low lift**

**\*\*Estimated effort:\*\* 2–3 days**



**\*\*What it is.\*\* A third panel positioned to the right of the card preview that exposes every attribute of the currently selected layer as interactive, editable controls. This is the most impactful near-term investment because the data already exists in `LayerNode` — only the editing surface is absent.**



**\*\*Current state.\*\* Properties like `opacity`, `blend\_mode`, `visible`, `locked`, `label\_color`, and `tags` are readable throughout the application. The `color` field is displayed via `TypeIcon` but is not writable through any UI control. There are no position, size, stroke, or typography fields in the model yet.**



**\*\*What needs building.\*\***



**- Transform section: numeric inputs for X, Y, Width, and Height with drag-to-scrub (click and drag on the label to increment/decrement). Unit toggle between px and %. Rotation input.**

**- Fill section: interactive color picker with HEX/RGB/HSL tabs, an opacity slider, and a recent-colors row. Writes back to the `color` field on the `LayerNode`. Persists via the existing `useLayers` update path.**

**- Stroke section: color picker, numeric width input, style selector (solid/dashed/dotted), and alignment toggle (inside/center/outside). Requires adding `stroke\_color`, `stroke\_width`, `stroke\_style` to `LayerNode` and to the `layers` Supabase table.**

**- Typography section (TEXT layers only): font family input, weight selector, size input, line-height, letter-spacing, alignment buttons, and text-decoration toggles. Requires new columns: `font\_family`, `font\_size`, `font\_weight`, `line\_height`, `letter\_spacing`, `text\_align`.**

**- Effects section: collapsible sub-panel showing blend mode (already stored), opacity (already stored), shadow offset/blur/spread, and background blur. Shadow and blur require new columns.**

**- Constraints section: edge-pinning controls for responsive layout behavior (pin left, right, top, bottom, scale). Requires a `constraints` JSONB column.**



**\*\*Persistence model.\*\* All changes apply optimistic local state first (instant UI response), then debounce-write to Supabase via the existing `saveLayers` path. On field blur or after 300 ms of inactivity, the change commits.**



**\*\*Dependencies.\*\* One Supabase migration to add new columns for typography, stroke, shadow, and constraints. No schema rearchitecture.**



**---**



**### 4.2 Export and Code Generation**



**\*\*Category:\*\* Quick win — high impact, low lift**

**\*\*Estimated effort:\*\* 1–2 days**



**\*\*What it is.\*\* Derive usable, copy-pasteable code from the current layer selection. This bridges the design-to-development handoff gap without requiring any backend changes — it is a pure client-side rendering pass over data that is already available.**



**\*\*Current state.\*\* All visual properties are stored on `LayerNode`. Nothing currently generates code from them.**



**\*\*What needs building.\*\***



**- CSS generator: for the selected layer(s), compute a `opacity`, `mix-blend-mode`, `transform`, `font-size`, `font-family`, `letter-spacing`, `text-align`, `color` CSS block. Output in a formatted code block with a one-click copy button.**

**- Tailwind class inference: map stored property values to the closest Tailwind utility classes (e.g. `opacity-80`, `mix-blend-multiply`, `text-xl`). Display as a single-line class string.**

**- JSON export: flatten the current layer tree using the existing `flattenTree` function and trigger a file download of the structured JSON. Works as a backup format and a programmatic hand-off artifact.**

**- SVG export: serialize the `CardPreview` DOM subtree using `XMLSerializer` and offer it as a downloadable `.svg` file.**

**- PNG/WebP raster export: render `CardPreview` to an `OffscreenCanvas` via `html2canvas` or a similar approach, at 1x, 2x, and 3x scale, and offer as a download.**

**- Context menu integration: "Copy CSS", "Copy SVG", "Copy as JSON" entries added to the existing `ContextMenu` component, calling `navigator.clipboard.writeText()`.**

**- Code panel: a collapsible drawer below the card preview showing live-updating CSS output for the current selection.**



**\*\*Dependencies.\*\* No Supabase changes required. No new npm packages if SVG export uses native browser APIs.**



**---**



**### 4.3 Persistent Version History and Named Snapshots**



**\*\*Category:\*\* Meaningful upgrade — moderate lift**

**\*\*Estimated effort:\*\* 3–4 days**



**\*\*What it is.\*\* Persist the undo/redo history across sessions and add named, human-readable snapshots that function as an audit trail and safety net.**



**\*\*Current state.\*\* `useHistory` maintains a 50-entry in-memory stack. On page close, all history is lost. There is no way to label a state or return to it after a session ends.**



**\*\*What needs building.\*\***



**- Supabase `history\_snapshots` table with columns: `id` (uuid), `name` (text), `created\_at` (timestamptz), `tree\_state` (jsonb — full flattened `LayerNode\[]`), `is\_auto` (boolean), `thumbnail\_url` (text, nullable).**

**- Auto-snapshot trigger: on every 5-minute interval and on significant destructive events (bulk delete, drag reparent), save a snapshot silently with an auto-generated name ("Auto-save 14:32").**

**- Manual snapshot: a "Save version" button in the panel header opens a small popover with a name input. On confirm, the current tree is serialized and written to `history\_snapshots`.**

**- Version browser: a dropdown alongside the Undo/Redo buttons lists the 20 most recent snapshots in reverse-chronological order with name, timestamp, and a "Restore" button.**

**- Diff preview (stretch goal): before restoring, show a side-by-side count of added, removed, and modified layers compared to the current state.**

**- Branching (stretch goal): "Fork from this version" creates a copy of the snapshot as a new project document, allowing safe experimentation without affecting the main tree.**



**\*\*Dependencies.\*\* One Supabase migration to add the `history\_snapshots` table with an appropriate RLS policy (single-tenant: anon + authenticated CRUD, matching the existing `layers` table policy pattern).**



**---**



**### 4.4 Component and Symbol System**



**\*\*Category:\*\* Meaningful upgrade — moderate lift**

**\*\*Estimated effort:\*\* 5–7 days**



**\*\*What it is.\*\* Promote any layer or group to a reusable master component. Instances of the component can be placed anywhere in the tree. Editing the master propagates changes to all instances automatically. This is the foundational feature of any serious design system workflow.**



**\*\*Current state.\*\* The `LayerType` enum has no Component type. There is no concept of master/instance relationships in the data model.**



**\*\*What needs building.\*\***



**- `components` Supabase table: `id`, `master\_layer\_id` (uuid FK to `layers`), `name`, `created\_at`. One row per component definition.**

**- `component\_instances` table: `id`, `component\_id` (FK), `instance\_layer\_id` (FK to `layers`), `overrides` (jsonb — per-instance property overrides, e.g. different fill color while inheriting everything else from master).**

**- "Create Component" context menu action: promotes the selected layer to a master, inserts a row in `components`, and adds a `component\_id` column to the `layers` table for linking.**

**- Instance creation: dragging a component from a component library panel into the tree creates a new `component\_instances` row and renders an instance node with a special badge.**

**- Master propagation: when a master layer updates, a `useEffect` in `useLayers` queries all instances and applies the delta, respecting per-instance overrides (overridden properties are skipped during propagation).**

**- Component badge: `TypeIcon` gains a diamond indicator for master layers; instance layers show a linked-diamond variant. Both distinguished by a dedicated Lucide icon.**

**- Context menu additions: "Detach Instance" (breaks the link, converts instance to an independent copy), "Reset Overrides" (reverts instance-level overrides to master values), "Go to Main Component" (scrolls the layer tree to the master node).**

**- Component library panel: a searchable, scrollable grid of all components in the project. Drag-to-canvas to place an instance.**



**\*\*Dependencies.\*\* Two Supabase migrations: `components` table and `component\_instances` table. A `component\_id` nullable column added to `layers`. New RLS policies following the existing single-tenant pattern.**



**---**



**### 4.5 Real-Time Collaboration**



**\*\*Category:\*\* Big bet — high complexity, high ceiling**

**\*\*Estimated effort:\*\* 7–10 days**



**\*\*What it is.\*\* Multiple users editing the same card simultaneously with live cursor presence, granular conflict resolution, and graceful offline degradation. This is the single largest perceived capability leap and the feature most likely to drive team-level adoption.**



**\*\*Current state.\*\* All edits are single-user. Supabase is already in the stack (the auth and realtime primitives are available in `@supabase/supabase-js` v2). There is no presence, broadcast, or multi-client reconciliation logic.**



**\*\*What needs building.\*\***



**- Supabase Realtime broadcast channel per card document. Each client subscribes on mount. Layer mutations broadcast over the channel rather than relying solely on Postgres CDC events — this minimizes latency.**

**- Presence tracking: each client registers itself on the channel with a payload containing a user identifier, a display name, a color, and their current `focusedLayerId`. Supabase Realtime's presence API tracks join/leave automatically.**

**- Collaborator avatars: small circular avatars appear in the panel header showing who is currently active. Clicking an avatar scrolls the tree to their focused layer.**

**- Cursor overlay: the layer row of the layer each collaborator has focused shows a colored left-border accent using their assigned presence color — distinct from the local emerald selection accent.**

**- Optimistic UI: local mutations apply instantly to the React state (existing behavior). The mutation is then broadcast and all other clients apply it. On reconnect, a full state fetch from Supabase reconciles any deltas missed during the offline window.**

**- Conflict strategy: default is last-write-wins at the property level. For locked layers (`locked: true`), the server rejects mutations from any client other than the one who locked the layer — enforced by a Supabase RLS policy checking a `locked\_by` column.**

**- `locked\_by` column on the `layers` table: `uuid` nullable, set to the editing user's session ID when they begin editing a layer. Cleared on blur or disconnect. Requires an updated migration.**

**- Connection status badge: a small pill indicator in the panel header shows "Live", "Reconnecting...", or "Offline" states. In offline mode, a queued-changes count shows how many local mutations are pending sync.**

**- Activity feed (stretch goal): a collapsible sidebar listing recent edit events — "User A renamed Hero Title 3s ago", "User B changed Header opacity to 85%".**



**\*\*Dependencies.\*\* One Supabase migration to add `locked\_by` column to `layers`. Supabase Auth required for unique user identity across sessions — either lightweight anonymous auth or email/password sign-in. All Realtime channel code lives in a new `useCollaboration` hook.**



**---**



**### 4.6 Interactive Prototype Mode**



**\*\*Category:\*\* Big bet — high complexity, high ceiling**

**\*\*Estimated effort:\*\* 10–14 days**



**\*\*What it is.\*\* Define connections between layers — trigger on click or hover, navigate to a target layer, play a transition animation — and play them back interactively in the card preview. This is the feature that transitions the product from a layer editor into a complete design tool.**



**\*\*Current state.\*\* `CardPreview` is a static render. There is no concept of connections, states, or transitions in the data model.**



**\*\*What needs building.\*\***



**- `layer\_connections` Supabase table: `id`, `source\_layer\_id` (FK), `target\_layer\_id` (FK), `trigger` (enum: click/hover/drag/press-hold), `transition` (enum: fade/slide-left/slide-right/scale/push/dissolve), `duration\_ms` (integer), `easing` (text), `created\_at`.**

**- Connection creation UI: in the layer tree, a "Connect" mode toggle replaces the drag cursor with a connector cursor. Clicking a source layer then a target layer creates a row in `layer\_connections`.**

**- Connection wires: when connections exist, thin curved arrows are drawn overlaid on the layer tree between source and target nodes, using an SVG layer above the tree. Color-coded by trigger type.**

**- Prototype mode toggle: a "P" keyboard shortcut (or a toggle button in the header) switches `CardPreview` from static display mode into interactive prototype mode. In prototype mode, all connected source layers respond to their configured triggers.**

**- Playback engine: a `usePrototype` hook manages current-state (which layer is "active"), transition animations using CSS transitions or Web Animations API, and history of traversed states.**

**- Transition library: fade, slide (four directions), scale, push, and dissolve. Each has configurable duration (default 300 ms) and easing (ease, ease-in-out, spring approximation).**

**- Reset control: an overlay button in prototype mode resets to the initial state.**

**- Shareable preview links (stretch goal): a server-side read-only route serves a stripped version of `CardPreview` with its connection data embedded, accessible without authentication. Implemented via a Supabase Edge Function that renders the prototype schema and returns a static HTML payload or a React-embeddable bundle.**



**\*\*Dependencies.\*\* One Supabase migration for `layer\_connections`. A new `usePrototype` hook. Significant additions to `CardPreview` to support interactive playback.**



**---**



**## 5. Recommended Sequencing**



**| Sprint | Direction | Effort | Primary reason |**

**|---|---|---|---|**

**| 1 | Property Inspector | 2–3 days | `LayerNode` already holds most fields. Only UI is missing. Immediately transforms perceived quality. |**

**| 1 | Export / Code Gen | 1–2 days | Zero backend changes. Shares the selection model with Property Inspector. Ships in the same sprint. |**

**| 2 | Version History | 3–4 days | One new table. Builds on the existing `useHistory` machinery. Makes all future iteration safer. |**

**| 3 | Component System | 5–7 days | Requires stable property editing layer (Sprint 1). Unlocks design-system scale. |**

**| 4 | Real-Time Collaboration | 7–10 days | Supabase Realtime keeps it tractable. Biggest team-facing capability. |**

**| 5 | Prototype Mode | 10–14 days | Most ambitious. Requires stable editing, components, and connection data model. Ships last. |**



**\*\*Sprint 1 rationale.\*\* Property Inspector and Export share the same selection model (`selectedIds`), require no new Supabase tables for their core functionality, and deliver the highest ratio of user-perceived value to engineering effort. Shipping them together is the fastest path to a demonstrably mature editor.**



**---**



**## 6. Technical Dependencies and Risks**



**| Direction | Supabase schema change | New React hooks | Key risk |**

**|---|---|---|---|**

**| Property Inspector | New columns (typography, stroke, shadow, constraints) | None (extends useLayers) | Column proliferation on `layers` table — consider moving extended properties to a JSONB column |**

**| Export / Code Gen | None | None | SVG/PNG rasterization fidelity for complex blend modes |**

**| Version History | `history\_snapshots` table | None (extends useHistory) | JSONB tree blobs can become large for deep trees — consider compression |**

**| Component System | `components`, `component\_instances` tables, `component\_id` on `layers` | useComponents | Override merge logic has non-trivial edge cases |**

**| Realtime Collaboration | `locked\_by` column on `layers` | useCollaboration | Auth strategy — anonymous sessions vs. named users |**

**| Prototype Mode | `layer\_connections` table | usePrototype | Transition animation performance on mobile / low-power devices |**



**---**



**## 7. Success Metrics (Definition of Done per Direction)**



**- \*\*Property Inspector:\*\* All currently stored `LayerNode` fields are editable through the panel. Changes survive a page reload. The Card Preview updates synchronously on every field change.**

**- \*\*Export:\*\* CSS output is valid and copy-ready. JSON export re-imports cleanly via the existing `loadLayers` path. SVG opens in Figma or Inkscape without errors.**

**- \*\*Version History:\*\* Snapshots persist across browser sessions. Restoring a snapshot returns the layer tree to an identical state, verified by the existing `flattenTree` function output.**

**- \*\*Component System:\*\* Editing a master layer's name propagates to all instances within 200 ms. Detached instances are fully independent from that point forward.**

**- \*\*Realtime Collaboration:\*\* Two simultaneous browser tabs reflect each other's layer mutations within 500 ms under normal network conditions. Offline edits sync correctly on reconnect without data loss.**

**- \*\*Prototype Mode:\*\* A defined click-trigger connection plays a fade transition and lands on the target layer's visual state. Press Esc returns to the initial state.**



**---**





