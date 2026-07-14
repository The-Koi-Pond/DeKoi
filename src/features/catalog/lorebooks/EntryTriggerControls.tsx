import { useId } from "react";

import { Switch } from "../../../shared/ui/primitives/Switch";
import type { LoreGenerationTriggerType } from "../../../engine/contracts/types/lorebook";
import type { LorebookEntryDraft } from "./lorebook-entry-draft";
import { updateTriggerScope } from "./entry-trigger-scope";

const SUPPORTED_TRIGGER: LoreGenerationTriggerType = "normal";
const TRIGGER_LABELS: Record<LoreGenerationTriggerType, string> = {
  normal: "Ordinary send",
  continue: "Continue",
  impersonate: "Impersonate",
  swipe: "Swipe",
  regenerate: "Regenerate",
  quiet: "Quiet generation",
};

interface EntryTriggerControlsProps {
  draft: LorebookEntryDraft;
  onDraftChange: (draft: LorebookEntryDraft) => void;
}

export function EntryTriggerControls({ draft, onDraftChange }: EntryTriggerControlsProps) {
  const scopeSelectId = useId();
  const triggerTypes = draft.triggers?.types ?? [];
  const importedTypes = triggerTypes.filter((type) => type !== SUPPORTED_TRIGGER);
  const normalSelected = triggerTypes.includes(SUPPORTED_TRIGGER);

  return (
    <details className="catalog-editor-section">
      <summary>Generation triggers</summary>
      <div className="catalog-editor-field">
        <label htmlFor={scopeSelectId}>Trigger scope</label>
        <select
          id={scopeSelectId}
          className="pondinput"
          value={draft.triggers ? "restricted" : "all"}
          onChange={(event) =>
            onDraftChange(updateTriggerScope(draft, event.target.value as "all" | "restricted"))
          }
        >
          {importedTypes.length === 0 && <option value="all">No trigger restriction</option>}
          <option value="restricted">Selected generation types</option>
        </select>
      </div>
      {draft.triggers && (
        <>
          <div className="catalog-editor-field catalog-editor-toggle">
            <span className="catalog-toggle-label">Ordinary send</span>
            <Switch
              checked={normalSelected}
              disabled={normalSelected && importedTypes.length === 0}
              onChange={(checked) =>
                onDraftChange({
                  ...draft,
                  triggers: {
                    types: checked ? [...importedTypes, SUPPORTED_TRIGGER] : importedTypes,
                  },
                })
              }
              ariaLabel="Ordinary send generation trigger"
            />
          </div>
          {importedTypes.length > 0 && (
            <p className="catalog-field-hint">
              Imported constraints preserved:{" "}
              {importedTypes.map((type) => TRIGGER_LABELS[type]).join(", ")}. They become editable
              when DeKoi supports those generation actions.
            </p>
          )}
          <button
            type="button"
            className="catalog-trigger-clear"
            onClick={() => onDraftChange({ ...draft, triggers: null })}
          >
            Clear all trigger restrictions
          </button>
        </>
      )}
    </details>
  );
}
