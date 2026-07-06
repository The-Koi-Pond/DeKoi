import type {
  Ripple,
  RippleState,
  RippleStateOwnerKind,
  RippleTone,
} from "../contracts/types/ripples";
import { cleanText } from "../shared/text";

export interface RippleInput {
  tone?: RippleTone;
  title: string;
  body: string;
}

function cleanTone(value: RippleTone | undefined): RippleTone {
  if (value === "shift" || value === "meter") return value;
  return "note";
}

export function createRippleState({
  id,
  now,
  ownerId,
  ownerKind,
  ripples = [],
}: {
  id: string;
  now: string;
  ownerId: string;
  ownerKind: RippleStateOwnerKind;
  ripples?: Ripple[];
}): RippleState {
  return {
    id,
    schemaVersion: 1,
    ownerKind,
    ownerId,
    ripples,
    createdAt: now,
    updatedAt: now,
  };
}

export function createRippleRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: RippleInput;
  now: string;
}): Ripple {
  return {
    id,
    tone: cleanTone(input.tone),
    title: cleanText(input.title, "Untitled ripple"),
    body: cleanText(input.body),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateRippleRecord(ripple: Ripple, input: RippleInput, updatedAt: string): Ripple {
  return {
    ...ripple,
    tone: cleanTone(input.tone),
    title: cleanText(input.title, ripple.title),
    body: cleanText(input.body),
    updatedAt,
  };
}

export function deleteRippleStateForOwner(
  states: RippleState[],
  ownerKind: RippleStateOwnerKind,
  ownerId: string,
) {
  return states.filter((state) => state.ownerKind !== ownerKind || state.ownerId !== ownerId);
}
