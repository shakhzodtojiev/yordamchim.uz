"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import * as React from "react";

const FADE_UP = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/** Fades in and rises a touch on mount. The default landing animation for
 *  a hero/heading block. */
export function FadeUp({
  delay = 0,
  duration = 0.36,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number; duration?: number }) {
  return (
    <motion.div
      initial={FADE_UP.initial}
      animate={FADE_UP.animate}
      transition={{ duration, delay, ease: [0.4, 0, 0.2, 1] }}
      {...rest}
    />
  );
}

/** Wraps a list of items so they reveal in a quick stagger when the page
 *  mounts. Pair with <StaggerItem> children. */
export function Stagger({
  delay = 0,
  stagger = 0.05,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number; stagger?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            delayChildren: delay,
            staggerChildren: stagger,
          },
        },
      }}
      {...rest}
    />
  );
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
  },
};

export function StaggerItem({ ...rest }: HTMLMotionProps<"div">) {
  return <motion.div variants={ITEM_VARIANTS} {...rest} />;
}

/** Press-feedback wrapper. Use on big tappable cards if `card-hover` class
 *  isn't enough. */
export function PressableCard({
  children,
  ...rest
}: HTMLMotionProps<"div"> & { children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Reveals on scroll-into-view. Used on long landing pages so each section
 *  animates in as the user reaches it (rather than all at once on mount). */
export function Reveal({
  delay = 0,
  y = 18,
  duration = 0.5,
  ...rest
}: HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
  duration?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay, ease: [0.4, 0, 0.2, 1] }}
      {...rest}
    />
  );
}

/** Stagger that fires on scroll-into-view (vs Stagger which fires on mount).
 *  Pair with <StaggerItem>. */
export function RevealStagger({
  delay = 0,
  stagger = 0.08,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number; stagger?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        show: {
          transition: { delayChildren: delay, staggerChildren: stagger },
        },
      }}
      {...rest}
    />
  );
}
