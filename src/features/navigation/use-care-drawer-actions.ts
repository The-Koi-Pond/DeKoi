import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useEscapeKey } from "../../shared/ui/use-escape-key";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

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
