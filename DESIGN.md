# DeKoi Design Direction

**Status: Active.** This is the current visual design direction for DeKoi. It replaces all earlier
root design notes. The machine-readable companion contract is [`DESIGN.json`](./DESIGN.json); when
the two disagree, fix the disagreement — do not pick a favorite.

**North star:** _Keep a pond, not a platform._ DeKoi should feel like a small lantern-lit studio
built over dark water: every story lives in the user's own files, every control feels shaped by
hand, koi and ripples move only in open water, and dense creative work always happens on calm,
opaque surfaces.

---

## 1. What DeKoi Is, In Design Terms

DeKoi is a local-first story and character engine. Its surfaces are Messenger threads (fast
DM-style character chat), Roleplay threads (staged character scenes), and the catalogs and care
tools that feed them: Companions, Personas, Lorebooks, Presets (prompt presets), Ripples (dynamic
thread state), Agents (helper modules), Connections (provider connections), and Media. The Pond
Care drawer holds storage, import/export, and provider-key work.

Design-wise that means DeKoi is two things at once, and must be both without apology:

- **A place to be with characters.** Warm, dim, intimate, slightly magical. Sessions run for
  hours; the room has to be pleasant to sit in.
- **A workshop with real tools.** Provider forms, storage repair, lorebook budgets, and export
  flows are first-class product surfaces, not a maintenance closet. They get the same care as the
  hero — quieter, denser, but never raw.

### Audience

- **Casual character-chat friends** — want to open a thread and talk. Setup must explain itself;
  the pond metaphor should welcome, never gate.
- **Writers** — want scene continuity, cast identity, and long readable sessions in Roleplay.
- **Local-first power users** — want visible file ownership, provider control, editable context,
  and honest storage state. They read logs; the logs should be dignified.
- **Nontechnical setup users** — need the provider/runtime path to feel like connecting a lamp,
  not configuring a server.

### The first creative loop

Every shell decision serves this loop, in this order:

1. **Create or import** a Companion (or Persona, or a whole bundle).
2. **Talk or play** — start a Messenger thread or a Roleplay scene.
3. **Save** — into DeKoi-owned local records, visibly.
4. **Reopen** — the thread is there next time, no service required.
5. **Configure a Connection only when needed** — provider setup is a door you open, not a wall you hit.

---

## 2. Experience Pillars

1. **Ownership you can see.** Local-first is a design feature, not a footnote. Save state, storage
   destination, and the active provider are calm, honest facts in the UI — visible at a glance,
   detailed on demand, never buried and never shouted.
2. **A living pond, quietly.** The app breathes at its edges — caustic drift, orbiting koi, ripple
   rings — but never performs while you read or type. Ambient motion lives in open water: the
   home, the empty states, the margins. Dense text sits on still water.
3. **Depth without fog.** Depth comes from stacked opaque materials (abyss → water → shallow →
   raise), light vignettes, and hairline borders — not from blur, translucency over text, or
   gradient haze. If a surface holds words, it is opaque and calm.
4. **Handmade warmth.** Controls feel shaped: pill buttons, soft radii, ink-on-lantern accent
   fills, a serif display face for identity moments, sumi-e brush motifs. Crafted is the goal;
   decorated is the failure mode.
5. **Two doors into the water.** Creating and resuming are always the most obvious actions on
   screen. Messenger and Roleplay entry points stay one gesture from home; nothing about
   configuration stands between a new user and their first thread.
6. **Siblings, not twins.** Messenger and Roleplay share a pond, a palette, and a composer — but
   Messenger is the quick surface (rows, speed, scan) and Roleplay is the staged surface (bubbles,
   cast, scene). Neither borrows the other's costume, and neither clones another product.
7. **The deep tools are kept, not hidden.** Connections and Pond Care's Data & Backup tools are tended
   surfaces: aligned forms, readable logs, explicit dangerous actions, plain-language recovery.
   Advanced never means ugly, and ugly never hides behind "advanced."

---

## 3. Visual Direction

### Mood

Night water under lantern light. The base is deep blue-green darkness with real tonal depth; the
warmth comes from small, deliberate points of koi orange, jade, and amber — like fish and lanterns
seen through the surface. The overall register is _calm, warm, kept_: closer to a private studio
at dusk than to a dashboard, a game, or a chat app.

### The pond shell (material system)

The shell is built from four opaque water materials, stacked from deep to shallow. Elevation is a
step up the stack, not a drop shadow:

