import { useId } from "react";

import type { CharacterRecord } from "../../../engine/contracts/types/character";
import { Switch } from "../../../shared/ui/primitives/Switch";
import type { LorebookEntryDraft } from "./lorebook-entry-draft";

interface EntryCharacterFilterControlsProps {
  characters: Pick<CharacterRecord, "id" | "displayName">[];
  draft: LorebookEntryDraft;
  onDraftChange: (draft: LorebookEntryDraft) => void;
}

export function EntryCharacterFilterControls({
  characters,
  draft,
  onDraftChange,
}: EntryCharacterFilterControlsProps) {
  const modeSelectId = useId();
  const selectedIds = draft.characterFilter?.characterIds ?? [];
  const availableIds = new Set(characters.map((character) => character.id));
  const unavailableIds = selectedIds.filter((id) => !availableIds.has(id));

  return (
    <details className="catalog-editor-section">
      <summary>Companion filter</summary>
      <div className="catalog-editor-field">
        <label htmlFor={modeSelectId}>Filter mode</label>
        <select
          id={modeSelectId}
          className="pondinput"
          value={draft.characterFilter?.mode ?? "none"}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              characterFilter:
                event.target.value === "none"
                  ? null
                  : {
                      mode: event.target.value as "include" | "exclude",
                      characterIds: selectedIds,
                    },
            })
          }
        >
          <option value="none">No companion restriction</option>
          <option value="include">Only selected companions</option>
          <option value="exclude">All except selected companions</option>
        </select>
      </div>
      {draft.characterFilter && (
        <>
          {characters.map((character) => {
            const checked = selectedIds.includes(character.id);
            return (
              <div className="catalog-editor-field catalog-editor-toggle" key={character.id}>
                <span className="catalog-toggle-label">{character.displayName}</span>
                <Switch
                  checked={checked}
                  onChange={(nextChecked) =>
                    onDraftChange({
                      ...draft,
                      characterFilter: {
                        ...draft.characterFilter!,
                        characterIds: nextChecked
                          ? [...selectedIds, character.id]
                          : selectedIds.filter((id) => id !== character.id),
                      },
                    })
                  }
                  ariaLabel={`Filter companion ${character.displayName}`}
                />
              </div>
            );
          })}
          {characters.length === 0 && (
            <p className="catalog-field-hint">Create a companion before adding this filter.</p>
          )}
          {selectedIds.length === 0 && characters.length > 0 && (
            <p className="catalog-field-hint">Select at least one companion.</p>
          )}
          {unavailableIds.length > 0 && (
            <p className="catalog-field-hint">
              Unavailable imported companion IDs are preserved: {unavailableIds.join(", ")}.
            </p>
          )}
        </>
      )}
    </details>
  );
}
