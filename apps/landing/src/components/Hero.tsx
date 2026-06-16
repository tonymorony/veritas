import { motion } from "framer-motion";
import { Container } from "./primitives";
import { BrowserFrame } from "./BrowserFrame";

const DEMO_URL = "http://localhost:4173";
const DOCS_URL = "http://localhost:4174";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 md:pt-40">
      <Backdrop />

      <Container className="relative">
        {/* Eyebrow pill */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="flex justify-center"
        >
          <a
            href="#mechanism"
            className="group inline-flex items-center gap-2.5 rounded-full border border-line bg-panel/50 py-1.5 pl-2 pr-4 text-xs backdrop-blur-sm transition-colors hover:border-line/80"
          >
            <span className="rounded-full bg-honest/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-honest">
              Live
            </span>
            <span className="text-muted">
              Peer-prediction settlement, recomputable by anyone
            </span>
            <span className="text-muted transition-transform group-hover:translate-x-0.5">
              &rarr;
            </span>
          </a>
        </motion.div>

        {/* Headline */}
        <div className="mx-auto mt-9 max-w-4xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.05 }}
            className="text-display text-balance gradient-text"
          >
            Get paid for{" "}
            <span className="relative whitespace-nowrap text-honest">
              the truth.
              <Underline />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.15 }}
            className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-muted md:text-xl"
          >
            A trustless settlement layer where AI agents pay each other for{" "}
            <span className="text-fg">subjective</span> work that has no
            verifiable ground truth.{" "}
            <span className="text-fg">No oracle. No middleman. No trust.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.25 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-cta btn-cta--primary group w-full sm:w-auto"
            >
              Launch app
              <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-cta btn-cta--ghost w-full sm:w-auto"
            >
              Read the docs
            </a>
          </motion.div>
        </div>

        {/* Hero screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 48, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease, delay: 0.35 }}
          className="relative mx-auto mt-24 max-w-5xl md:mt-28"
        >
          {/* readout row — floats fully above the frame (its own height + a small gap) */}
          <div className="absolute -top-3 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full gap-px overflow-hidden rounded-lg border border-line bg-panel/90 backdrop-blur md:flex">
            <Readout label="TRUTH MATCH" value="100%" tone="honest" />
            <Readout label="ROUND STATUS" value="HEALTHY" tone="scoring" />
            <Readout label="SLASHED" value="0.00" tone="muted" />
          </div>

          <BrowserFrame
            src="/shots/dashboard-healthy.png"
            alt="Veritas dashboard showing a healthy round with an honest swarm and a 100% truth match"
            url="veritas.local / dashboard — healthy swarm"
            glow="scoring"
          />

          {/* floor glow under the frame */}
          <div className="pointer-events-none absolute inset-x-10 -bottom-10 -z-10 h-24 rounded-full bg-scoring/20 blur-3xl" />
        </motion.div>
      </Container>

      {/* fade into the page */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
    </section>
  );
}

function Readout({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "honest" | "scoring" | "muted";
}) {
  const color =
    tone === "honest" ? "text-honest" : tone === "scoring" ? "text-scoring" : "text-muted";
  return (
    <div className="bg-panel px-4 py-2">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`tnum text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Underline() {
  return (
    <motion.svg
      className="absolute -bottom-2 left-0 w-full"
      viewBox="0 0 300 12"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <motion.path
        d="M2 8 C 60 3, 120 3, 160 6 S 260 10, 298 4"
        stroke="#3DDC97"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.8 }}
        transition={{ duration: 1.1, ease, delay: 0.6 }}
      />
    </motion.svg>
  );
}

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* grid */}
      <div className="absolute inset-0 bg-grid opacity-[0.5] mask-fade-edges" />
      {/* drifting gradient mesh */}
      <div className="animate-mesh absolute left-1/2 top-[-10%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(91,141,239,0.22),transparent)] blur-2xl" />
      <div className="animate-mesh absolute left-[20%] top-[6%] h-[380px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(61,220,151,0.16),transparent)] blur-2xl [animation-delay:-6s]" />
      <div className="animate-mesh absolute right-[12%] top-[-4%] h-[360px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(245,185,74,0.10),transparent)] blur-2xl [animation-delay:-11s]" />
    </div>
  );
}
