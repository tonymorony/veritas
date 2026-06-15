import { Container } from "./primitives";
import { Mark } from "./Nav";

const links = [
  { label: "Live demo", href: "http://localhost:4173" },
  { label: "Docs", href: "http://localhost:4174" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Mechanism", href: "#mechanism" },
  { label: "Collusion", href: "#collusion" },
];

export function Footer() {
  return (
    <footer className="border-t border-line/70 bg-ink">
      <Container className="py-14">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <div>
            <a href="#top" className="flex items-center gap-2.5" aria-label="Veritas home">
              <Mark className="h-7 w-7" />
              <span className="text-lg font-semibold tracking-tight text-fg">
                veritas
              </span>
            </a>
            <p className="mt-3 max-w-xs font-mono text-xs leading-relaxed text-muted">
              get paid for the truth — no oracle required.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target={l.href.startsWith("http") ? "_blank" : undefined}
                rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                className="text-sm text-muted transition-colors hover:text-fg"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-line/60 pt-6 sm:flex-row sm:items-center">
          <p className="font-mono text-xs text-muted">
            Built for the Lepton Agents Hackathon &middot; Circle + Arc
          </p>
          <p className="font-mono text-xs text-muted/70">
            &copy; {new Date().getFullYear()} Veritas
          </p>
        </div>
      </Container>
    </footer>
  );
}
