import { useCallback } from "react";
import { useEscapeKey } from "../../../shared/ui/use-escape-key";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseCareDrawerActionsInput = {
  careOpen: boolean;
  setCareOpen: StateSetter<boolean>;
  setCareTab: StateSetter<number>;
};

export function useCareDrawerActions({
  careOpen,
  setCareOpen,
  setCareTab,
}: UseCareDrawerActionsInput) {
  const closeCareDrawer = useCallback(() => setCareOpen(false), [setCareOpen]);
  useEscapeKey(careOpen, closeCareDrawer);

  const setCareDrawerOpen = useCallback(
    (open: boolean) => setCareOpen(open),
    [setCareOpen],
  );

  const setCareDrawerTab = useCallback(
    (tab: number) => setCareTab(tab),
    [setCareTab],
  );

  return {
    setCareOpen: setCareDrawerOpen,
    setCareTab: setCareDrawerTab,
  };
}
