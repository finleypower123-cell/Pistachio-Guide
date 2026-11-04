/**
 * Business subscription plans. Billing isn't wired up in this build: choosing a plan in the
 * dashboard previews its features and is clearly marked as such. To launch, create matching
 * Stripe prices and set STRIPE_PRICE_* env vars (see README).
 */
export type PlanId = "free" | "local" | "featured";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  pitch: string;
  features: string[];
}

export const PLANS: Plan[] = [
  { id: "free", name: "Free", priceMonthly: 0, pitch: "Claim and keep your listing accurate.", features: ["Claim your listing", "Edit details and hours", "Up to 5 photos", "Basic view counts"] },
  { id: "local", name: "Local", priceMonthly: 19, pitch: "Bring people in with offers and events.", features: ["Everything in Free", "Unlimited photos", "Offers and local deals", "Promote events", "Full analytics", "Booking link"] },
  { id: "featured", name: "Featured", priceMonthly: 49, pitch: "Appear in featured slots near you.", features: ["Everything in Local", "Rotation in Featured partner slots", "Always labelled “Sponsored”", "Monthly performance report"] },
];

export const canFeature = (plan: PlanId) => plan === "featured";
export const canOffer = (plan: PlanId) => plan !== "free";
