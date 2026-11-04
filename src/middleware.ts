import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api|favicon|icon|maplibre-gl-worker|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs)$).*)"],
};
