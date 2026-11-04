import { canFeature, canOffer, type PlanId } from "./plans";
import { local } from "./storage";
import { getSupabase } from "./supabase/client";
import type { Activity, BusinessEvent, WeeklyHours } from "./types";

export interface ListingEdits {
  name?: string;
  summary?: string;
  about?: string;
  price?: number | null;
  priceNote?: string;
  hours?: WeeklyHours | null;
  website?: string;
  phone?: string;
  accessNote?: string;
}

export interface BusinessRecord {
  id?: string;
  activityId: string;
  status: "pending" | "verified" | "rejected";
  plan: PlanId;
  featured: boolean;
  listing: ListingEdits;
  offers: BusinessEvent[];
  photos: string[];
  contactName?: string;
  contactEmail?: string;
  /** "device" records live in this browser only; "cloud" records are in Supabase */
  storage: "device" | "cloud";
}

const KEY = "businesses";

export function deviceRecords(): BusinessRecord[] {
  return local.get<BusinessRecord[]>(KEY, []);
}

function saveDevice(rec: BusinessRecord) {
  const all = deviceRecords().filter((r) => r.activityId !== rec.activityId);
  all.push(rec);
  local.set(KEY, all);
}

type Row = {
  id: string;
  activity_id: string;
  status: BusinessRecord["status"];
  plan: PlanId;
  featured: boolean;
  listing: ListingEdits;
  offers: BusinessEvent[];
  photos: string[];
  contact_name: string | null;
  contact_email: string | null;
};

const fromRow = (r: Row): BusinessRecord => ({
  id: r.id,
  activityId: r.activity_id,
  status: r.status,
  plan: r.plan,
  featured: r.featured,
  listing: r.listing ?? {},
  offers: r.offers ?? [],
  photos: r.photos ?? [],
  contactName: r.contact_name ?? undefined,
  contactEmail: r.contact_email ?? undefined,
  storage: "cloud",
});

/** Public overlays: verified cloud listings plus anything claimed on this device. */
export async function loadOverlays(): Promise<BusinessRecord[]> {
  const out = [...deviceRecords()];
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("businesses").select("*").eq("status", "verified").limit(1000);
    for (const r of (data ?? []) as Row[]) if (!out.some((o) => o.activityId === r.activity_id)) out.push(fromRow(r));
  }
  return out;
}

export async function myBusinesses(userId: string | null): Promise<BusinessRecord[]> {
  const sb = getSupabase();
  if (sb && userId) {
    const { data } = await sb.from("businesses").select("*").eq("owner_id", userId);
    return ((data ?? []) as Row[]).map(fromRow);
  }
  return deviceRecords();
}

export async function claimListing(
  activityId: string,
  contact: { name: string; email: string },
  userId: string | null,
): Promise<{ record?: BusinessRecord; error?: string }> {
  const sb = getSupabase();
  if (sb) {
    if (!userId) return { error: "Sign in to claim a listing." };
    const { data, error } = await sb
      .from("businesses")
      .insert({ owner_id: userId, activity_id: activityId, contact_name: contact.name, contact_email: contact.email })
      .select("*")
      .single();
    if (error) return { error: error.message };
    return { record: fromRow(data as Row) };
  }
  const record: BusinessRecord = {
    activityId,
    status: "pending",
    plan: "free",
    featured: false,
    listing: {},
    offers: [],
    photos: [],
    contactName: contact.name,
    contactEmail: contact.email,
    storage: "device",
  };
  saveDevice(record);
  return { record };
}

export async function saveBusiness(rec: BusinessRecord): Promise<{ error?: string }> {
  if (rec.storage === "cloud") {
    const sb = getSupabase();
    if (!sb || !rec.id) return { error: "Not connected to the database." };
    const { error } = await sb
      .from("businesses")
      .update({ listing: rec.listing, offers: rec.offers, photos: rec.photos, featured: rec.featured })
      .eq("id", rec.id);
    return error ? { error: error.message } : {};
  }
  saveDevice(rec);
  return {};
}

/** Downscale an uploaded image so device-mode photos fit in local storage. */
export async function resizeImage(file: File, max = 1200): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read image"))), "image/jpeg", 0.8));
}

export async function uploadPhoto(rec: BusinessRecord, file: File, userId: string | null): Promise<{ url?: string; error?: string }> {
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
  if (file.size > 15 * 1024 * 1024) return { error: "That image is over 15 MB. Try a smaller one." };
  let blob: Blob;
  try {
    blob = await resizeImage(file, rec.storage === "cloud" ? 1600 : 900);
  } catch {
    return { error: "Couldn't read that image. Try a JPG or PNG." };
  }
  if (rec.storage === "cloud") {
    const sb = getSupabase();
    if (!sb || !userId) return { error: "Sign in to upload photos." };
    const path = `${userId}/${rec.activityId}/${Date.now()}.jpg`;
    const { error } = await sb.storage.from("listing-photos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) return { error: error.message };
    return { url: sb.storage.from("listing-photos").getPublicUrl(path).data.publicUrl };
  }
  const url = await new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(blob);
  });
  return { url };
}

/** Merge a business's edits into a listing. Sponsored only when the plan allows featuring. */
export function applyOverlay(a: Activity, rec?: BusinessRecord): Activity {
  if (!rec) return a;
  const l = rec.listing;
  const offers = canOffer(rec.plan) ? rec.offers : [];
  const firstOffer = offers.find((o) => o.kind === "offer");
  return {
    ...a,
    name: l.name || a.name,
    summary: l.summary || a.summary,
    about: l.about || a.about,
    price: l.price !== undefined ? l.price : a.price,
    priceNote: l.priceNote ?? a.priceNote,
    hours: l.hours !== undefined ? l.hours : a.hours,
    website: l.website || a.website,
    phone: l.phone || a.phone,
    accessNote: l.accessNote || a.accessNote,
    deal: firstOffer ? firstOffer.title : a.deal,
    events: offers.filter((o) => o.kind === "event"),
    photos: rec.photos.length ? rec.photos : a.photos,
    sponsored: (rec.featured && canFeature(rec.plan)) || a.sponsored,
    source: a.source === "demo" ? "demo" : rec.status === "verified" ? "business" : a.source,
    provenance:
      rec.status === "verified"
        ? "Details provided and verified by the business."
        : `${a.provenance ?? ""} Edited by a claimant (verification pending).`.trim(),
  };
}
