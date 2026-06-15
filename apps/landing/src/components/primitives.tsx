import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/* ---------------------------------------------------------------- *
 * Layout
 * ---------------------------------------------------------------- */

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1180px] px-6 md:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-24 py-24 md:py-32 ${className}`}
    >
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- *
 * Eyebrow label — mono, numbered section marker
 * ---------------------------------------------------------------- */

export function Eyebrow({
  index,
  children,
  tone = "muted",
}: {
  index?: string;
  children: ReactNode;
  tone?: "muted" | "honest" | "scoring" | "slash" | "amber";
}) {
  const dot = {
    muted: "bg-muted",
    honest: "bg-honest",
    scoring: "bg-scoring",
    slash: "bg-slash",
    amber: "bg-amber",
  }[tone];
  return (
    <div className="eyebrow flex items-center gap-3">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {index && <span className="text-fg/70">{index}</span>}
      <span>{children}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Scroll reveal — tasteful, consistent
 * ---------------------------------------------------------------- */

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

export function Reveal({
  children,
  delay = 0,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "span" | "li";
}) {
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
  );
}

export function RevealGroup({
  children,
  className = "",
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={revealVariants}>
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- *
 * Buttons
 * ---------------------------------------------------------------- */

export function ButtonPrimary({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className={`group relative inline-flex items-center justify-center gap-2 rounded-full bg-honest px-6 py-3 text-sm font-semibold text-ink transition-all duration-300 hover:shadow-[0_0_40px_-6px] hover:shadow-honest/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honest ${className}`}
    >
      {children}
      <Arrow />
    </a>
  );
}

export function ButtonGhost({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-line bg-panel/40 px-6 py-3 text-sm font-semibold text-fg transition-all duration-300 hover:border-fg/30 hover:bg-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg/40 ${className}`}
    >
      {children}
    </a>
  );
}

function Arrow() {
  return (
    <svg
      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h9M8.5 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------- *
 * Card surface
 * ---------------------------------------------------------------- */

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-line bg-panel/50 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}
