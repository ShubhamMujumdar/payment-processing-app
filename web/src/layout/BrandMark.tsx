/**
 * Logo slot.
 *
 * PLACEHOLDER. This is a typeset wordmark, not the Cognizant logo. The real
 * dark-theme SVG has to come from the internal brand portal - see
 * docs/OPEN-ACTIONS.md item 2.4. Recreating a company mark by hand or lifting
 * it off the public site gets the geometry wrong and is not brand-compliant,
 * which matters if this is shown to a client as Cognizant's product.
 *
 * To swap it in: drop the SVG at public/images/logo/cognizant-dark.svg and
 * replace the markup below with an <img>. Nothing else in the app references
 * the logo.
 */

export default function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex size-9 items-center justify-center rounded-lg bg-brand-500/15">
        <span className="font-display text-[15px] font-bold text-brand-400">C</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15">
        <span className="font-display text-[15px] font-bold text-brand-400">C</span>
      </div>
      <div className="leading-none">
        <p className="font-display text-[15px] font-semibold tracking-tight text-gray-100">
          Cognizant
        </p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-gray-500">
          SDLC Spine
        </p>
      </div>
    </div>
  );
}
