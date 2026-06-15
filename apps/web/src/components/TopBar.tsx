import { Chip } from "./ui";

export function TopBar() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-ink/60 px-6 py-3 backdrop-blur">
      <div className="flex items-baseline gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-semibold tracking-tight text-fg">verita</span>
          <span className="relative text-xl font-semibold tracking-tight text-fg">
            s
            <span className="absolute -right-2.5 top-1 h-2 w-2 animate-pulse rounded-full bg-honest shadow-[0_0_10px_2px_rgba(61,220,151,0.6)]" />
          </span>
        </div>
        <span className="hidden text-sm text-muted sm:inline">
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
