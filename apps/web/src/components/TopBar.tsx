import { Chip } from "./ui";
import { useVeritas } from "../store/useVeritas";

function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="vtb" x1="26" y1="68" x2="80" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B8DEF" />
          <stop offset="1" stopColor="#86B4FF" />
        </linearGradient>
      </defs>
      <path
        d="M26 50 L44 68 L80 28"
        stroke="url(#vtb)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="68" r="15" fill="none" stroke="#3DDC97" strokeWidth="2.5" opacity="0.45" />
      <circle cx="44" cy="68" r="9" fill="#3DDC97" />
    </svg>
  );
}

function EngineToggle() {
  const engine = useVeritas((s) => s.engine);
  const setEngine = useVeritas((s) => s.setEngine);
  const opts: { id: "browser" | "server"; label: string }[] = [
    { id: "browser", label: "In-browser" },
    { id: "server", label: "Live server" },
  ];
  return (
    <div className="flex rounded-full border border-line bg-panel p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => void setEngine(o.id)}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            engine === o.id ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TopBar() {
  const engine = useVeritas((s) => s.engine);
  const busy = useVeritas((s) => s.busy);
  const serverOnline = useVeritas((s) => s.serverOnline);
  const engineUsed = useVeritas((s) => s.engineUsed);
  const paymentProof = useVeritas((s) => s.paymentProof);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-ink/60 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <Mark className="h-7 w-7" />
        <span className="text-xl font-semibold tracking-tight text-fg">veritas</span>
        <span className="ml-1 hidden text-sm text-muted lg:inline">
          Get paid for the truth. <span className="text-muted/60">No oracle required.</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <EngineToggle />
        {engine === "server" ? (
          busy ? (
            <Chip tone="scoring">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-scoring" /> running…
            </Chip>
          ) : !serverOnline ? (
            <Chip tone="amber">
              <span className="h-1.5 w-1.5 rounded-full bg-amber" /> server offline
            </Chip>
          ) : (
            <Chip tone="honest">
              <span className="h-1.5 w-1.5 rounded-full bg-honest" />
              {engineUsed === "live" ? "live LLM agents" : "server · simulated"}
            </Chip>
          )
        ) : (
          <Chip tone="scoring">
            <span className="h-1.5 w-1.5 rounded-full bg-scoring" /> in-browser sim
          </Chip>
        )}
        {engine === "server" && paymentProof && (
          <Chip tone="amber" title={paymentProof}>
            <span className="h-1.5 w-1.5 rounded-full bg-amber" /> x402 · access paid
          </Chip>
        )}
        <Chip tone="honest">
          <span className="h-1.5 w-1.5 rounded-full bg-honest" /> Settled via Circle
        </Chip>
      </div>
    </header>
  );
}
