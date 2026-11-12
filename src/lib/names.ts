/**
 * In the Brussels region OpenStreetMap records one name in both official languages, joined as
 * "French name - Dutch name" ("Musée de la Ville de Bruxelles - Museum van de Stad Brussel").
 * That is too long for a card, so one half is shown: the Dutch half for a visitor whose device is
 * set to Dutch, the French half otherwise. Both halves are real names of the place, and the full
 * name is kept for searching. Names elsewhere are never touched, since " - " can mean anything.
 */
const inBrusselsRegion = (lat: number, lng: number) => lat > 50.76 && lat < 50.92 && lng > 4.24 && lng < 4.49;

export function localName(name: string, lat: number, lng: number, languages: readonly string[]): string {
  if (!inBrusselsRegion(lat, lng)) return name;
  const parts = name.split(" - ");
  if (parts.length !== 2 || parts.some((p) => p.trim().length < 3)) return name;
  const dutch = (languages[0] ?? "").toLowerCase().startsWith("nl");
  return parts[dutch ? 1 : 0].trim();
}

/** The visitor's device languages, most preferred first. Empty on the server. */
export const deviceLanguages = (): readonly string[] => (typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]));

/** A place with its name shortened for display where that is safe; the full name is kept alongside. */
export function withLocalName<T extends { name: string; lat: number; lng: number; fullName?: string; address?: string; about?: string }>(
  a: T,
  languages: readonly string[] = deviceLanguages(),
): T {
  const full = a.fullName ?? a.name;
  const short = localName(full, a.lat, a.lng, languages);
  // Street and town names in Brussels are recorded the same way ("Grand-Place - Grote Markt").
  const address = a.address
    ?.split(",")
    .map((part) => localName(part.trim(), a.lat, a.lng, languages))
    .join(", ");
  let about = a.about;
  if (about && short !== full) about = about.split(full).join(short);
  if (about && a.address && address !== a.address)
    a.address.split(",").forEach((part, i) => {
      const p = part.trim();
      const s = address!.split(", ")[i];
      if (p && s && p !== s) about = about!.split(p).join(s);
    });
  if (short === a.name && address === a.address && about === a.about) return a;
  return { ...a, name: short, fullName: short === full ? undefined : full, address, about };
}
