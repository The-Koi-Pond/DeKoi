export type RippleTone = "note" | "shift" | "meter";
export type RippleStateOwnerKind = "mode-branch";

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
