import "./LorebookMultiSelect.css";

interface LorebookMultiSelectItem {
  id: string;
  title: string;
}

interface LorebookMultiSelectProps {
  emptyMessage: string;
  fieldClassName?: string;
  hintClassName?: string;
  idPrefix: string;
  label: string;
  labelClassName?: string | null;
  lorebooks: LorebookMultiSelectItem[];
  selectedLorebookIds: string[];
  onChange: (lorebookIds: string[]) => void;
}

function orderSelectedLorebookIds(
  lorebooks: readonly LorebookMultiSelectItem[],
  selectedLorebookIds: readonly string[],
) {
  const cleanSelectedIds = selectedLorebookIds.map((id) => id.trim()).filter(Boolean);
  const selectedIds = new Set(cleanSelectedIds);
  const lorebookIds = new Set(lorebooks.map((lorebook) => lorebook.id));
  const orderedIds = lorebooks
    .filter((lorebook) => selectedIds.has(lorebook.id))
    .map((lorebook) => lorebook.id);
  const unknownIds = [...new Set(cleanSelectedIds.filter((id) => !lorebookIds.has(id)))];
  return [...orderedIds, ...unknownIds];
}

function toggleLorebookId(
  lorebooks: readonly LorebookMultiSelectItem[],
  selectedLorebookIds: readonly string[],
  lorebookId: string,
) {
  const cleanSelectedIds = selectedLorebookIds.map((id) => id.trim()).filter(Boolean);
  const nextIds = cleanSelectedIds.includes(lorebookId)
    ? cleanSelectedIds.filter((currentId) => currentId !== lorebookId)
    : [...cleanSelectedIds, lorebookId];
  return orderSelectedLorebookIds(lorebooks, nextIds);
}

function removeLorebookId(
  lorebooks: readonly LorebookMultiSelectItem[],
  selectedLorebookIds: readonly string[],
  lorebookId: string,
) {
  return orderSelectedLorebookIds(
    lorebooks,
    selectedLorebookIds.filter((currentId) => currentId.trim() !== lorebookId),
  );
}

export function LorebookMultiSelect({
  emptyMessage,
  fieldClassName = "catalog-editor-field",
  hintClassName = "catalog-field-hint",
  idPrefix,
  label,
  labelClassName = "catalog-editor-label",
  lorebooks,
  selectedLorebookIds,
  onChange,
}: LorebookMultiSelectProps) {
  const orderedSelectedLorebookIds = orderSelectedLorebookIds(lorebooks, selectedLorebookIds);
  const selectedIds = new Set(orderedSelectedLorebookIds);
  const lorebookIds = new Set(lorebooks.map((lorebook) => lorebook.id));
  const missingSelectedLorebookIds = orderedSelectedLorebookIds.filter(
    (id) => !lorebookIds.has(id),
  );
  const hasVisibleRows = lorebooks.length > 0 || missingSelectedLorebookIds.length > 0;

  return (
    <div className={fieldClassName}>
      <span className={labelClassName ?? undefined}>{label}</span>
      {!hasVisibleRows ? (
        <p className={hintClassName}>{emptyMessage}</p>
      ) : (
        <div className="lorebook-multi-select-list">
          {lorebooks.map((lorebook) => {
            const selected = selectedIds.has(lorebook.id);
            const inputId = `${idPrefix}-${lorebook.id}`;

            return (
              <label
                className={`lorebook-multi-select-option${selected ? " on" : ""}`}
                htmlFor={inputId}
                key={lorebook.id}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    onChange(toggleLorebookId(lorebooks, orderedSelectedLorebookIds, lorebook.id))
                  }
                />
                <span className="lorebook-multi-select-name">{lorebook.title}</span>
              </label>
            );
          })}
          {missingSelectedLorebookIds.map((lorebookId) => (
            <div className="lorebook-multi-select-missing" key={`missing-${lorebookId}`}>
              <span className="lorebook-multi-select-name">Missing lorebook: {lorebookId}</span>
              <button
                aria-label={`Remove missing lorebook ${lorebookId}`}
                className="lorebook-multi-select-remove"
                type="button"
                onClick={() =>
                  onChange(removeLorebookId(lorebooks, orderedSelectedLorebookIds, lorebookId))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
