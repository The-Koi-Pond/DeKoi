export const RIPPLES_SURFACE_LABEL = "Ripples";
export const RIPPLE_DOCK_SURFACE_LABEL = "Ripple Dock";

export type RippleTone = "note" | "shift" | "meter";
export type RippleStateOwnerKind = "messenger-thread" | "classic-thread";

export interface Ripple {
  id: string;
  tone: RippleTone;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface RippleState {
  id: string;
  schemaVersion: 1;
  ownerKind: RippleStateOwnerKind;
  ownerId: string;
  ripples: Ripple[];
  createdAt: string;
  updatedAt: string;
}
