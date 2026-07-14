import { getDeKoiStorageBundleCounts } from "../../runtime";
import type { CareDrawerNav } from "./care-drawer-types";

export function getCurrentCareBundleCounts(nav: CareDrawerNav) {
  return getDeKoiStorageBundleCounts({
    appSettings: nav.appSettings,
    characters: nav.characters,
    modeThreads: nav.modeThreads,
    lorebooks: nav.lorebooks,
    promptPresets: nav.promptPresets,
    loreRuntimeStates: nav.loreRuntimeStates,
    macroVariableStates: nav.macroVariableStates,
    personas: nav.personas,
    providerConnections: nav.providerConnections,
    rippleStates: nav.rippleStates,
  });
}