| Material   | Token     | Use                                                                                |
| ---------- | --------- | ---------------------------------------------------------------------------------- |
| Deep water | `abyss`   | App backdrop only. The radial pond-light gradients and sumi-e watermark live here. |
| Water      | `water`   | Shell chrome: waterline, bank, tide, and other frame regions.                      |
| Shallow    | `shallow` | Secondary panels: shoal, thread headers, drawers' section chrome.                  |
| Raise      | `raise`   | Primary work surfaces: the pond, thread bodies, cards, editors.                    |

`reed` and `reedSoft` are the hairline/border/scrollbar materials between layers. True drop
shadows are reserved for genuinely floating layers (care drawer over content, menus, dialogs) and
for the hero mark's warm glow. A soft inset vignette around the viewport keeps the whole app
feeling like water in a basin rather than panels on a page.

### Atmosphere rules

Atmosphere is real but rationed:

- The **caustic drift layers** and the **sumi-e koi watermark** sit behind everything at the
  backdrop level, at whisper opacity. They may never be raised, tinted brighter, or placed inside
  a panel.
- Panels are opaque. A long-scrolling reading surface (message list, log, form) must fully cover
  the atmosphere behind it. Blur-backed translucency is allowed only for thin sticky chrome
  (banners, headers) — never behind body text.
- Motifs (lotus divider, koi mark, ripple rings) appear at moments — home, empty states, section
  seams — not as repeating wallpaper.

### The homepage hero — DeKoi's living mark

The home hero is the emotional signature of the product and is protected: the central logo with
koi swimming in slow orbits around it, concentric still rings, periodic ripple pings, and a soft
pond-glow behind it, with the serif "DeKoi" wordmark beneath. Rules:

- The living mark appears **once**, on the Pond home. It is not a loading spinner, not a button,
  not a repeated decoration, and it never shrinks into chrome. The static `koi-mark.svg` and
  `logo.png` carry identity everywhere else.
- Orbits stay slow (tens of seconds), koi stay few (roughly three to six across two or three
  orbit radii, in koi/jade/amber), and the composition stays legible at a glance: rings, fish,
  mark, name.
- Refinement is welcome — better fish drawing, subtler wakes, more graceful ring spacing, gentler
  glow — but the _idea_ (logo at the center of a live pond) is settled. Do not replace it with a
  static lockup, a video, or a mascot illustration.
- Under reduced motion the hero becomes a still pond: koi freeze into a composed arrangement on
  their rings, pings stop, and the mark and wordmark remain. The still composition should be
  designed, not merely paused.

### Handmade and alive, without losing clarity

The craft shows in small, consistent decisions rather than ornament: generous radii on touchable
things, ink-dark text on warm accent fills, the serif face at thresholds, brush-drawn motifs used
sparingly, motion that behaves like water (drift, ripple, glide — never bounce, spin, or flash).
Every atmospheric choice must pass one test: _does long-session reading and real work get easier
or harder?_ If harder, the atmosphere loses.

---

## 4. Color System

All colors are named tokens. Hex values are canonical here and in `DESIGN.json`; CSS custom
properties in `src/shared/ui/pond-tokens.css` must match.

### Water and surface tokens

| Token      | Hex       | Role                                                             |
| ---------- | --------- | ---------------------------------------------------------------- |
| `abyss`    | `#091317` | App backdrop; deepest layer; backdrop gradients resolve into it. |
| `water`    | `#0e1b21` | Shell chrome regions (waterline, bank, tide).                    |
| `shallow`  | `#13242b` | Secondary panels and headers.                                    |
| `raise`    | `#172d35` | Primary work surfaces, cards, editors.                           |
| `reed`     | `#233b44` | Strong borders, scrollbar thumbs, control outlines.              |
| `reedSoft` | `#1b313a` | Quiet hairlines and section seams.                               |

### Accent tokens

| Token      | Hex       | Role                                                                                                                                                                                |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `koi`      | `#f47a35` | **Primary action and identity warmth.** The main CTA fill, the current creative state, character-side identity tinting, the brand's temperature.                                    |
| `koiHot`   | `#ff9a4d` | Koi hover/active and gradient high end.                                                                                                                                             |
| `koiDeep`  | `#d85f23` | Koi pressed state and gradient low end.                                                                                                                                             |
| `jade`     | `#27b3aa` | **Runtime health and calm support.** Connected providers, healthy storage, focus outlines, secondary living motion (inner-orbit koi), persona/user-side tinting, presence.          |
| `jadeHot`  | `#3ad0c6` | Jade hover/active.                                                                                                                                                                  |
| `amber`    | `#e3a534` | **Warmth-with-attention.** Warnings, recency markers, unsaved/pending nudges, story warmth, temporary attention. Amber states should resolve — they are not a permanent decoration. |
| `amberHot` | `#f3bd55` | Amber hover/active.                                                                                                                                                                 |

