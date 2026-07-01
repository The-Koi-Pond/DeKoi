import type { GenerationFailureRecoveryTarget } from "../../runtime";

export type GenerationNoticeAction =
  | {
      kind: "open-connection";
      label: string;
      connectionId: string | null;
    }
  | {
      kind: "create-connection";
      label: string;
    };

export function getGenerationNoticeAction(
  recoveryTarget: GenerationFailureRecoveryTarget | undefined,
  connectionId: string | null | undefined,
): GenerationNoticeAction | null {
  if (recoveryTarget === "new-connection") {
    return { kind: "create-connection", label: "Create connection" };
  }

  if (recoveryTarget === "connections") {
    return {
      kind: "open-connection",
      label: connectionId ? "Open connection" : "Open Connections",
      connectionId: connectionId ?? null,
    };
  }

  return null;
}
