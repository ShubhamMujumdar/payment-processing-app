/**
 * Ambient grid, drawn in CSS rather than shipped as an asset — one fewer file,
 * and it inherits the brand colour instead of being baked into an SVG.
 */
export default function GridShape() {
  const grid = {
    backgroundImage:
      "linear-gradient(var(--color-brand-500) 1px, transparent 1px), linear-gradient(90deg, var(--color-brand-500) 1px, transparent 1px)",
    backgroundSize: "36px 36px",
  };

  return (
    <>
      <div
        aria-hidden="true"
        style={{ ...grid, maskImage: "radial-gradient(circle at 100% 0%, black, transparent 70%)" }}
        className="pointer-events-none absolute right-0 top-0 -z-1 h-[300px] w-full max-w-[450px] opacity-[0.10]"
      />
      <div
        aria-hidden="true"
        style={{ ...grid, maskImage: "radial-gradient(circle at 0% 100%, black, transparent 70%)" }}
        className="pointer-events-none absolute bottom-0 left-0 -z-1 h-[300px] w-full max-w-[450px] opacity-[0.10]"
      />
    </>
  );
}
