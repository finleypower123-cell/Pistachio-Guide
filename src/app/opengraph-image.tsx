import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

/** The picture shown when a link to the site is shared: the mark, the name and the tagline in brand colours. */
export const alt = `${SITE_NAME}: find the fun stuff near you`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#254C38", color: "#F7F5EC", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="112" height="112" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="16" fill="#F7F5EC" />
            <g transform="rotate(-28 32 33)">
              <ellipse cx="32" cy="33" rx="15" ry="20" fill="#254C38" />
              <path d="M32 15c-6 5-9 11-9 18s3 13 9 18c6-5 9-11 9-18s-3-13-9-18z" fill="#A8C686" />
            </g>
          </svg>
          <div style={{ fontSize: 56, fontWeight: 700 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 112, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>Find the fun stuff.</div>
          <div style={{ marginTop: 28, fontSize: 40, color: "#A8C686" }}>Hidden gems, weird little adventures and brilliant things to do near you.</div>
        </div>
      </div>
    ),
    size,
  );
}
