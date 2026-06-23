# UI Handoff — Pond Mockup → DeKoi Shell

This document is an implementation plan for adopting
`design/pond-mockup.html` as the basis for DeKoi's UI. It is written so that
another agent can execute it end-to-end without re-deriving the design or the
project rules.

## 1. Purpose and scope

**In scope**

- Replace the current placeholder UI with the pond mockup as the new app shell
  and Pond (home) surface.
- Port the mockup's visual system (tokens, fonts, animations, SVG art) into the
  React + TypeScript + Vite app.
- Wire the mockup's interactions (mode dock, koi cards, pools, Pond Care
  drawer, chips, sliders, toggles) to React state.
- Preserve the existing Bubble-thread behavior (send / placeholder reply /
  localStorage) by re-homing it behind the new shell as the Bubble surface.

**Out of scope (do not build yet)**

- Provider/generation runtime, real model replies.
- VN and Game surfaces beyond visual placeholders.
- Legacy import, Tauri storage, media library, webhook surfaces.
- Anything labeled "Deep water" / "Surfacing soon" in the mockup — render as
  disabled/locked affordances only.

## 2. Source references

| Artifact | Path | Role |
| --- | --- | --- |
| Mockup (source of truth for look) | `design/pond-mockup.html` | 1065-line single-file HTML. All hex values, class names, SVG, and JS behaviors come from here. |
| Product rules | `PRODUCT.md` | "calm, intimate, handmade"; water/paper/ink/coral motifs. |
| Architecture lanes | `ARCHITECTURE.md` | `src/engine`, `src/features`, `src/shared`, `src/runtime`. UI lives in `src/features` and `src/shared`. |
| Naming rules | `SURFACE_LABELS.md` | Public labels, internal nouns, legacy aliases. **Read before naming anything.** |
| Domain records | `DOMAIN_MODEL.md` | Bubble/Character/Persona/Lorebook/Ripple record shapes. |
| Clean-room boundary | `CLEAN_ROOM.md` | No copying from the prior fork-derived repo. The mockup is a user-supplied design, not legacy code, so it is an allowed input — but write the React implementation fresh in DeKoi terms. |
| Current shell (to be replaced) | `src/App.tsx`, `src/App.css`, `src/index.css`, `src/features/home/Home.tsx` | Old light-theme placeholder. |
| Current Bubble logic (to preserve) | `src/features/home/Home.tsx`, `src/engine/bubble-actions.ts`, `src/runtime/bubble-local-storage.ts` | Keep the send/reply/persist behavior. |

Open the mockup directly in a browser to see motion and hover states that
screenshots cannot convey.

## 3. Mockup anatomy

Single fixed-viewport app (100vh, `overflow:hidden` on body). CSS grid shell:

```
grid-template-columns: 80px  minmax(264px,300px) 1fr;
grid-template-rows:    54px  1fr  46px;
grid-template-areas:
  "waterline waterline waterline"
  "bank      shoal     pond"
  "tide      tide      tide";
```

Regions (class → role):

| Region | Class | Lines | Contents |
| --- | --- | --- | --- |
| Top bar | `.waterline` | 86–124 | Brand mark, "DeKoi" wordmark, `.ripple-search` omni-search, `.pebbles` catalog buttons (Lore/Companions/Media/Connections + Pond Care), `.win-dots`. |
| Mode dock | `.bank` | 140–209 | Vertical rail. `.dive` buttons (bubbles/vn/reserved — see §5.1) with hover `.tag` tooltips and `.on` indicator; `.cast-fab` (new chat); `.me` profile bubble. |
| Chat list | `.shoal` | 211–291 | `.shoal-head` (title, search, action pills), `.shoal-meta`, scrollable `.shoal-list` of `.koi-card` entries grouped by `.group-label`. |
| Main canvas | `.pond` | 293–403 | Sticky `.pond-banner`, centered `.pond-inner` containing: `.hero` (animated koi `.pond-eye`), `.pools` (3 organic blob cards), `.section-head` + `.current` (recent drifters), `.depths` (feature finder). |
| Status bar | `.tide` | 487–507 | `.swim-state` pulse, `.surface-input`, `.vitals` bars (Clarity/Stock). |
| Settings drawer | `.care` + `.scrim` | 509–581 | Right-side drawer. `.care-tabs`, `.care-body` with `.field`, `.toggle-row` + `.switch`, `.slider-field` + `.track`, `.seg`. |

