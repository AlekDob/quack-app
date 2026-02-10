import { useEffect } from "react";

/**
 * Hook that adds/removes 'window-blurred' class on app-shell
 * when window loses/gains focus. Used for performance optimization
 * to pause animations when window is not visible.
 */
export function useWindowFocus(): void {
  useEffect(() => {
    const handleFocus = () => {
      document.querySelector(".app-shell")?.classList.remove("window-blurred");
    };

    const handleBlur = () => {
      document.querySelector(".app-shell")?.classList.add("window-blurred");
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);
}
