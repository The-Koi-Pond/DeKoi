export type MacroVariableScopeOwnerKind = "mode-branch" | "global";

export interface MacroVariableScope {
  id: string;
  schemaVersion: 1;
  ownerKind: MacroVariableScopeOwnerKind;
  ownerId: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
