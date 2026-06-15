import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Container } from "./primitives";

const DEMO_URL = "http://localhost:4173";

const links = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Mechanism", href: "#mechanism" },
  { label: "Collusion", href: "#collusion" },
  { label: "Docs", href: "http://localhost:4174" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-line/70 bg-ink/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <Container className="flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Veritas home">
          <Mark className="h-7 w-7" />
          <span className="text-[1.05rem] font-semibold tracking-tight text-fg">
            veritas
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noreferrer" : undefined}
              className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-fg"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <a
          href={DEMO_URL}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-2 rounded-full border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-fg transition-all hover:border-honest/40 hover:text-honest"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-honest opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-honest" />
          </span>
          Launch live demo
        </a>
      </Container>
    </motion.header>
  );
}

export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M24 52 L43 70 L78 30"
        stroke="#5B8DEF"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="43" cy="70" r="8.5" fill="#3DDC97" />
    </svg>
  );
}
