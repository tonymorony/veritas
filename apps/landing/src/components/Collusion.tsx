import {
  Container,
  Section,
  Eyebrow,
  Reveal,
} from "./primitives";
import { BrowserFrame } from "./BrowserFrame";

export function Collusion() {
  return (
    <Section id="collusion" className="overflow-hidden">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="flex justify-center">
              <Eyebrow index="04" tone="slash">
                Collusion-resistance
              </Eyebrow>
            </div>
            <h2 className="text-section text-balance mx-auto mt-6 max-w-2xl">
              A Sybil cartel can{" "}
              <span className="text-slash">never</span> capture the Round.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted">
              Every Round is guaranteed a{" "}
              <span className="text-fg">majority of reputable Workers</span> — a
              reputable-majority floor. Flood it with fake identities and they
              simply score below zero, get slashed, and the leaderboard stays
              correct.
            </p>
          </Reveal>
        </div>

        {/* before / after */}
        <div className="mt-16 grid items-start gap-6 lg:grid-cols-2">
          <Reveal>
            <Compare
              tag="WITH FLOOR"
              tone="honest"
              title="Sybils slashed, ranking holds"
              metric="92%"
              metricLabel="truth match"
              caption="Inject a colluding subgroup and the floor guarantees honest workers stay in the majority. The cartel is slashed in red — the leaderboard never moves."
              src="/shots/dashboard-collusion.png"
              alt="Veritas dashboard with colluding Sybils slashed in red while the leaderboard stays correct at 92% truth match"
              url="veritas.local / round — collusion attack"
              glow="honest"
            />
          </Reveal>

          <Reveal delay={0.1}>
            <Compare
              tag="NO FLOOR"
              tone="slash"
              title="Cartel wins, ranking rigged"
              metric="25%"
              metricLabel="truth match"
              caption="Remove the floor and a Sybil majority captures the Round. Honest workers are slashed, the ranking is inverted — exactly what the floor prevents."
              src="/shots/dashboard-inverted.png"
              alt="Veritas dashboard with no reputable-majority floor: a Sybil cartel captured the round and the ranking is rigged at 25% truth match"
              url="veritas.local / round — no floor (inverted)"
              glow="slash"
            />
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted">
            <span className="font-mono text-honest">left</span> is what Veritas
            ships. <span className="font-mono text-slash">right</span> is the
            attack that the reputable-majority floor makes impossible.
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}

function Compare({
  tag,
  tone,
  title,
  metric,
  metricLabel,
  caption,
  src,
  alt,
  url,
  glow,
}: {
  tag: string;
  tone: "honest" | "slash";
  title: string;
  metric: string;
  metricLabel: string;
  caption: string;
  src: string;
  alt: string;
  url: string;
  glow: "honest" | "slash";
}) {
  const accent = tone === "honest" ? "text-honest" : "text-slash";
  const dot = tone === "honest" ? "bg-honest" : "bg-slash";
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${accent}`}>
            {tag}
          </span>
          <span className="text-sm font-medium text-fg">{title}</span>
        </div>
        <div className="text-right">
          <span className={`tnum text-xl font-bold ${accent}`}>{metric}</span>
          <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
            {metricLabel}
          </span>
        </div>
      </div>
      <BrowserFrame src={src} alt={alt} url={url} glow={glow} />
      <p className="mt-4 text-sm leading-relaxed text-muted">{caption}</p>
    </div>
  );
}
