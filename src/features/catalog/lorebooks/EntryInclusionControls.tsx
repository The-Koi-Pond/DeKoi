import { Switch } from "../../../shared/ui/primitives/Switch";
import {
  readNonNegativeIntegerInput,
  readPercentInput,
  type LorebookEntryDraft,
} from "./lorebook-entry-draft";

interface EntryInclusionControlsProps {
  draft: LorebookEntryDraft;
  onDraftChange: (draft: LorebookEntryDraft) => void;
}

export function EntryInclusionControls({ draft, onDraftChange }: EntryInclusionControlsProps) {
  return (
    <>
      <div className="catalog-editor-field">
        <label htmlFor="lore-probability">Probability %</label>
        <input
          id="lore-probability"
          className="pondinput"
          type="number"
          min={0}
          max={100}
          step={1}
          value={draft.probability}
          onBlur={() =>
            onDraftChange({
              ...draft,
              probability: String(readPercentInput(draft.probability, 100)),
            })
          }
          onChange={(event) => onDraftChange({ ...draft, probability: event.target.value })}
        />
      </div>
      <p className="catalog-field-hint">
        Probability is checked after an inclusion group winner is chosen.
      </p>
      <div className="catalog-editor-field">
        <label htmlFor="lore-inclusion-group">Inclusion group</label>
        <input
          id="lore-inclusion-group"
          className="pondinput"
          type="text"
          value={draft.inclusionGroup}
          onChange={(event) => onDraftChange({ ...draft, inclusionGroup: event.target.value })}
          placeholder="group-a, group-b"
        />
      </div>
      {draft.inclusionGroup.trim() && (
        <>
          <div className="catalog-editor-field">
            <label htmlFor="lore-group-weight">Group weight</label>
            <input
              id="lore-group-weight"
              className="pondinput"
              type="number"
              min={0}
              step={1}
              value={draft.groupWeight}
              onBlur={() =>
                onDraftChange({
                  ...draft,
                  groupWeight: String(readNonNegativeIntegerInput(draft.groupWeight, 100)),
                })
              }
              onChange={(event) => onDraftChange({ ...draft, groupWeight: event.target.value })}
            />
          </div>
          <div className="catalog-editor-field catalog-editor-toggle">
            <span className="catalog-toggle-label">Resolve group by insertion order</span>
            <Switch
              checked={draft.prioritizeInclusion}
              onChange={(prioritizeInclusion) =>
                onDraftChange({
                  ...draft,
                  prioritizeInclusion,
                })
              }
              ariaLabel="Resolve group by insertion order"
            />
          </div>
        </>
      )}
    </>
  );
}
