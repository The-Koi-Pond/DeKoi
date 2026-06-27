---
name: "DeKoi"
description: "A private-first character story engine with a dark pond shell, tactile controls, and intimate creative surfaces."
colors:
  abyss: "#091317"
  water: "#0e1b21"
  shallow: "#13242b"
  raise: "#172d35"
  reed: "#233b44"
  reed-soft: "#1b313a"
  koi: "#f47a35"
  koi-hot: "#ff9a4d"
  koi-deep: "#d85f23"
  jade: "#27b3aa"
  jade-hot: "#3ad0c6"
  amber: "#e3a534"
  amber-hot: "#f3bd55"
  foam: "#e9f1f2"
  mist: "#86a0a8"
  mist-dim: "#5c7882"
  belly: "#f5ece1"
typography:
  display:
    fontFamily: "Shippori Mincho, Songti SC, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  headline:
    fontFamily: "Shippori Mincho, Songti SC, serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
rounded:
  sm: "10px"
  md: "14px"
  lg: "22px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.koi}"
    textColor: "#1a0d05"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  panel-raised:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.foam}"
    rounded: "{rounded.md}"
    padding: "16px"
  input-pond:
    backgroundColor: "{colors.water}"
    textColor: "{colors.foam}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  shell-rail:
    backgroundColor: "{colors.abyss}"
    textColor: "{colors.mist}"
    rounded: "{rounded.sm}"
    padding: "8px"
---

# Design System: DeKoi

## 1. Overview

**Creative North Star: "Private Pond Studio"**

DeKoi should feel like a small creative engine built beside dark water: calm,
owned, touchable, and a little atmospheric without becoming decorative noise.
The app is a product surface first. Design serves repeat creative work:
creating companions, starting Messenger or Roleplay threads, saving local
records, and configuring provider connections without exposing implementation
complexity.

The system rejects sterile SaaS dashboards, generic Discord-like chat chrome,
and compatibility-clone styling. Dense settings and catalog surfaces may be
compact, but they should still feel like part of the same pond shell.

**Key Characteristics:**

- Dark teal pond shell with koi-orange action, jade status, amber warmth, and
  foam text.
- Compact controls with visible focus, readable labels, and no hover-only
  essentials.
- Messenger and Roleplay share the product frame but can carry distinct mood,
  pacing, and composition.
- Local-first storage and provider controls should feel calm and trustworthy,
  not like developer plumbing.

## 2. Colors

The palette is a dark pond system: abyss background, layered teal water
surfaces, warm koi action, jade support accents, amber warmth, foam foreground,
and mist metadata.

### Primary

- **Koi** (`#f47a35`): Primary actions, active icons, selected navigation, and
  compact confirmation controls.
- **Koi Hot** (`#ff9a4d`): Hover, focus, active press, and small emphasis
  moments.
- **Koi Deep** (`#d85f23`): Pressed states and deeper action gradients.

### Secondary

- **Jade** (`#27b3aa`): Runtime health, support accents, secondary orbit art,
  and calm positive state.
- **Amber** (`#e3a534`): Warm warnings, recent activity, and story-adjacent
  highlights.

### Neutral

- **Abyss** (`#091317`): App background and persistent shell.
- **Water** (`#0e1b21`): Main panel and low elevation surface.
- **Shallow** (`#13242b`): Slightly raised surface.
- **Raise** (`#172d35`): Cards, drawers, and elevated controls.
- **Reed** (`#233b44`) and **Reed Soft** (`#1b313a`): Borders, dividers, and
  quiet control fills.
- **Foam** (`#e9f1f2`): Primary text.
- **Mist** (`#86a0a8`) and **Mist Dim** (`#5c7882`): Metadata and subdued text.
- **Belly** (`#f5ece1`): Warm highlight text or rare high-contrast foreground.

### Named Rules

**The Koi Is Earned Rule.** Koi orange is for action, current state, and small
emotional emphasis. Do not flood panels with orange.

**The Pond Holds Shape Rule.** Surfaces should step from abyss to water to
shallow to raise. Avoid one-off backgrounds that break that depth ladder.

**The Accent Means State Rule.** Jade and amber must carry a clear role:
health, support, warning, recency, or mode tone. Pair color with labels, icons,
or shape.

**The Compatibility Boundary Rule.** Generic ecosystem terms are allowed when
useful, but old project names, mascots, layouts, and UI voice do not become
DeKoi's visual language.

### Signature Motifs

- **Koi Mark** (`public/koi-mark.svg`): Small two-stroke mark for identity and
  compact brand moments.
- **Lotus Divider** (`public/lotus-divider.svg`): Lightweight ornamental
  separator for calm shell surfaces.
- **Koi Pond Background** (`public/koi-bg.svg`): Sumi-e watermark for opt-in
  atmospheric surfaces only. Keep opacity low and never put it behind dense
  reading or editing text at high contrast.
