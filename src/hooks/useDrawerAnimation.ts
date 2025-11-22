import { useState, useCallback } from 'react';

/**
 * Reusable hook for drawer slide-in/slide-out animations
 *
 * @param onClose - Callback to execute when drawer closes
 * @param animationDuration - Duration of closing animation in ms (default: 200)
 * @returns Object with isClosing state, handleClose function, and getClassName helper
 *
 * @example
 * const { isClosing, handleClose, getClassName } = useDrawerAnimation(() => setDrawerOpen(false));
 *
 * <div className={getClassName('drawer-base-class')}>
 *   <button onClick={handleClose}>Close</button>
 * </div>
 */
export const useDrawerAnimation = (
  onClose: () => void,
  animationDuration: number = 200
) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, animationDuration);
  }, [onClose, animationDuration]);

  /**
   * Get className with animation state
   * @param baseClassName - Base CSS class(es) to apply
   * @returns className string with animation class appended
   */
  const getClassName = useCallback(
    (baseClassName: string = '') => {
      const animationClass = isClosing ? 'slide-out-right' : 'slide-in-right';
      return `${baseClassName} ${animationClass}`.trim();
    },
    [isClosing]
  );

  return {
    isClosing,
    handleClose,
    getClassName,
  };
};

/**
 * CSS keyframes for drawer animations
 * Add this to your global CSS or component styles:
 *
 * @keyframes slide-in-right {
 *   from {
 *     transform: translateX(100%);
 *     opacity: 0;
 *   }
 *   to {
 *     transform: translateX(0);
 *     opacity: 1;
 *   }
 * }
 *
 * @keyframes slide-out-right {
 *   from {
 *     transform: translateX(0);
 *     opacity: 1;
 *   }
 *   to {
 *     transform: translateX(100%);
 *     opacity: 0;
 *   }
 * }
 *
 * .slide-in-right {
 *   animation: slide-in-right 0.2s ease-out forwards;
 * }
 *
 * .slide-out-right {
 *   animation: slide-out-right 0.2s ease-in forwards;
 * }
 */
