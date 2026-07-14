import { useCallback, useLayoutEffect, useRef } from "react";

import type { NavViewState } from "../../navigation";

export type CatalogNavigationOriginPredicate = () => boolean;

export interface CatalogNavigationLifecycle {
  captureOriginCurrent: () => CatalogNavigationOriginPredicate;
  isMounted: () => boolean;
}

export function useCatalogNavigationLifecycle(
  navigationContext: NavViewState["view"],
  sideRailView: NavViewState["sideRailView"],
  originActive: boolean,
): CatalogNavigationLifecycle {
  const mountedRef = useRef(false);
  const navigationContextRef = useRef(navigationContext);
  const sideRailViewRef = useRef(sideRailView);
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
    const sideRailChanged = sideRailViewRef.current !== sideRailView;
    const activeChanged = originActiveRef.current !== originActive;
    if (contextChanged || sideRailChanged || activeChanged) {
      navigationContextRef.current = navigationContext;
      sideRailViewRef.current = sideRailView;
      originActiveRef.current = originActive;
      navigationVersionRef.current += 1;
    }
  }, [navigationContext, originActive, sideRailView]);

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
