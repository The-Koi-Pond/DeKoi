/**
 * DeKoi surface/pond-mode identifiers — the single source of truth.
 *
 * Per DOMAIN_MODEL.md: the first-slice surfaces are
 * Messenger (DM-style chat) and Roleplay (visual novel). The third slot is Reserved —
 * a placeholder for a not-yet-decided surface (the mockup's amber "deep water"
 * lane). Reserved is intentionally out of scope for the first slice.
 */
export const MESSENGER = "messenger";
export const ROLEPLAY = "roleplay";
export const RESERVED = "reserved";

export type SurfaceId = typeof MESSENGER | typeof ROLEPLAY | typeof RESERVED;

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
  [MESSENGER]: { id: MESSENGER, label: "Messenger", locked: false, lockedNote: null },
  [ROLEPLAY]: { id: ROLEPLAY, label: "Roleplay", locked: false, lockedNote: null },
  [RESERVED]: {
    id: RESERVED,
    label: "Reserved",
    locked: true,
    lockedNote: "Deep water — not yet available",
  },
};