### Foreground tokens

| Token     | Hex       | Role                                                                                                                                               |
| --------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foam`    | `#e9f1f2` | Primary readable text and strong icons.                                                                                                            |
| `mist`    | `#86a0a8` | Secondary text and informative metadata (timestamps, hints, counts).                                                                               |
| `mistDim` | `#5c7882` | Tertiary, _non-essential_ metadata and disabled text only — it sits near 3:1 on `raise` and must never carry information that exists nowhere else. |
| `belly`   | `#f5ece1` | Warm paper highlight: koi belly in artwork, rare warm emphasis on dark art surfaces. Not a general text color.                                     |
| `ink`     | `#0c1216` | Text and glyphs **on** koi/jade/amber fills. Foam on accent fills fails contrast; ink passes.                                                      |

### Where accent color is forbidden

- **Koi never floods a panel.** No koi-tinted backgrounds larger than a control; no orange
  washes, page tints, or koi wallpaper. Koi is a fish in the water, not the water.
- **Jade and amber are semantic, not decorative.** Jade means healthy/supportive/yours; amber
  means warm attention. Neither appears as random garnish, chart candy, or alternating list
  stripes.
- **Accent-on-accent is banned.** Never set koi text on jade fills or similar; accents meet only
  through `ink` or the dark waters.
