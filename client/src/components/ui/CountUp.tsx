import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/**
 * Animated number that counts up to `value` on mount and re-animates from the
 * previous value whenever it changes. Honours reduced-motion (renders instantly).
 */
export const CountUp = ({ value, duration = 0.9 }: { value: number; duration?: number }) => {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const fromRef = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) { setDisplay(value); return; }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <>{display.toLocaleString()}</>;
};
