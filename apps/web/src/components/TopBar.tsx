import { Chip } from "./ui";

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

export function TopBar() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-ink/60 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <Mark className="h-7 w-7" />
        <span className="text-xl font-semibold tracking-tight text-fg">veritas</span>
        <span className="ml-1 hidden text-sm text-muted sm:inline">
          Get paid for the truth. <span className="text-muted/60">No oracle required.</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Chip tone="scoring">
          <span className="h-1.5 w-1.5 rounded-full bg-scoring" /> Arc testnet · mock
        </Chip>
        <Chip tone="honest">
          <span className="h-1.5 w-1.5 rounded-full bg-honest" /> Settled via Circle
        </Chip>
      </div>
    </header>
  );
}