Reusable SVG art is defined once in a hidden `<svg width=0 height=0>` sprite
(lines 598–621) and referenced via `<use href="#koi-mark">`, `#koi-swimmer`,
`#fish`. Three symbols: `koi-mark` (logo), `koi-swimmer` (animated swimmer with
wiggling tail), `fish` (simple side icon).

Animations: `.caustics` drift (two layers), `.pond-eye` ripple-ping + multi-ring
orbits (cw/ccw) of koi swimmers, `.tide` pulse, `.koi-swimmer .tail` wiggle.
`@media (prefers-reduced-motion:reduce)` kills all motion (lines 584–586).

JS behaviors (lines 1002–1062): Pond Care open/close + Esc + scrim click; care
tab single-select; `[data-toggle]` switch toggle; `selectMode(mode)` syncing
`.dive` and `.pool`; `#surfaceChips`/`#depthChips` single-select chip groups;
`.seg` single-select; `[data-track]` pointer-drag sliders. (`selectMode` reads
`data-mode`, whose values are now the DeKoi ids `bubbles`/`vn`/`reserved`.)

## 4. Conflicts and decisions

Status: **all resolved.** The mockup (`design/pond-mockup.html`) has already
been amended to match DeKoi's docs (§5.1). What follows is the reasoning, kept
so the next agent understands why the labels differ from a plain visual copy.

### 4.1 Naming — modes vs surfaces (RESOLVED)

The original mockup used three "modes": Conversation / Roleplay / Game
(`data-mode="talk"|"tale"|"quest"`). Those conflicted with the repo's rules:

- `SURFACE_LABELS.md` says verbatim: "Avoid using `Conversation Mode` as public
  text or `conversation` as a native DeKoi mode ID." and "Avoid using `Roleplay
  Mode` as public text or `roleplay` as a native DeKoi mode ID."
- `DOMAIN_MODEL.md` line 30: "Game/adventure-style play is intentionally out of
  scope for now."
- The agreed DeKoi labels are **Bubbles** (DM-style chat) and **VN** (visual
  novel). Game is not a first-slice surface.

Per the user's decision ("amend the docs to reflect DeKoi's docs"), the mockup
was relabeled to the DeKoi-native mapping in §5.1. The amended mockup contains
no `Conversation`/`Roleplay`/`Game` surface text and no
`talk`/`tale`/`quest`/`conversation`/`roleplay`/`game` mode ids (verified by
grep). Do not reintroduce them.

### 4.2 Theme flip

The current app is light (`src/index.css` `--background:#eff8f5`,
`src/App.css` light surfaces). The mockup is a dark pond theme. The mockup
becomes the new default. The old tokens and `App.css` are replaced, not merged.

### 4.3 Mockup is a dashboard, not the chat surface

The mockup's `.pond` is a **home/landing canvas** (hero, pools, recent
currents, feature finder). It is not the message-thread view. The repo already
has working Bubble-thread logic in `src/features/home/Home.tsx`
(send → placeholder reply → localStorage). That logic must be preserved and
moved into a Bubble surface reached from the Pond (via Cast-a-line, a pool, or
a koi card).

### 4.4 Routing

No router is installed. The mockup implies navigation (modes, pools, koi cards,
Pond Care). Decide between a tiny state-based view switch and adding
`react-router`. Recommendation in §5.

### 4.5 Fonts and offline-first

Mockup loads Google Fonts (Shippori Mincho + Inter) via CDN `<link>`. The
product is "local-first". Decide CDN vs self-hosted.

## 5. Resolutions (applied)

All of the following are decided. §5.1 is already reflected in the mockup;
§5.2–§5.6 are the implementation choices to follow during the port.

