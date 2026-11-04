export function PistachioMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#254C38" />
      <g transform="rotate(-28 32 33)">
        <ellipse cx="32" cy="33" rx="15" ry="20" fill="#F7F5EC" />
        <path d="M32 15c-6 5-9 11-9 18s3 13 9 18c6-5 9-11 9-18s-3-13-9-18z" fill="#A8C686" />
        <path d="M32 18v30" stroke="#254C38" strokeWidth="2" strokeLinecap="round" opacity=".35" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <PistachioMark />
      <span className="font-display text-[1.2rem] font-bold leading-none tracking-tight max-[380px]:sr-only">
        Pistachio<span className="text-accent-ink max-sm:hidden"> Guide</span>
      </span>
    </span>
  );
}
