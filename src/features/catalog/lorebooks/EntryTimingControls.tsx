import { DEFAULT_LORE_ENTRY_TIMING } from "../../../engine/contracts/types/lorebook";
import { NonNegativeActivationInput } from "../shared/ActivationInputs";
import { readNonNegativeIntegerInput, type LorebookEntryDraft } from "./lorebook-entry-draft";

type LoreEntryTimingDraftKey = "sticky" | "cooldown" | "delay";

const TIMING_FIELDS: {
  fallback: number;
  hint: string;
  id: string;
  key: LoreEntryTimingDraftKey;
  label: string;
}[] = [
  {
    fallback: DEFAULT_LORE_ENTRY_TIMING.sticky,
    hint: "Keeps an activated entry in context.",
    id: "lore-sticky",
    key: "sticky",
    label: "Sticky",
  },
  {
    fallback: DEFAULT_LORE_ENTRY_TIMING.cooldown,
    hint: "Blocks reactivation after it fires.",
    id: "lore-cooldown",
    key: "cooldown",
    label: "Cooldown",
  },
  {
    fallback: DEFAULT_LORE_ENTRY_TIMING.delay,
    hint: "Waits until the thread reaches this count.",
    id: "lore-delay",
    key: "delay",
    label: "Delay",
  },
];

interface EntryTimingControlsProps {
  draft: LorebookEntryDraft;
  onDraftChange: (draft: LorebookEntryDraft) => void;
}

export function EntryTimingControls({ draft, onDraftChange }: EntryTimingControlsProps) {
  return (
    <details className="catalog-editor-section">
      <summary>Timed effects</summary>
      {TIMING_FIELDS.map((field) => (
        <div className="catalog-editor-field" key={field.key}>
          <label htmlFor={field.id}>{field.label}</label>
          <NonNegativeActivationInput
            id={field.id}
            value={draft[field.key]}
            onChange={(value) =>
              onDraftChange({
                ...draft,
                [field.key]: value,
              })
            }
            fallback={field.fallback}
            onCommit={(value) =>
              onDraftChange({
                ...draft,
                [field.key]: String(value),
              })
            }
            reader={readNonNegativeIntegerInput}
          />
          <p className="catalog-field-hint">{field.hint}</p>
        </div>
      ))}
    </details>
  );
}