### 5.1 Mode → surface mapping (applied to the mockup)

The mockup's three dives/pools now use DeKoi-native labels and ids. Visual
color coding (koi/jade/amber) is preserved; only the names changed and the
out-of-scope surface is marked Reserved.

| Original mockup `data-mode` | Original label | DeKoi surface (now in mockup) | `data-mode` (now) | Color token | First-slice status |
| --- | --- | --- | --- | --- | --- |
| `talk` | Conversation | **Bubbles** | `bubbles` | `--koi` | Active. Routes to the Bubble surface. |
| `tale` | Roleplay | **VN** | `vn` | `--jade` | Placeholder. Lock with "Surfacing soon" in the React port. |
| `quest` | Game | **Reserved** (no native label yet) | `reserved` | `--amber` | Out of scope. Lock as "Deep water" in the React port. |

Where this already landed in the mockup: `.dive .tag` copy (lines 651, 655,
659), `.kc-mode` chips on koi cards (lines 697, 706, 717, 726, 735), `.pool h3`
titles (lines 800, 811, 822), `.drifter .dmode` chips (lines 842, 850, 858), the
Depths pop-results (lines 894–895), and the Send-on-Enter `.seg` options
(lines 989–991). CSS class hooks were renamed to match: `.dive.bubbles` /
`.dive.vn` / `.dive.reserved`, `.pool.bubbles` / `.pool.vn` / `.pool.reserved`,
`.kc-mode.bubbles` / `.kc-mode.vn` / `.kc-mode.reserved`, `.dmode.vn` /
`.dmode.reserved`. Two free-text spots were also fixed: the hero eyebrow is now
"The Pond · character story engine" (was "AI roleplay engine"), and the Pond
Care toggle is now "Surface all text at once" (was "Surface game text at once").

Note: the mockup shows VN and Reserved as visually-present but not yet locked.
The React port adds the locked/disabled + tooltip treatment per their
first-slice status above.

### 5.2 Theme (resolves §4.2)

Introduce a single token sheet `src/shared/ui/pond-tokens.css` containing the
mockup's `:root` block (see §7) plus base body/caustics styles. Import it once
from `src/main.tsx` (replacing the current `index.css` import). Delete the old
light tokens from `src/index.css` and the old `src/App.css` rules once the new
shell renders.

### 5.3 Re-home Bubble logic (resolves §4.3)

