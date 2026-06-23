/**
 * DeKoi surface/pond-mode identifiers — the single source of truth.
 *
 * Per SURFACE_LABELS.md and DOMAIN_MODEL.md: the first-slice surfaces are
 * Bubbles (DM-style chat) and VN (visual novel). The third slot is Reserved —
 * a placeholder for a not-yet-decided surface (the mockup's amber "deep water"
 * lane). Reserved is intentionally out of scope for the first slice.
 */
export const BUBBLES = "bubbles";
export const VN = "vn";
export const RESERVED = "reserved";

export type SurfaceId = typeof BUBBLES | typeof VN | typeof RESERVED;

export interface SurfaceMeta {
  id: SurfaceId;
  /** Public label shown on chips, pools, and cards. */
  label: string;
  /** True when the surface is navigable in the first slice. */
  locked: boolean;
  /** Short status note shown when a locked surface is hovered/focused. */
  lockedNote: string | null;
}

export const SURFACES: Record<SurfaceId, SurfaceMeta> = {
  [BUBBLES]: { id: BUBBLES, label: "Bubbles", locked: false, lockedNote: null },
  [VN]: { id: VN, label: "VN", locked: true, lockedNote: "Surfacing soon" },
  [RESERVED]: {
    id: RESERVED,
    label: "Reserved",
    locked: true,
    lockedNote: "Deep water — not yet available",
  },
};

export const SURFACE_ORDER: SurfaceId[] = [BUBBLES, VN, RESERVED];

export function isLockedSurface(surface: SurfaceId): boolean {
  return SURFACES[surface].locked;
}
