import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";

export type SelectionLabelDetails = {
  missingCount: number;
  names: string[];
};

export function getCompanionLabelDetails(
  characterIds: string[],
  characterById: Map<string, CharacterRecord>,
): SelectionLabelDetails {
  return characterIds.reduce<SelectionLabelDetails>(
    (details, characterId) => {
      const name = characterById.get(characterId)?.displayName.trim() ?? "";
      if (name) {
        details.names.push(name);
      } else {
        details.missingCount += 1;
      }
      return details;
    },
    { missingCount: 0, names: [] },
  );
}

function formatSelectionLabel(
  names: string[],
  missingCount: number,
  emptyLabel: string,
  missingLabel: string,
) {
  if (missingCount > 0) {
    if (names.length === 0) return missingLabel;
    const hiddenNameCount = Math.max(names.length - 2, 0);
    return [
      names.slice(0, 2).join(" + "),
      hiddenNameCount > 0 ? `${hiddenNameCount} more` : "",
      `${missingCount} missing`,
    ]
      .filter(Boolean)
      .join(" + ");
  }

  if (names.length === 0) return emptyLabel;
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more`;
}

export function getCompanionSelectionLabel(
  characterIds: string[],
  characterById: Map<string, CharacterRecord>,
) {
  const { missingCount, names } = getCompanionLabelDetails(
    characterIds,
    characterById,
  );
  return formatSelectionLabel(
    names,
    missingCount,
    "Select companions",
    "Missing companion selection",
  );
}

export function getLorebookSelectionLabel(
  lorebookIds: string[],
  lorebooks: LorebookRecord[],
) {
  const lorebookById = new Map(
    lorebooks.map((lorebook) => [lorebook.id, lorebook.title]),
  );
  const { missingCount, names } = lorebookIds.reduce<SelectionLabelDetails>(
    (details, lorebookId) => {
      const name = lorebookById.get(lorebookId)?.trim() ?? "";
      if (name) {
        details.names.push(name);
      } else {
        details.missingCount += 1;
      }
      return details;
    },
    { missingCount: 0, names: [] },
  );

  return formatSelectionLabel(
    names,
    missingCount,
    "No lorebooks",
    "Missing lorebook selection",
  );
}
