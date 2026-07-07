export type MacroVariableScopeOwnerKind = "messenger-thread" | "roleplay-thread" | "global";

export interface MacroVariableScope {
  id: string;
  schemaVersion: 1;
  ownerKind: MacroVariableScopeOwnerKind;
  ownerId: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
