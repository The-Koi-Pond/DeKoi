import { getDeKoiStorageBundleCounts } from "../../runtime";
import type { CareDrawerNav } from "./care-drawer-types";

export function getCurrentCareBundleCounts(nav: CareDrawerNav) {
  return getDeKoiStorageBundleCounts({
    appSettings: nav.appSettings,
    characters: nav.characters,
    roleplayThreads: nav.roleplayThreads,
    lorebooks: nav.lorebooks,
    loreRuntimeStates: nav.loreRuntimeStates,
    messengerThreads: nav.messengerThreads,
    personas: nav.personas,
    providerConnections: nav.providerConnections,
    rippleStates: nav.rippleStates,
  });
}
