/**
 * True when running as the single-file preview (see preview/). The preview can't reach
 * Overpass, Nominatim, Open-Meteo or tile servers, so those features say so instead of failing.
 */
export const PREVIEW =
  typeof window !== "undefined" && (window as unknown as { __PISTACHIO_PREVIEW__?: boolean }).__PISTACHIO_PREVIEW__ === true;

/**
 * Sample ("demo") listings only exist in the offline preview, which can't load real places.
 * The live site shows real places and business listings only.
 */
export const SHOW_DEMO = PREVIEW;
