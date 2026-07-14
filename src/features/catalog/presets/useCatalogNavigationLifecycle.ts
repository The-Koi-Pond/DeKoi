import { useCallback, useLayoutEffect, useRef } from "react";

import type { NavViewState } from "../../navigation";

export type CatalogNavigationOriginPredicate = () => boolean;

export interface CatalogNavigationLifecycle {
  captureOriginCurrent: () => CatalogNavigationOriginPredicate;
  isMounted: () => boolean;
}

export function useCatalogNavigationLifecycle(
  navigationContext: NavViewState["view"],
  originActive: boolean,
): CatalogNavigationLifecycle {
  const mountedRef = useRef(false);
  const navigationContextRef = useRef(navigationContext);
  const originActiveRef = useRef(originActive);
  const navigationVersionRef = useRef(0);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const contextChanged = navigationContextRef.current !== navigationContext;
    const activeChanged = originActiveRef.current !== originActive;
    if (contextChanged || activeChanged) {
      navigationContextRef.current = navigationContext;
      originActiveRef.current = originActive;
      navigationVersionRef.current += 1;
    }
  }, [navigationContext, originActive]);

  const isMounted = useCallback(() => mountedRef.current, []);
  const captureOriginCurrent = useCallback(() => {
    const originNavigationVersion = navigationVersionRef.current;
    return () =>
      isMounted() &&
      originActiveRef.current &&
      navigationVersionRef.current === originNavigationVersion;
  }, [isMounted]);

  return { captureOriginCurrent, isMounted };
}
