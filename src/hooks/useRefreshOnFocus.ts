import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Re-runs `load` every time the screen regains focus (e.g. navigating back
 * from a modal after publishing), not just on first mount. Skips the very
 * first focus since callers already call `load` themselves on mount.
 */
export function useRefreshOnFocus(load: () => void | Promise<void>) {
  const isFirstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      load();
    }, [load])
  );
}
