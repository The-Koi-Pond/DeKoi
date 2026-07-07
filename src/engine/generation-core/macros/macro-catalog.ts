import {
  SUPPORTED_MACRO_CATEGORIES,
  SUPPORTED_MACRO_DEFINITIONS,
  type SupportedMacro,
  type SupportedMacroCategory,
} from "./macro-definitions";

export { SUPPORTED_MACRO_CATEGORIES };
export type { SupportedMacro, SupportedMacroCategory };

/**
 * Editor-safe view of active macro syntax.
 *
 * This projection intentionally omits resolver-only fields so UI consumers
 * cannot depend on implementation details or advertise unsupported macros.
 */
export const SUPPORTED_MACROS = SUPPORTED_MACRO_DEFINITIONS.map(
  ({ category, description, id, insertText, syntax }) => ({
    category,
    description,
    id,
    insertText,
    syntax,
  }),
) satisfies SupportedMacro[];
