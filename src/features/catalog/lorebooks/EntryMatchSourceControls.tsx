import { Switch } from "../../../shared/ui/primitives/Switch";
import type { LorebookEntryDraft } from "./lorebook-entry-draft";

const MATCH_SOURCE_OPTIONS: {
  key: keyof LorebookEntryDraft["matchSources"];
  label: string;
}[] = [
  { key: "characterDescription", label: "Character description" },
  { key: "characterPersonality", label: "Character personality" },
  { key: "scenario", label: "Scenario" },
  { key: "characterNote", label: "Character note" },
  { key: "personaDescription", label: "Persona description" },
];

interface EntryMatchSourceControlsProps {
  draft: LorebookEntryDraft;
  onDraftChange: (draft: LorebookEntryDraft) => void;
}

export function EntryMatchSourceControls({ draft, onDraftChange }: EntryMatchSourceControlsProps) {
  return (
    <details className="catalog-editor-section">
      <summary>Additional matching sources</summary>
      <p className="catalog-field-hint">
        Name matching follows the lorebook Include names setting.
      </p>
      {MATCH_SOURCE_OPTIONS.map((option) => (
        <div className="catalog-editor-field catalog-editor-toggle" key={option.key}>
          <span className="catalog-toggle-label">{option.label}</span>
          <Switch
            checked={draft.matchSources[option.key]}
            onChange={(checked) =>
              onDraftChange({
                ...draft,
                matchSources: {
                  ...draft.matchSources,
                  [option.key]: checked,
                },
              })
            }
            ariaLabel={option.label}
          />
        </div>
      ))}
    </details>
  );
}
