import type { MacroContext } from "../../../engine/generation-core/macros/macro-engine";
import type { CatalogMacroPreviewContext } from "./catalogMacroText";

type CharacterMacroPreviewFields = NonNullable<MacroContext["characterFields"]>;
type PersonaMacroPreviewFields = NonNullable<MacroContext["personaFields"]>;
type CharacterMacroPreviewInput = Pick<CharacterMacroPreviewFields, "displayName"> &
  Partial<Omit<CharacterMacroPreviewFields, "displayName">>;
type PersonaMacroPreviewInput = Partial<PersonaMacroPreviewFields>;

const SELECTED_COMPANION_FALLBACK = "the selected companion";
const USER_FALLBACK = "the user";

function cleanPreviewName(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function createCharacterMacroFields(
  characterFields: CharacterMacroPreviewInput,
): CharacterMacroPreviewFields {
  return {
    displayName: characterFields.displayName,
    nickname: characterFields.nickname ?? null,
    description: characterFields.description ?? "",
    personality: characterFields.personality ?? "",
    scenario: characterFields.scenario ?? "",
    firstMessage: characterFields.firstMessage ?? "",
    exampleMessages: characterFields.exampleMessages ?? "",
    systemPrompt: characterFields.systemPrompt ?? "",
    postHistoryInstructions: characterFields.postHistoryInstructions ?? "",
    creator: characterFields.creator ?? "",
    characterVersion: characterFields.characterVersion ?? "",
    creatorNotes: characterFields.creatorNotes ?? "",
    characterNote: characterFields.characterNote ?? "",
  };
}

export function createCharacterCatalogMacroPreviewContext(
  characterInput: CharacterMacroPreviewInput,
): CatalogMacroPreviewContext {
  const characterFields = createCharacterMacroFields(characterInput);
  const characterName = characterFields.displayName.trim();
  const char = characterName || SELECTED_COMPANION_FALLBACK;

  return {
    macroContext: {
      user: USER_FALLBACK,
      char,
      characters: characterName ? [characterName] : [],
      characterFields,
      personaFields: null,
      variables: {},
    },
  };
}

export function createPersonaCatalogMacroPreviewContext(
  personaFields: PersonaMacroPreviewInput,
): CatalogMacroPreviewContext {
  const displayName = personaFields.displayName?.trim() ?? "";
  const user = cleanPreviewName(displayName, USER_FALLBACK);

  return {
    macroContext: {
      user,
      char: SELECTED_COMPANION_FALLBACK,
      characters: [],
      characterFields: null,
      personaFields: displayName ? { displayName } : null,
      variables: {},
    },
    preserveMacroNames: displayName ? [] : ["persona"],
  };
}
