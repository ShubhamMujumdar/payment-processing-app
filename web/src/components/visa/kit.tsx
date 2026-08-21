import type { ReactNode } from "react";

/**
 * The design's building blocks, with the numbers taken from the file rather
 * than matched by eye: 12px card radius, a flat 1px #e5e7eb rule, 24px card
 * padding, 8/12/16 gaps, Inter for prose and JetBrains Mono for identifiers.
 *
 * These exist so the mocked executive pages and the real delivery pages are
 * built from one vocabulary. If the two drifted apart, the seam between "this
 * is our system" and "this is a placeholder" would be visible for the wrong
 * reason -- because the cards looked different, not because the data does.
 */

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-ink-700 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon, children, aside }: { icon?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      {icon && <span className="translate-y-[2px] text-accent">{icon}</span>}
      <h2 className="text-[20px] font-bold tracking-[-0.01em] text-gray-100">{children}</h2>
      {aside && <span className="ml-auto text-[12px] text-gray-500">{aside}</span>}
    </div>
  );
}

type Tone = "brand" | "pass" | "warn" | "fail" | "idle";

const PILL: Record<Tone, string> = {
  brand: "bg-accent-soft text-accent",
  pass: "bg-[#e6f7ef] text-state-pass",
  warn: "bg-[#fff6e5] text-state-warn",
  fail: "bg-[#fbeaea] text-state-fail",
  idle: "bg-ink-750 text-gray-500",
};

const DOT: Record<Tone, string> = {
  brand: "bg-accent",
  pass: "bg-state-pass",
  warn: "bg-state-warn",
  fail: "bg-state-fail",
  idle: "bg-state-idle",
};

export function Pill({ tone = "idle", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${PILL[tone]}`}>
      {dot && <span className={`size-1.5 rounded-full ${DOT[tone]}`} />}
      {children}
    </span>
  );
}

export function Badge({ tone = "idle", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide ${PILL[tone]}`}>
      {children}
    </span>
  );
}

const EDGE: Record<Tone, string> = {
  brand: "before:bg-accent",
  pass: "before:bg-state-pass",
  warn: "before:bg-state-warn",
  fail: "before:bg-state-fail",
  idle: "before:bg-ink-600",
};

/** The design's headline metric: a card with a coloured left edge. */
export function StatCard({
  label, value, unit, tone = "brand", note, icon, progress,
}: {
  label: string; value: ReactNode; unit?: string; tone?: Tone;
  note?: ReactNode; icon?: ReactNode; progress?: number;
}) {
  return (
    <Card className={`relative overflow-hidden pl-6 pr-5 py-5 before:absolute before:inset-y-0 before:left-0 before:w-[4px] ${EDGE[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-medium text-gray-300">{label}</p>
        {icon && <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${PILL[tone]}`}>{icon}</span>}
      </div>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-[32px] font-bold leading-none tracking-[-0.02em] text-gray-100">{value}</span>
        {unit && <span className="text-[13px] font-semibold text-gray-500">{unit}</span>}
      </p>
      {progress !== undefined && <Progress value={progress} tone={tone} className="mt-3" />}
      {note && <p className="mt-2 text-[12.5px] leading-snug text-gray-500">{note}</p>}
    </Card>
  );
}

const BAR: Record<Tone, string> = {
  brand: "bg-accent",
  pass: "bg-state-pass",
  warn: "bg-state-warn",
  fail: "bg-state-fail",
  idle: "bg-ink-600",
};

export function Progress({ value, tone = "brand", className = "" }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink-750 ${className}`}>
      <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** The navy gradient panel the design uses for machine-generated advice. */
export function InsightCard({
  kicker, title, body, action, meta,
}: { kicker: string; title: string; body: ReactNode; action?: string; meta?: string }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-nav-top to-nav-bottom p-5 text-white shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold">
          <span className="text-[13px] leading-none">✦</span> {kicker}
        </span>
        {meta && <span className="ml-auto text-[12px] text-white/60">{meta}</span>}
      </div>
      <p className="mt-3 text-[19px] font-bold leading-snug">{title}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-white/75">{body}</p>
      {action && (
        <button type="button" title="Not built yet"
          className="mt-4 cursor-not-allowed text-[13px] font-semibold text-white/90">
          {action} <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}

export function PageHead({
  kicker, title, blurb, right, breadcrumb,
}: { kicker?: string; title: string; blurb?: string; right?: ReactNode; breadcrumb?: string[] }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-1 pt-6">
      <div className="min-w-0">
        {breadcrumb && (
          <p className="mb-2 text-[13px] text-gray-500">
            {breadcrumb.map((c, i) => (
              <span key={c}>
                {i > 0 && <span className="px-1.5 text-gray-600">/</span>}
                <span className={i === breadcrumb.length - 1 ? "font-semibold text-gray-200" : ""}>{c}</span>
              </span>
            ))}
          </p>
        )}
        {kicker && (
          <p className="mb-1 font-mono text-[12px] font-bold uppercase tracking-wider text-accent">{kicker}</p>
        )}
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-gray-100">{title}</h1>
        {blurb && <p className="mt-1.5 text-[14px] text-gray-400">{blurb}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2 pt-1">{right}</div>}
    </div>
  );
}

/** Buttons in the design that have nothing behind them in this build. */
export function MockButton({ children, variant = "ghost" }: { children: ReactNode; variant?: "solid" | "ghost" }) {
  const base = "inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold";
  return (
    <button type="button" title="Not built yet — this control is part of the design, not this build"
      className={variant === "solid"
        ? `${base} bg-nav-bottom text-white/90`
        : `${base} border border-ink-700 bg-white text-gray-300`}>
      {children}
    </button>
  );
}

/** Marks a whole page as illustrative, using the same language as the header
 *  chips so "seeded" means one thing everywhere in this app. */
export function MockBanner({ what }: { what: string }) {
  return (
    <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-state-warn/25 bg-[#fff6e5] px-3.5 py-2.5">
      <span className="size-1.5 shrink-0 rounded-full bg-state-warn" />
      <p className="text-[12.5px] text-state-warn">
        <span className="font-semibold">Seeded page.</span> {what} Nothing here is read from the
        delivery record — the live screens are My Tasks, Project Health, Code Review,
        Knowledge Base and Traceability.
      </p>
    </div>
  );
}
