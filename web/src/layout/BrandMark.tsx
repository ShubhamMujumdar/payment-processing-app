/**
 * Cognizant lockup.
 *
 * The supplied PNG has a dark-navy wordmark, which is invisible on a dark
 * surface. The asset in public/images/logo was generated from it by recolouring
 * only the wordmark's RGB and keeping its alpha, so the glyph shapes, spacing
 * and the gradient mark are all untouched. Source: seeklogo PNG supplied by the
 * programme, 15 Aug 2026.
 *
 * When the official SVG arrives from the brand portal, replace the two files in
 * public/images/logo and nothing else needs to change.
 */

export default function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <img
        src="/images/logo/cognizant-mark.png"
        alt="Cognizant"
        width={22}
        height={19}
        className="shrink-0"
      />
    );
  }

  return (
    <img
      src="/images/logo/cognizant-dark@2x.png"
      alt="Cognizant"
      width={137}
      height={25}
      className="shrink-0"
    />
  );
}