- Create `src/features/pond/Pond.tsx` (the mockup's `.pond` home canvas).
- Move the existing thread state and send/reply logic out of `Home.tsx` into a
  new `src/features/bubbles/BubbleThread.tsx` (keep the same hooks/effects and
  the same `loadBubbleThread`/`saveBubbleThread` runtime).
- `Home.tsx` becomes a thin router (see §5.4) or is deleted in favor of
  `App.tsx` hosting the shell + active view.

### 5.4 Routing (resolves §4.4)

Start with a **state-based view switch** in `App.tsx` — no new dependency:

```ts
type PondView = { kind: 'pond' } | { kind: 'bubble'; threadId: string }
```

Lift `view` and `setView` via props or a tiny React context
(`src/shared/ui/nav-context.ts`). Cast-a-line / pool click / koi-card click call
`setView({ kind: 'bubble', threadId })`. The shell (waterline/bank/shoal/tide)
stays mounted across views; only `.pond` swaps content. Add `react-router` only
when a third top-level surface or deep-linking is actually needed.

### 5.5 Pond Care drawer (resolves settings scope)

Implement Pond Care as a presentational drawer driven by local component state
(`open`/`activeTab`) — no settings store yet. Wire only the controls that have
an immediate, safe effect (e.g., Send-on-Enter surface, "Ask before releasing a
koi"). Leave sliders, language, Spotify, etc. as visual-only state for now;
annotate them as not-yet-persisted.

### 5.6 Fonts (resolves §4.5)

Start with the mockup's CDN `<link>` in `index.html` to match the design
exactly and unblock visual work. Track self-hosting (woff2 in `public/fonts/`
+ `@font-face`) as a follow-up so the app stays usable offline. This matches
the "local-first" direction without blocking the visual port.

## 6. Target architecture

Follow `ARCHITECTURE.md` lanes. New/changed files:

```
index.html                              add Google Fonts <link> + title "DeKoi — The Pond"
src/main.tsx                            import pond-tokens.css instead of index.css
src/App.tsx                             shell + view switch (replaces current)
src/index.css                           delete old light tokens (or empty out)
src/App.css                             delete (old placeholder styles)

src/shared/ui/
  pond-tokens.css                       :root tokens, base body, caustics, scrollbar, focus-visible, reduced-motion
  nav-context.ts                        view + selected thread + selected mode context
  KoiSprite.tsx                         inline SVG sprite (koi-mark, koi-swimmer, fish) rendered once at app root
  icons/                                small stroke icons used by bank/pools (chat, book, trophy) as React components
  primitives/
    Switch.tsx + Switch.css             toggle
    Slider.tsx + Slider.css             pointer-drag slider
    Seg.tsx + Seg.css                   segmented single-select
    Chip.tsx + Chip.css                 single-select chip group

src/features/shell/
  Shell.tsx + Shell.css                 .app grid; hosts Waterline, Bank, Shoal, Pond host, Tide, Care drawer, Scrim

src/features/shell/waterline/
  Waterline.tsx + Waterline.css         brand, wordmark, RippleSearch, Pebbles, win-dots

src/features/shell/bank/
  Bank.tsx + Bank.css                   bank-label, Dive buttons (Bubbles/VN/Reserved), CastFab, Me

src/features/shell/shoal/
  Shoal.tsx + Shoal.css                 head, search, action pills, meta, list
  KoiCard.tsx                           one thread row (ava, name, sub, mode chip)
  koi-card.css

src/features/shell/tide/
  Tide.tsx + Tide.css                   swim-state, surface-input, vitals

src/features/shell/care/
  CareDrawer.tsx + CareDrawer.css       scrim + drawer; tabs; body
  CareTabs.tsx
  care-fields.css                       field, toggle-row, slider-field, seg shared rules

src/features/pond/
  Pond.tsx + Pond.css                   .pond host: banner + view switch ( PondHome | BubbleThread | ... )
  PondHome.tsx                          hero + pools + recent currents + depths
  hero/
    PondEye.tsx + PondEye.css           animated koi orbit art
    Hero.tsx + hero.css
  pools/
    ModePools.tsx + pools.css           3 organic blob cards
  currents/
    RecentCurrents.tsx + currents.css   section-head + drifter cards
  depths/
    Depths.tsx + depths.css             feature finder (search, chips, pop results)

src/features/bubbles/
  BubbleThread.tsx + bubble-thread.css  EXISTING send/reply/localStorage logic, restyled to pond theme
```

Keep the engine layer untouched: `src/engine/*` and `src/runtime/*` stay as-is.
The Shoal and Recent Currents read the same `BubbleThread`/`CharacterRecord`
samples the old Home used.

## 7. Design tokens

Copy this `:root` block verbatim into `src/shared/ui/pond-tokens.css` (from
mockup lines 11–34) and do not rename — the rest of the CSS depends on these
exact names:

```css
:root{
  --abyss:#091317;
  --water:#0e1b21;
  --shallow:#13242b;
  --raise:#172d35;
  --reed:#233b44;
  --reed-soft:#1b313a;
  --koi:#f47a35;
  --koi-hot:#ff9a4d;
  --koi-deep:#d85f23;
  --jade:#27b3aa;
  --jade-hot:#3ad0c6;
  --amber:#e3a534;
  --amber-hot:#f3bd55;
  --foam:#e9f1f2;
  --mist:#86a0a8;
  --mist-dim:#5c7882;
  --belly:#f5ece1;
  --display:'Shippori Mincho','Songti SC',serif;
  --ui:'Inter',system-ui,-apple-system,sans-serif;
  --r-lg:22px;
  --r-md:14px;
  --r-sm:10px;
}
```

Also port from the mockup: body background gradients + `overflow:hidden`
(lines 38–47), `.caustics` + `.caustics.b` + `drift`/`drift-b` keyframes
(lines 50–67), the `.app` grid (lines 69–83), scrollbar-thumb styles,
`:focus-visible` (line 583), and the `prefers-reduced-motion` guard
(lines 584–586). Put base/body/caustics in `pond-tokens.css`; component styles
go in each feature's co-located `.css`.

## 8. Implementation phases

Execute in order. Each phase ends with `pnpm build` (and `pnpm dev` eyeball)
passing. Phase 0 is already complete (the mockup itself was amended).

### Phase 0 — Reconcile naming (DONE)

The mockup (`design/pond-mockup.html`) already uses DeKoi-native labels and
mode ids (Bubbles / VN / Reserved); see §5.1. Before coding, add DeKoi surface
id constants to the engine (e.g. `BUBBLES`, `VN`, `RESERVED`) if not present,
so the React port has a single source of truth to import. No change to
`SURFACE_LABELS.md` or `DOMAIN_MODEL.md` is needed — they already mandate these
labels.

### Phase 1 — Tokens, fonts, sprite, shell skeleton

- Add Google Fonts `<link>` to `index.html`; set `<title>DeKoi — The Pond</title>`.
- Create `src/shared/ui/pond-tokens.css` (§7 + base/caustics/grid/reduced-motion).
- Import it from `src/main.tsx`; remove the old `index.css` light tokens and
  delete `src/App.css`.
- Create `src/shared/ui/KoiSprite.tsx` rendering the three `<symbol>`/`<g>` defs
  from mockup lines 598–621 exactly once (place near app root, `width=0
  height=0`).
- Create `Shell.tsx` with the `.app` grid and empty Waterline/Bank/Shoal/Pond/
  Tide/Care regions using mockup layout CSS.

Acceptance: app boots to a dark pond background with caustics drifting and the
grid skeleton visible; `pnpm build` passes.

### Phase 2 — Static shell regions (no interactions)

Port each region's markup + CSS as static React, using the §5.1 labels:

- Waterline (brand, wordmark, omni-search input, pebbles, win-dots).
- Bank (Bubbles/VN/Reserved dives with tooltips; CastFab; Me).
- Shoal (head, search, pills, meta, sample koi cards from `sampleBubbleThread`/
  `sampleCompanions` — map each thread to a `KoiCard`).
- Tide (swim-state pulse, surface-input, vitals).
- Pond banner + PondHome: Hero (with `PondEye` animation), ModePools (3 cards),
  RecentCurrents, Depths.
- CareDrawer markup (closed by default).

Acceptance: pixel-close to the mockup when opened side by side; hover states
work via CSS; `pnpm build` passes.

### Phase 3 — Interactions and state

- `nav-context.ts`: `view`, `selectedThreadId`, `selectedSurface`
  (`'bubbles'|'vn'|'reserved'`), `careOpen`, `careTab`.
- Bank dive + ModePools click → set `selectedSurface` (sync both, like the
  mockup's `selectMode`). Reserved/VN are locked (aria-disabled, tooltip
  "Surfacing soon").
- CastFab + Bubbles pool + koi-card click → `setView({kind:'bubble',
  threadId})`.
- Chip groups (Depths surface + depth) → single-select local state.
- Seg control (Send-on-Enter) → single-select.
- Switch toggles → local state (only persist Send-on-Enter + "Ask before
  releasing" semantics later).
- Slider primitive → pointer-drag (port mockup lines 1050–1062) with keyboard
  support (Left/Right).
- CareDrawer open/close: gear button, X button, scrim click, Esc.

Acceptance: every control in the mockup responds; only Bubbles is navigable.

### Phase 4 — Re-home Bubble surface

- Create `src/features/bubbles/BubbleThread.tsx` by moving the thread state,
  `handleSend`, `handleResetThread`, autoscroll effect, and
  `load/saveBubbleThread` usage out of `Home.tsx`.
- Restyle to pond theme (dark surface, foam text, jade/koi accents). Replace
  the old `App.css`/`index.css` light classes (`bubble-surface`, `message-list`,
  `bubble-message*`, `bubble-composer`, etc.) with new pond-themed classes.
- Pond.tsx view switch: `view.kind === 'bubble'` renders `BubbleThread`; else
  renders `PondHome`.
- Back/cast navigation returns to `{kind:'pond'}`.

Acceptance: send a message → placeholder reply appears → reload keeps history
(localStorage). The pond theme is consistent end to end.

### Phase 5 — Polish and a11y

- Keyboard: dives and cards are `role="button" tabindex="0"` with Enter/Space
  activation (mockup already sets tabindex on dives).
- `prefers-reduced-motion` already global; verify caustics/orbit/pulse stop.
- Focus-visible outlines (jade) on all interactive elements.
- Aria labels on icon-only buttons (pebbles, cast-fab, x, sort).
- Min-width guard: the mockup only has one `@media (max-width:1080px)` rule
  (stacks pools/currents). Decide and document behavior below ~900px (e.g.,
  collapse Shoal → use the `.app.shoal-closed` class already in the mockup,
  line 83).

Acceptance: keyboard-only walkthrough works; reduced-motion is calm; `pnpm
lint` and `pnpm build` pass.

## 9. Component mapping (mockup → React)

| Mockup selector | Component | CSS file |
| --- | --- | --- |
| `.app` | `Shell` | `Shell.css` |
| `.waterline` | `Waterline` | `Waterline.css` |
| `.bank`, `.dive`, `.cast-fab`, `.me` | `Bank` | `Bank.css` |
| `.shoal`, `.shoal-*`, `.pill`, `.mark-chip`, `.group-label` | `Shoal` | `Shoal.css` |
| `.koi-card`, `.ava`, `.kc-*` | `KoiCard` | `koi-card.css` |
| `.tide`, `.swim-state`, `.surface-input`, `.vitals` | `Tide` | `Tide.css` |
| `.scrim`, `.care`, `.care-*`, `.ctab` | `CareDrawer` + `CareTabs` | `CareDrawer.css`, `care-fields.css` |
| `.field`, `.toggle-row`, `.switch` | `Switch` + fields | `care-fields.css`, `Switch.css` |
| `.slider-field`, `.track`, `.knob` | `Slider` | `Slider.css` |
| `.seg`, `.opt` | `Seg` | `Seg.css` |
| `.chips`, `.chip` | `Chip` | `Chip.css` |
| `.pond`, `.pond-banner`, `.pond-inner` | `Pond` | `Pond.css` |
| `.hero`, `.eyebrow`, `h1`, `.sub`, `.hero-cta`, `.cta` | `Hero` | `hero.css` |
| `.pond-eye`, `.ring`, `.ripple-ping`, `.orbit`, `.koi-wrap`, `.wake` | `PondEye` | `PondEye.css` |
| `.pools`, `.pool`, `.shimmer`, `.pool-ic`, `.pool-meta`, `.go` | `ModePools` | `pools.css` |
| `.section-head`, `.current`, `.drifter`, `.dmode` | `RecentCurrents` | `currents.css` |
| `.depths`, `.depths-*`, `.pop-results`, `.pop`, `.stock`, `.browse-all` | `Depths` | `depths.css` |
| `#koi-mark`, `#koi-swimmer`, `#fish` | `KoiSprite` (defs) + `<use>` sites | — |

## 10. Behavior spec (port these faithfully)

Restate each mockup JS behavior so it survives the React rewrite:

1. **Pond Care open/close** — gear (`.pebble.care#openCare`) opens; `.x#closeCare`
   and scrim click close; `Esc` closes. → `careOpen` in nav context; effect
   listens for Esc.
2. **Care tabs** — single-select across `.ctab`. → `careTab` state.
3. **Toggles** — `[data-toggle]` flips `.on`. → controlled `Switch` with own
   state (persist later).
4. **Mode sync** — clicking a `.dive` or `.pool` sets the active mode on both
   bank and pools. → `selectedSurface` in nav context; Bank and ModePools both
   read it.
5. **Chip groups** — `#surfaceChips` and `#depthChips` are independent
   single-select groups. → two `Chip` instances with separate state.
6. **Seg** — single-select within a `.seg`. → `Seg` with controlled value.
7. **Sliders** — pointer-down on `.track` jumps + drags via window
   pointermove/up; clamps 0..1; sets `.fill` width and `.knob` left. → `Slider`
   using pointer events + a value prop; add Left/Right/Home/End keys.

## 11. Gotchas and constraints

- **`color-mix(in srgb, …)`** is used heavily (`.pool`, `.dive.on`, avatars,
  message-list background in the old CSS). Modern Chrome/Firefox/Safari support
  it; if you need older-browser support, hardcode the mixed values. Vite needs
  no config for it.
- **`.app.shoal-closed`** (line 83) collapses the Shoal column to `0` width —
  reuse this for narrow viewports or a future toggle rather than inventing new
  rules.
- **Orbit art** uses CSS custom properties `--T` (period) and `--R` (radius) on
  `.orbit`/`.koi-wrap`, plus negative `animation-delay` to distribute koi around
  the ring. Keep these inline styles in `PondEye`.
- **`koi-swimmer .tail`** wiggle uses `transform-box:fill-box;
  transform-origin:100% 50%`. Preserve exactly or the tail pivots from the
  wrong point.
- **Reduced motion** — the global `@media (prefers-reduced-motion:reduce)`
  rule must remain last/effective so all orbits, caustics, pings, pulses, and
  wiggles stop.
- **One sprite instance** — render `KoiSprite` once; all `<use href="#…">`
  references rely on those ids existing in the document.
- **Viewport** — mockup is fixed-height (`100vh`, body `overflow:hidden`). Keep
  the shell full-viewport; only `.pond` and `.shoal-list`/`.care-body` scroll
  internally.
- **Surface IDs vs labels** — internal attributes use DeKoi ids (`bubbles`,
  `vn`, `reserved`), never the mockup's `talk/tale/quest` or the forbidden
  words `conversation`/`roleplay`/`game`.
- **Clean room** — do not copy UI text wholesale from the mockup if it
  contradicts DeKoi voice (it's fine to keep decorative phrases like "Cast a
  line", "Sound the depths", "Recent currents"). Do not introduce any label
  banned by `SURFACE_LABELS.md`.

## 12. Validation checklist

- [ ] `pnpm install` then `pnpm dev` shows the pond shell matching the mockup.
- [ ] `pnpm build` passes (TS + Vite).
- [ ] `pnpm lint` passes.
- [ ] Side-by-side: tokens, fonts, orbit animation, caustics, blob pools,
      drawer animation match the mockup.
- [ ] Bubbles dive / Cast-a-line / koi-card navigates to the Bubble surface;
      send → placeholder reply → reload preserves history.
- [ ] VN and Reserved dives/pools are locked with "Surfacing soon"/"Deep water".
- [ ] Pond Care opens via gear, closes via X / scrim / Esc; tabs, switches,
      chips, seg, and slider all respond.
- [ ] Keyboard-only and reduced-motion walkthroughs succeed.
- [ ] No label `Conversation`/`Roleplay`/`Game`/`conversation`/`roleplay`/
      `game` appears as a DeKoi surface name (grep the new code).

## 13. Open questions for the user

1. Should the Shoal list show real saved threads (multiple) in this slice, or
   stay as the single sample thread plus decorative cards?
2. Self-host fonts now (offline-first) or accept CDN for the first cut?
3. Any DeKoi-native copy preference for the hero subtitle / pool descriptions,
   or keep the mockup's wording?

(Naming — Bubbles / VN locked / Reserved locked — is settled; see §5.1.)

## 14. Follow-ups (later, not in this handoff)

- Persist Pond Care settings behind a real settings store.
- Real Shoal with multiple threads, create/rename/delete, and "Ask before
  releasing a koi".
- VN surface behind the same shell.
- Self-hosted fonts + offline assets.
- Router + deep-linking once a third top-level surface exists.
- Media/Net, Inlets/Connections, Keepers surfaces (currently pebbles only).
