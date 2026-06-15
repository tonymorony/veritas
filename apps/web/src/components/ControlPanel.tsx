import { motion } from "framer-motion";
import { PRESETS, useVeritas } from "../store/useVeritas";
import type { RoundParams } from "../sim/types";
import { Panel } from "./ui";

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className="tnum text-xs text-fg">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="veritas-range w-full"
      />
    </label>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-ink/50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            value === o.value ? "bg-panel-2 text-fg shadow" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ControlPanel() {
  const params = useVeritas((s) => s.params);
  const composition = useVeritas((s) => s.composition);
  const activePreset = useVeritas((s) => s.activePreset);
  const setParam = useVeritas((s) => s.setParam);
  const setSybils = useVeritas((s) => s.setSybils);
  const runRound = useVeritas((s) => s.runRound);
  const runMany = useVeritas((s) => s.runMany);
  const applyPreset = useVeritas((s) => s.applyPreset);
  const reset = useVeritas((s) => s.reset);

  const set = <K extends keyof RoundParams>(k: K) => (v: RoundParams[K]) => setParam(k, v);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      {/* Presets */}
      <Panel title="Scenario presets">
        <div className="grid gap-2 p-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`group rounded-lg border px-3 py-2 text-left transition-colors ${
                activePreset === p.id
                  ? "border-honest/50 bg-honest/5"
                  : "border-line bg-ink/40 hover:border-line hover:bg-panel-2/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-fg">{p.label}</span>
                {activePreset === p.id && <span className="text-[10px] text-honest">active</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted">{p.blurb}</p>
            </button>
          ))}
        </div>
      </Panel>

      {/* HERO collusion slider */}
      <Panel
        className="border-slash/20 bg-gradient-to-b from-slash/[0.06] to-transparent"
        title="The collusion dial"
      >
        <div className="p-4">
          <div className="mb-2 flex items-end justify-between">
            <span className="text-sm font-medium text-fg">Inject colluding Sybils</span>
            <motion.span
              key={composition.sybil}
              initial={{ scale: 1.3, color: "#FF5C5C" }}
              animate={{ scale: 1, color: composition.sybil > 0 ? "#FF5C5C" : "#8A93A6" }}
              className="tnum text-2xl font-semibold"
            >
              {composition.sybil}
            </motion.span>
          </div>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={composition.sybil}
            aria-label="Inject colluding Sybils"
            aria-valuetext={`${composition.sybil} Sybils`}
            onChange={(e) => setSybils(Number(e.target.value))}
            className="veritas-range veritas-range-danger w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>none</span>
            <span>cartel</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            Adds Sybil rows to the swarm. CA scores them with no oracle — watch them collapse.
          </p>

          <div className="mt-4 grid gap-3">
            <div>
              <span className="mb-1 block text-xs text-muted">Sybil strategy</span>
              <Toggle
                value={params.sybilStrategy}
                onChange={(v) => setParam("sybilStrategy", v as RoundParams["sybilStrategy"])}
                options={[
                  { value: "naive", label: "Naive pump" },
                  { value: "coordinated", label: "Coordinated" },
                ]}
              />
            </div>
            <label
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                params.enforceMajorityFloor
                  ? "border-honest/40 bg-honest/5"
                  : "border-slash/40 bg-slash/5"
              }`}
            >
              <div>
                <div className="text-sm font-medium text-fg">Reputable-majority floor</div>
                <div className="text-[11px] text-muted">ADR-0005 · Sybils can never be a majority</div>
              </div>
              <button
                role="switch"
                aria-checked={params.enforceMajorityFloor}
                aria-label="Reputable-majority floor (ADR-0005)"
                onClick={() => setParam("enforceMajorityFloor", !params.enforceMajorityFloor)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  params.enforceMajorityFloor ? "bg-honest" : "bg-slash/60"
                }`}
              >
                <motion.span
                  layout
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-ink shadow"
                  animate={{ left: params.enforceMajorityFloor ? "22px" : "2px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </label>
          </div>
        </div>
      </Panel>

      {/* Round params */}
      <Panel title="Round parameters">
        <div className="grid gap-4 p-4">
          <Slider
            label="Tasks (N)"
            value={params.numTasks}
            min={4}
            max={20}
            display={String(params.numTasks)}
            onChange={set("numTasks")}
          />
          <Slider
            label="Round size (M)"
            value={params.roundSize}
            min={3}
            max={12}
            display={String(params.roundSize)}
            onChange={set("roundSize")}
          />
          <Slider
            label="Base reward / report"
            value={params.baseReward}
            min={1}
            max={20}
            display={`$${params.baseReward}`}
            onChange={set("baseReward")}
          />
          <Slider
            label="Stake / worker"
            value={params.stake}
            min={1}
            max={20}
            display={`$${params.stake}`}
            onChange={set("stake")}
          />
          <Slider
            label="Honest accuracy"
            value={params.honestAccuracy}
            min={0.5}
            max={0.99}
            step={0.01}
            display={`${(params.honestAccuracy * 100).toFixed(0)}%`}
            onChange={set("honestAccuracy")}
          />
        </div>
      </Panel>

      {/* Run controls */}
      <div className="sticky bottom-0 grid grid-cols-[1fr_auto_auto] gap-2 rounded-xl border border-line bg-panel/90 p-2 backdrop-blur">
        <button
          onClick={runRound}
          className="rounded-lg bg-honest px-4 py-2.5 text-sm font-semibold text-ink transition-transform hover:brightness-110 active:scale-[0.98]"
        >
          Run Round
        </button>
        <button
          onClick={() => runMany(10)}
          className="rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-panel-2/70"
        >
          Auto ×10
        </button>
        <button
          onClick={reset}
          title="Reset everything"
          className="rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:text-fg"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
