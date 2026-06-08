import { motion, type Variants } from 'framer-motion';

/**
 * Shared scroll-reveal primitives for the marketing site. Each block fades and
 * rises into view once, with an editorial easing curve. Respects reduced motion
 * automatically (Framer Motion honours the OS setting via `useReducedMotion`
 * in consumers; these transforms are subtle and safe).
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

const VIEWPORT = { once: true, margin: '-70px' } as const;

/** A single block that reveals on scroll. */
export const Reveal = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <motion.div className={className} variants={fadeUp} initial="hidden" whileInView="show" viewport={VIEWPORT}>
    {children}
  </motion.div>
);

/** Container that staggers the reveal of its <StaggerItem> children. */
export const StaggerGroup = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <motion.div className={className} variants={staggerContainer} initial="hidden" whileInView="show" viewport={VIEWPORT}>
    {children}
  </motion.div>
);

/** A child of <StaggerGroup>. Optionally lifts on hover. */
export const StaggerItem = ({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) => (
  <motion.div
    className={className}
    variants={fadeUp}
    {...(hover ? { whileHover: { y: -5 }, transition: { type: 'spring', stiffness: 300, damping: 22 } } : {})}
  >
    {children}
  </motion.div>
);
