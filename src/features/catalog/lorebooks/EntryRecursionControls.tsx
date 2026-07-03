import { Switch } from "../../../shared/ui/primitives/Switch";
import { NonNegativeActivationInput } from "../shared/ActivationInputs";
import { readNonNegativeIntegerInput, type LorebookEntryDraft } from "./lorebook-entry-draft";

interface EntryRecursionControlsProps {
  draft: LorebookEntryDraft;
  onDraftChange: (draft: LorebookEntryDraft) => void;
}

export function EntryRecursionControls({ draft, onDraftChange }: EntryRecursionControlsProps) {
  return (
    <details className="catalog-editor-section">
      <summary>Recursion</summary>
      <div className="catalog-editor-field catalog-editor-toggle">
        <span className="catalog-toggle-label">Non-recursable</span>
        <Switch
          checked={draft.nonRecursable}
          onChange={(nonRecursable) => onDraftChange({ ...draft, nonRecursable })}
          ariaLabel="Non-recursable"
        />
      </div>
      <div className="catalog-editor-field catalog-editor-toggle">
        <span className="catalog-toggle-label">Prevent further</span>
        <Switch
          checked={draft.preventFurther}
          onChange={(preventFurther) => onDraftChange({ ...draft, preventFurther })}
          ariaLabel="Prevent further"
        />
      </div>
      <div className="catalog-editor-field catalog-editor-toggle">
        <span className="catalog-toggle-label">Delay until recursion</span>
        <Switch
          checked={draft.delayUntilRecursion}
          onChange={(delayUntilRecursion) => onDraftChange({ ...draft, delayUntilRecursion })}
          ariaLabel="Delay until recursion"
        />
      </div>
      {draft.delayUntilRecursion && (
        <div className="catalog-editor-field">
          <label htmlFor="lore-recursion-level">Recursion Level</label>
          {/* Level 0 means recursive-only on the first recursion pass. */}
          <NonNegativeActivationInput
            id="lore-recursion-level"
            value={draft.recursionLevel}
            onChange={(recursionLevel) =>
              onDraftChange({
                ...draft,
                recursionLevel,
              })
            }
            fallback={0}
            onCommit={(recursionLevel) =>
              onDraftChange({
                ...draft,
                recursionLevel: String(recursionLevel),
              })
            }
            reader={readNonNegativeIntegerInput}
          />
        </div>
      )}
    </details>
  );
}