- **Caustics Overlay** (`.caustics`): Ambient water texture. Respect reduced
  motion and avoid competing with primary controls.

## 3. Typography

**Display Font:** Shippori Mincho with Songti SC and serif fallbacks.
**UI Font:** Inter with system sans fallbacks.

Shippori gives the shell and hero moments a quiet storybook note. Inter carries
the product workload: forms, compact controls, catalog records, messages, and
settings.

### Hierarchy

- **Display** (700, `1.5rem`, 1.2): App hero, major drawer headings, and rare
  first-viewport moments.
- **Headline** (700, `1.25rem`, 1.25): Surface headings and section anchors.
- **Title** (700, `1rem`, 1.35): Cards, compact panels, and message author
  labels.
- **Body** (400, `0.875rem`, 1.5): Default app text and dense settings copy.
- **Label** (600, `0.8125rem`, 1.25): Buttons, chips, tabs, field labels, and
  compact status text.

### Named Rules

**The Story Font Is Selective Rule.** Shippori belongs to identity, surface
headers, and atmosphere. Do not use it for long forms, settings, logs, or dense
catalog rows.

**The Compact Is Not Cramped Rule.** Dense panels may use small type, but text
must not clip, overlap, rely on negative letter spacing, or need hover help.

## 4. Elevation

DeKoi uses tonal layering first, shadow second. The base visual depth comes from
the pond ladder: abyss, water, shallow, raise, reed.

### Shadow Vocabulary

- **Shell Shade** (`inset 0 0 200px 40px rgba(0, 0, 0, 0.45)`): App-level edge
  depth only.
- **Panel Lift** (`0 8px 24px -10px rgba(0, 0, 0, 0.7)`): Drawers, menus, and
  important hoverable surfaces.
- **Control Glow** (`0 0 12px var(--accent)`): Rare active controls and current
  state, never a default decoration.

### Named Rules

**The Reading Surface Rule.** Never put heavy blur, loud texture, or animated
water behind chat text, JSON, prompt previews, provider forms, storage logs, or
long settings copy.

**The No Nested Cards Rule.** Do not stack framed cards inside framed cards.
Use unframed groups, bands, dividers, or table/list structure instead.

## 5. Components

### Buttons

- **Shape:** Compact 10px rounded rectangles for text buttons; circular icon
  buttons for single-symbol actions.
- **Primary:** Koi background with dark warm foreground.
- **Secondary:** Water or shallow fill with reed border and foam text.
- **Focus:** Visible outline using `--accent` or jade, never color alone.

### Chips And Segments

- **Style:** Compact rounded pills or segmented controls with tonal fill and
  clear label.
- **State:** Selected states need fill, text/icon treatment, and accessible
  focus.

### Panels And Drawers

- **Shape:** 14px to 22px radius depending on scale; keep repeated cards closer
  to 10px or 14px.
- **Background:** Use water, shallow, or raise. Strong opacity for reading and
  editing.
- **Borders:** Reed or reed-soft. Avoid decorative side stripes.
- **Padding:** 12px to 24px depending on density and surface role.

### Inputs

- **Style:** Water background, reed border, 10px radius, foam text, mist
  placeholder.
- **Focus:** Accent outline and border shift.
- **Error / Disabled:** Pair color with text or icon; disabled controls remain
  readable.

### Navigation

- **Style:** Persistent rails use abyss/water, compact icons, readable labels,
  and koi active state.
- **Mobile:** Touch targets stay reachable. Do not hide primary creative actions
  behind hover or precision-only gestures.

### Messenger And Roleplay

Messenger can use familiar direct-message rhythm. Roleplay can be more staged,
with scene tone, cast context, and visual-novel influence. Both must preserve
local-first clarity: what is saved, what is generated, and which provider or
runtime is active.

## 6. Do's and Don'ts

### Do:

- **Do** use `src/shared/ui/pond-tokens.css` tokens before adding one-off
  colors.
- **Do** keep controls scannable in catalogs, settings, runtime, import/export,
  and provider flows.
- **Do** use koi, jade, and amber deliberately with labels, icons, or state
  text.
- **Do** respect reduced motion and make all primary actions available without
  hover.
- **Do** keep Messenger and Roleplay distinct through composition and state, not
  copied old mode chrome.

### Don't:

- **Don't** make DeKoi a sterile SaaS dashboard with gray card grids and generic
  enterprise spacing.
- **Don't** make it a generic Discord clone.
- **Don't** reuse prior-project mode names, mascot language, UI copy, component
  layout, or prompt voice as native DeKoi design.
- **Don't** use gradient text, decorative glassmorphism, side-stripe borders, or
  nested card shells.
- **Don't** let atmospheric koi, water, or lotus assets compete with dense text
  and controls.
