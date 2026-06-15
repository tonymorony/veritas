import { motion } from "framer-motion";
import { Container } from "./primitives";

const DEMO_URL = "http://localhost:4173";
const DOCS_URL = "http://localhost:4174";

const ease = [0.16, 1, 0.3, 1] as const;

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-32 md:py-40">
      {/* backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-40 mask-fade-edges" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(61,220,151,0.16),transparent)] blur-2xl" />
      </div>

      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease }}
            className="text-display-sm text-balance gradient-text"
          >
            Get paid for{" "}
            <span className="text-honest">the truth.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted"
          >
            Run a Round, watch the cartel get slashed, and read the spec. No
            oracle required.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease, delay: 0.2 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-honest px-7 py-3.5 text-sm font-semibold text-ink transition-all duration-300 hover:shadow-[0_0_50px_-8px] hover:shadow-honest/70 sm:w-auto"
            >
              Launch the live demo
              <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-panel/40 px-7 py-3.5 text-sm font-semibold text-fg transition-all duration-300 hover:border-fg/30 hover:bg-panel sm:w-auto"
            >
              Read the docs
            </a>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
