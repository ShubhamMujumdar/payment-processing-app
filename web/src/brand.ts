/**
 * Who this build says it belongs to.
 *
 * Kept out of the source because this repository is public. The wordmark, the
 * product line under it and the portal title in the header are read from the
 * environment, so a client-branded demo is three lines in `web/.env.local`
 * (which is gitignored) rather than a client's name in public git history.
 *
 *   VITE_BRAND_NAME=ACME
 *   VITE_BRAND_PRODUCT=Workforce Management
 *   VITE_BRAND_PORTAL=Executive KM Portal
 */
export const BRAND = {
  /** The wordmark at the top of the navigation rail. */
  name: import.meta.env.VITE_BRAND_NAME ?? "VISA",
  /** The line beneath it. */
  product: import.meta.env.VITE_BRAND_PRODUCT ?? "Strategic Program Management",
  /** The title in the top bar. */
  portal: import.meta.env.VITE_BRAND_PORTAL ?? "Strategic Program Management",
};