- **One warm gradient family.** Gradient fills are limited to the koi ramp on primary CTAs (and
  the jade ramp for Roleplay's equivalent). No gradient text outside the hero wordmark, no
  multi-hue gradients.
- The user-selectable accent (koi/jade/amber via `data-accent`) remaps _interactive_ accent roles
  only; semantic meanings (jade = health, amber = warning) keep their own tokens regardless.

Ad-hoc colors are a defect. The one known stray — a green presence dot — should be re-cut to jade
during token sync (Stage 1). New hues require a new named token and a role written here first.

---

## 5. Typography

| Role    | Stack                                           | Token     |
| ------- | ----------------------------------------------- | --------- |
| Display | `"Shippori Mincho", "Songti SC", serif`         | `display` |
| UI      | `"Inter", system-ui, -apple-system, sans-serif` | `ui`      |

The display serif is **identity at thresholds**: the hero wordmark, top-level surface titles,
empty-state headings, and Roleplay scene headers. It never sets body copy, form labels, buttons,
metadata, or anything a user reads at length. Inter carries all dense work.

Scale (at default `--font-scale: 1`; the whole scale multiplies by the user's font-scale setting):

| Step        | Size / line    | Use                                                                |
| ----------- | -------------- | ------------------------------------------------------------------ |
| `displayXl` | 36px / 1.15    | Hero wordmark only.                                                |
| `displayLg` | 24px / 1.2     | Surface titles, scene headers.                                     |
| `title`     | 18px / 1.3     | Panel and dialog titles.                                           |
| `heading`   | 15px / 1.35    | Section headings, card titles.                                     |
| `body`      | 14px / 1.5     | Default UI text, forms, catalogs.                                  |
| `message`   | 14px / 1.5–1.6 | Message body text (1.5 Messenger, 1.6 Roleplay).                   |
| `meta`      | 11.5px / 1.35  | Timestamps, counts, hints, badges.                                 |
| `caption`   | 10.5px / 1.3   | Smallest legal text: role chips, date separators. Nothing smaller. |

Guidance by surface:

- **Long message text**: `message` size minimum; measure 60–75ch; never justify; paragraph
  spacing over indent. Message text may not drop below 13px at default scale.
- **Catalogs**: `body` for names, `meta` for counts/kinds; truncate names with ellipsis + full
  value on focus/hover, never wrap card grids into ragged heights for metadata.
- **Settings and provider forms**: `body` labels above inputs, `meta` help text below; no
  placeholder-as-label; monospace only for keys, URLs, and file paths (system mono stack).
- **Storage logs**: `body` size in a readable table/rows — logs are read under stress; do not
  shrink them to look "technical."
- **Compact metadata**: `meta`/`caption` in `mist`; if a piece of metadata is load-bearing (an
  error time, a save destination), it earns `body` and `foam`.

---

## 6. Motion

Motion in DeKoi behaves like water: it drifts, ripples, and glides. It never bounces, spins,
flashes, or zooms. Three registers:

### Motion tokens

| Token                                     | Value                                   | Register                                             |
| ----------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `instant`                                 | 80ms                                    | Press feedback, toggle flips.                        |
| `quick`                                   | 140ms                                   | Hover reveals, action-row fades, chip state.         |
| `settle`                                  | 220ms                                   | Panel content swaps, notice enter/leave.             |
| `glide`                                   | 340ms, `cubic-bezier(0.3, 0.8, 0.3, 1)` | Shell layout: drawer open/close, shoal collapse.     |
| `ripple`                                  | 4.5s ease-out loop                      | Hero ripple pings; single-shot ripple confirmations. |
| `orbitInner` / `orbitOuter` / `orbitWide` | 18s / 26s / 34s linear                  | Hero koi orbits.                                     |
| `tail`                                    | 0.7s ease-in-out loop                   | Koi tail wiggle within the hero.                     |
| `driftA` / `driftB`                       | 26s / 38s alternate                     | Backdrop caustic drift.                              |

### Registers

- **Ambient** (orbits, tails, ripple pings, caustic drift): allowed only in open water — the
  backdrop, the Pond home hero, and designed empty states. Never inside message lists, forms,
  catalogs, logs, or any surface with body text. Ambient motion is slow (≥ 4s cycles) and low
  contrast.
- **Responsive** (`instant`–`glide`): every interactive element gives feedback within 140ms.
  Layout moves use `glide` so panels feel like they slide through water, not snap.
- **Celebratory** (rare): a single non-looping ripple ring may confirm a meaningful save,
  import, or first-thread moment — one shot, ≤ 1.2s, at the point of action. Never confetti,
  never repeated for routine acts, never blocking.

### Where specific motions are allowed

- **Koi swim** only in the hero and, optionally, one designed empty state. Koi never swim across
  working surfaces or behind text.
- **Ripples** may ping in the hero and fire once as a save/import confirmation near the control.
- **Caustics** exist only as the two fixed backdrop layers.
- **Hover motion** is limited to opacity/fade, ≤ 3px translate, and border/color shifts — no
  scale pops on rows or messages.

### Reduced motion

`data-motion="reduced"`/`"off"` and `prefers-reduced-motion` all force the same contract:

- Orbits, tails, pings, caustic drift, and celebratory ripples **stop**. The hero renders its
  designed still composition (koi placed on rings, mark and wordmark intact).
- Transitions collapse to near-zero duration; nothing relies on animation to convey state —
  every animated cue has a static text/icon/color equivalent that remains.
- Hover reveals become instant show/hide. Layout changes still happen, without the glide.

---

## 7. Layout and Surfaces

### Shell regions

The shell is a fixed grid of named water regions:

| Region        | Concept         | Material          | Notes                                                                                                                                                                                                        |
| ------------- | --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Waterline** | Top bar         | `water`           | Thin (≈38px): app identity, global search/actions, window controls. Never grows into a toolbar junk drawer.                                                                                                  |
| **Bank**      | Navigation rail | `water`           | Narrow icon rail (≈56px): the places (Pond home, Companions, Personas, Lorebooks, Presets, Agents, Connections, Media). Labels on tooltip/expansion; active place marked by accent + shape, not color alone. |
| **Shoal**     | Thread list     | `shallow`         | 264–300px: saved Messenger/Roleplay threads with kind, title, recency. Collapsible; collapsed state leaves a reopen affordance in the bank/pond.                                                             |
| **Pond**      | Main surface    | `raise`           | Everything primary: home, threads, catalogs, editors. Home content is center-column (≈920px max); threads manage their own text measure.                                                                     |
| **Tide**      | Status strip    | `water`           | Bottom (≈46px): runtime/provider health, storage/save state, quiet background-activity notices. The honest strip — always current, never nagging.                                                            |
| **Care**      | Settings drawer | `shallow`/`raise` | Right drawer (clamp 360px–430px), glides over the pond: Pond Care sections (General, Appearance, Behavior, Generation, Data & Backup). Floating layer — this is where a real drop shadow belongs.            |

The **Ripple Dock** (per-thread state panel) docks inside the pond region alongside a thread, as a
`shallow` sibling panel — not a second care drawer.

### Responsive behavior

- **≥ 1280px**: full grid; care drawer can stay docked open.
- **960–1280px**: care becomes an overlay with scrim; shoal remains but collapses willingly.
- **720–960px**: shoal becomes an overlay from the left; pond takes the full width between
  waterline and tide.
- **< 720px (touch-first)**: bank condenses to essential places (home, Messenger, Roleplay,
  care); one panel at a time; composer and message actions sized for thumbs; tide collapses to a
  status dot + sheet.

### Density

Comfortable is the default; a compact setting tightens padding on care/settings surfaces. Per
surface:

- **Catalogs** (Companions, Personas, Lorebooks, Presets, Agents, Media): scannable card grids or
  rows, one line of name + one line of metadata; comfortable spacing — catalogs are browsing
  surfaces, not spreadsheets.
- **Settings / Pond Care**: single-column labeled fields, grouped in bordered sections with plain
  headings; generous by default, honest compact mode.
- **Provider forms (Connections)**: the densest allowed form surface, but every field keeps a visible
  label, inline validation, and a plain-language description. Secrets are write-only with
  save/check/clear affordances; never echo secret values.
- **Storage logs / Data & Backup**: table-like rows at `body` size with status chips; repair and
  reload actions adjacent to the rows they affect; destructive actions confirmed inline, not in a
  modal maze.
- **Messenger**: compact message rows (dense but breathing — small gaps, grouped turns).
- **Roleplay**: roomier vertical rhythm; bubbles and scene elements get air; still one calm
  center column.

---

## 8. Conversation Surfaces

Messenger and Roleplay are the two main rooms of the product. They share plumbing, status
language, and the composer; they differ deliberately in staging.

### Messenger — the quick surface

**Feel:** familiar, fast, plain-ish, message-first. A private DM app that happens to live in a
pond. It may carry a faint broad DM-app rhythm — compact grouped turns, hover actions, a clean
left gutter — but it is not a Discord clone: no server/channel metaphors, no Discord layout,
iconography, spacing signature, or interaction copy.

- **Layout:** left-gutter rows — avatar column (≈40px) + content column; sender name, role chip,
  and timestamp on the first row of a group; consecutive messages from the same sender within a
  short window group under one header with a hover timestamp.
- **Containers:** no ornate bubbles. Rows sit directly on the `raise` surface with a subtle
  full-row hover/focus tint. Restraint is the aesthetic.
- **Text:** `message` size, 1.5 line height, 60–75ch measure, foam on raise. Nothing renders
  behind the text.
- **Identity:** avatars are small and functional (round, hairline ring — koi-tinted for
  companions, jade-tinted for the user's persona). Names are plain `foam` bold; role chips are
  `caption` outline pills.
- **Actions:** copy, edit, retry/regenerate, delete revealed on hover/focus (always visible on
  touch), as a quiet pill row. Delete confirms inline within the row.
- **Metadata:** timestamps and date separators in `mist`/`mistDim`; deeper per-turn detail
  (model, token counts, generation info) lives behind a disclosure, not printed on every turn.
- **States:** user vs companion distinguished by avatar tint + name (never by mirroring the
  layout); pending turns show a quiet jade shimmer-dot row; errors are an amber/koi-bordered
  inline notice on the failed turn with retry adjacent; system notices are centered `meta` pills.
- **Provider/runtime/save state:** visible in the tide strip and the thread header dot, worded
  plainly ("Saved to desktop", "Generating…", "Connection disconnected") — status without plumbing.
- **Avoid:** decorative bubbles, mood art behind text, novelty layouts, per-message gradients,
  and anything that slows scanning a 500-turn thread.

### Roleplay — the staged surface

**Feel:** a scene being kept. More characterful, warmer, more composed than Messenger — adjacent
to visual-novel staging without becoming a game UI. Reading a long scene should feel like reading
a well-typeset script.

- **Layout:** a centered scene column (max ≈680px text measure) with avatars staged at the outer
  edges — cast on the left, the user's persona on the right. A scene header (display serif title,
  cast strip, scene status) can open the thread.
- **Bubbles:** real containers — `raise`-on-`raise` cards with a hairline border tinted by
  speaker kind (koi-family for companions, jade-family for personas), soft `sm` radius, roomy
  padding. Shaped, layered, but calm: one border, one background, no glows or tails.
- **Speaker identity:** more visible than Messenger — larger avatars (≈36–44px), name +
  role/presence on a speaker line above the bubble; an optional cast strip in the scene header
  showing who is present. Identity accents live in borders, rings, and chips — never as bubble
  background floods.
- **Narration and action:** narration/action beats render distinct from dialogue — no avatar,
  italic or serif-inflected `message` text, jade-tinted hairline or inset left rule, slightly
  inset column. Spoken dialogue stays upright in bubbles.
- **Out-of-character notes:** visibly stepped out of the scene — a plain `shallow` row with an
  "OOC" caption chip, sans-serif, no theatrical styling.
- **System/runtime notices:** the same quiet notice language as Messenger (amber = warning, koi
  = error), full-width above the entries — the scene does not restyle infrastructure.
- **Continuity / Ripple updates:** compact jade-accented seam markers in the scene flow ("ripple"
  chips summarizing what shifted), expandable, with full state in the Ripple Dock. They read as
  gentle rings on the water, not as game HUD.
- **Controls:** edit, retry, branch, and delete stay on the same hover/focus pill pattern as
  Messenger, anchored to the speaker line — atmosphere never buries the tools. Save state stays
  visible in tide + header.
- **Avoid:** narrowing the text column for staging, busy bubble chrome, background scene art
  behind text, per-character color floods, and any styling that makes a 3-hour session tiring.

### Shared conversation rules

- **Status without plumbing:** generation state, active Connection/runtime, save state, and errors are
  always discoverable (tide + thread header) and worded in product language, not transport
  language. Errors say what happened and what to do next.
- **Errors:** inline, adjacent to the failed turn, dismissible where safe, `role="alert"`;
  informational status uses `role="status"`.
- **Input:** both use the shared composer — auto-growing textarea on `shallow`, koi (Messenger)
  or jade (Roleplay) submit, visible hint line, disabled states explained.
- **Access:** full keyboard traversal including message actions; touch targets ≥ 40px on coarse
  pointers; visible focus everywhere; reduced motion honored; state never conveyed by color
  alone (icon/text always accompanies).
- **Long sessions:** opaque calm backgrounds, stable line lengths, no flicker on
  stream/generation updates, scroll position respected on regenerate.
- **Atmosphere boundary:** pond life surrounds the conversation (backdrop, seams, empty states)
  and never sits behind message text.
- **Legacy boundary:** neither surface copies prior-project message layouts, prompt labels, mode
  chrome, or UI copy. Requirements are written in DeKoi terms first, then styled from this
  document.

---

## 9. Component Guidance

- **Buttons.** Primary: koi gradient fill (`koiHot → koiDeep`), `ink` text, `md` radius, ≥ 36px
  tall (40px touch). Roleplay-primary may use the jade ramp. Secondary: `raise` fill, `reed`
  border, `foam` text. Quiet/tertiary: borderless mist text that gains a jade tint on hover. One
  primary button per view region.
- **Icon buttons.** Round or pill, hairline border, transparent-to-dark fill; hover/focus shifts
  to a jade-tinted border + tint. Minimum hit area 24×24px with spacing (40px on touch), always
  with an accessible name.
- **Inputs / textareas.** Dark wells (`abyss`-tinted on `raise`), `sm`–`md` radius, hairline
  border; focus = jade border + soft 1px jade ring. Labels above, help/error text below (error in
  amber/koi with an icon). Textareas auto-grow to a max, then scroll.
- **Panels / drawers.** Opaque materials per the shell table; drawers glide (340ms) and cast the
  app's one real shadow; every drawer/dialog has a labeled close affordance and traps focus while
  open.
- **Cards / list rows.** `raise` on `shallow` (or hairline-separated rows), `md` radius for
  cards; hover = border lighten + slight lift in tint, not scale. One-line name + one-line meta;
  whole row clickable with a distinct affordance for secondary actions.
- **Chips / segments.** Pill outlines in `caption`/`meta`; selected state = accent border + tint
  fill + `foam` text plus a non-color cue (dot/check). Segmented controls are chips in a
  hairline-bordered track.
- **Navigation (bank/waterline).** Active place: accent tint + edge marker + label; inactive:
  mist icons. Never rely on tint alone.
- **Status indicators.** Dot + label pattern: jade = healthy/connected/saved, amber =
  pending/attention/unsaved, koi = error/blocked, mist = idle/off. Dots never appear without an
  accessible text equivalent.
- **Messenger message rows.** Per §8: gutter rows, grouping, hover-tint, quiet pill actions,
  inline delete confirm.
- **Roleplay bubbles & speaker cards.** Per §8: bordered bubbles keyed to speaker kind, speaker
  line above, staged avatars, narration/OOC/ripple variants.
- **Avatars.** Round, object-fit cover, hairline identity ring (koi = companion, jade = persona);
  monogram fallback on tinted well. Decorative next to a visible name → empty alt; otherwise the
  accessible name is the display name. Presence badges pair with text somewhere reachable.
- **Timestamps & metadata.** `meta` in `mist`; relative time with absolute on hover/focus; date
  separators as centered `caption` pills on hairlines. `mistDim` only for redundant metadata.
- **Pending / generated / error states.** Pending: jade dot-shimmer + "Generating…" text, layout
  space reserved to avoid jump. Generated content is visually ordinary once complete; per-turn
  provenance lives in the disclosure, not a permanent badge. Errors: bordered inline notice
  (amber = recoverable warning, koi = failure) with one clear next action.
- **Import / export / storage / provider surfaces.** Explicit multi-step honesty: preview before
  replace, automatic pre-import backup stated in the UI, progress + result rows, destructive
  actions in koi requiring typed/inline confirm. Paths and keys in monospace; secrets write-only.
  These screens follow the same tokens and radii as everything else — no "engineering mode"
  styling.

---

## 10. Signature Motifs and Assets

| Asset                         | Purpose                                                                 | Allowed use                                                            | Overuse danger                                                                                    | Motion / a11y                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/logo.png`                   | The lantern-koi core mark.                                              | Center of the hero's living mark; app icon contexts.                   | Repeating it in chrome dilutes the hero moment — the wordmark or `koi-mark.svg` serves elsewhere. | Static image; hero glow via shadow only; `alt=""` inside the decorative hero (the adjacent wordmark names the app). |
| `/koi-mark.svg`               | Line-drawn koi glyph for small identity.                                | Favicons-adjacent chrome, waterline identity, about/empty accents.     | Becoming a bullet point or list decoration.                                                       | Static; `aria-hidden` when adjacent to the app name.                                                                |
| `/koi-bg.svg`                 | Sumi-e koi watermark.                                                   | Fixed full-viewport backdrop at ≤ 0.05 opacity, once.                  | Any second placement, any opacity raise, any use inside panels.                                   | Static by definition; must remain invisible under text surfaces (which are opaque anyway).                          |
| `/lotus-divider.svg`          | Lotus seam ornament.                                                    | Section seams on home and designed empty states; at most one per view. | Wallpapering every section break — it marks thresholds, not paragraphs.                           | Static; `alt=""`/`aria-hidden`.                                                                                     |
| `KoiSprite` (inline SVG defs) | Shared koi/fish symbols for the living mark.                            | Referenced via `<use>` by hero and designed empty states.              | Scattering swimming koi across working surfaces.                                                  | Tail animation obeys reduced motion (freezes).                                                                      |
| `PondEye` (hero composition)  | **The signature living mark**: logo, rings, ripple pings, orbiting koi. | Pond home hero only.                                                   | Reuse as spinner/loader/button — forbidden; miniaturization into chrome — forbidden.              | Full reduced-motion still composition (§6); `aria-hidden` art with the heading carrying the name.                   |
| Caustics (CSS layers)         | Ambient light texture in the deep water.                                | Two fixed backdrop layers at ≤ 0.5 opacity.                            | Adding layers, raising opacity, or placing inside panels.                                         | Drift stops entirely under reduced motion / motion=off.                                                             |

The living mark is an emotional identity moment — the one place DeKoi openly performs. Guard it
by keeping it singular: because koi _don't_ swim everywhere else, the pond feels alive where it
matters.

---

## 11. Naming and Voice

- **Owned labels** come from `DOMAIN_MODEL.md` and are used consistently: Messenger, Roleplay,
  Pond, Companions, Personas, Lorebooks, Presets, Ripples / Ripple Dock, Agents, Connections, Media,
  and the Pond Care sections (General, Appearance, Behavior, Generation, Data & Backup).
- **Clarity beats cuteness.** Theme words name _places and records_; verbs stay plain. "New
  thread", "Save", "Import bundle", "Check connection" — never "release a koi" for a save button.
- **Voice:** calm, direct, first-person-free, lightly atmospheric only at thresholds (home
  greeting, empty states). Status and errors are concrete: what happened, where things stand,
  what to do next. No blame, no jokes in error states, no exclamation points doing the work of
  design.
- **Messenger** uses plain utilitarian labels throughout ("Copy", "Retry", "Edit", "Delete").
- **Roleplay** may use scene-aware labels where they clarify ("Set the scene", "Continue scene",
  "Branch from here"), but primary actions remain instantly legible — a first-time user must
  never have to decode theme language to act.
- Legacy/prior-project mode names, prompt labels, and interaction copy are never reused; UI text
  is written from DeKoi requirements.

---

## 12. Accessibility

- **Contrast:** body text ≥ 4.5:1 (foam/raise ≈ 12:1; mist/raise ≈ 5:1 — both pass). `mistDim`
  (≈ 3:1 on raise) is restricted to decorative/redundant text. Text on accent fills uses `ink`
  (≥ 7:1 on koi). Essential icons ≥ 3:1.
- **Focus:** every interactive element shows a 2px accent outline at 2px offset
  (`:focus-visible`); focus is never removed, only styled; drawers/dialogs trap and restore it.
- **Keyboard:** full traversal of shell, threads, and message/entry actions; hover-revealed
  actions are focus-revealed too; composer submit and escape behaviors documented in the hint
  line.
- **Touch:** ≥ 40px targets on coarse pointers; hover-only affordances become always-visible;
  swipe/scroll never fights the message list.
- **Non-color state:** every state (active, saved, pending, error, presence) pairs color with an
  icon, label, or shape.
- **Reduced motion:** honored via both system preference and the in-app motion setting; see §6
  for the exact freeze contract.
- **Long sessions:** opaque reading surfaces, user font scaling (`--font-scale`) respected by
  the whole scale, stable measures, no flashing or shimmer beyond the quiet pending cue.
- **Dense-text guardrails:** nothing below 10.5px; logs and forms at `body` size; compact
  density tightens spacing, never type size.
- **Message readability:** measure, line-height, and grouping rules of §8 are accessibility
  requirements, not aesthetics.
- **Avatars & names:** semantic name adjacency (§9); presence conveyed in text, not dot-only.
- **Status & errors:** `role="status"` for progress, `role="alert"` for failures; errors keep a
  visible next action; toasts never carry information that vanishes.

---

## 13. Do / Don't

**Do**

- Do keep Messenger fast, familiar, and restrained — rows, not costumes.
- Do let Roleplay carry more character identity and staging — bubbles, speaker lines, scene
  headers, ripple seams.
- Do preserve the orbiting-koi hero as the singular living mark, with a designed reduced-motion
  still.
- Do keep dense text on calm, opaque surfaces; put atmosphere in the water around them.
- Do make provider, runtime, and save state visible in tide/header language without exposing
  machinery.
- Do use the material stack (abyss → water → shallow → raise) for depth instead of shadows and
  blur.
- Do give Connections and Data & Backup the same craft as the hero — kept tools, not a
  basement.
- Do pair every color-coded state with an icon or label.

**Don't**

- Don't turn Messenger into a Discord clone — no server/channel metaphors, cloned spacing,
  iconography, or copy.
- Don't make Roleplay so theatrical that a long scene is hard to read — the text column stays
  generous, calm, and skimmable.
- Don't put animated water, swimming koi, or ornamental texture behind long text — ever.
- Don't use koi orange as panel wallpaper, page tint, or large background fills.
- Don't copy prior-project mode chrome, prompt wording, schemas, or layouts.
- Don't miniaturize or repurpose the living mark as a spinner, button, or repeated ornament.
- Don't add unnamed hex values, new hues, or accent-on-accent pairings.
- Don't hide errors in toasts or bury retry behind menus — failures live inline with their turn.
- Don't let compact density shrink type below the scale minimums.
- Don't ship hover-only affordances without focus and touch equivalents.

---

## 14. Implementation Plan (staged, not for this change)

1. **Stage 1 — Token & doc sync.** Align `pond-tokens.css` with §4–§6: add `ink`, motion and
   opacity tokens, type scale variables; re-cut the stray presence green to jade; verify
   `DESIGN.json` values match CSS one-to-one.
2. **Stage 2 — Hero & shell consistency.** Refine the living mark (ring spacing, koi drawing,
   wake subtlety, designed reduced-motion still); normalize waterline/bank/shoal/tide materials
   and borders to the material stack; give the care drawer its floating shadow + scrim overlay
   behavior at narrow widths.
3. **Stage 3 — Conversation differentiation.** Implement Messenger grouping/gutter rhythm and
   quiet action pills; implement Roleplay scene header, speaker lines, narration/OOC/ripple-seam
   variants, staged avatars; raise message body type to the §5 scale; unify pending/error turn
   treatments.
4. **Stage 4 — Catalog, settings, storage, provider polish.** Apply density rules to Companions/
   Personas/Lorebooks/Presets/Agents/Media catalogs; rebuild Connections forms to labeled-field
   standards with secret-safe affordances; bring Data & Backup logs to readable-row +
   inline-action standards with honest destructive confirms.
5. **Stage 5 — Accessibility & motion audit.** Contrast pass on every token pairing in use;
   keyboard walk of shell + both thread surfaces; touch-target audit at coarse pointer; reduced-
   motion visual QA of hero, caustics, and celebratory ripples; screen-reader pass on status,
   alerts, avatars, and the living mark.
