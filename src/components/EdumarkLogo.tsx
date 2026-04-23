/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * EdumarkLogo — a custom monogram for EduMark.
 *
 * The mark is a rounded square badge containing a minimalist "E" built
 * from three horizontal strokes. The middle stroke is intentionally
 * shorter and is terminated by a small accent dot — the "mark."
 *
 * Variants:
 *   "light"   → blue badge, light strokes, sky dot (on brand panels)
 *   "dark"    → white badge, ink strokes, brand dot (light navs / paper)
 *   "outline" → transparent badge, ink strokes, brand dot
 */

interface EdumarkLogoProps {
  size?: number;
  variant?: "light" | "dark" | "outline";
  className?: string;
  title?: string;
}

export default function EdumarkLogo({
  size = 40,
  variant = "light",
  className,
  title = "EduMark",
}: EdumarkLogoProps) {
  const palette =
    variant === "dark"
      ? { bg: "#ffffff", stroke: "#0c1222", accent: "#06b6d4", ring: "#e2e8f0" }
      : variant === "outline"
      ? { bg: "transparent", stroke: "#0c1222", accent: "#06b6d4", ring: "#0c1222" }
      : { bg: "#0070f3", stroke: "#f8fafc", accent: "#22d3ee", ring: "#005ae0" };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      {/* Badge */}
      <rect
        x="1"
        y="1"
        width="42"
        height="42"
        rx="11"
        fill={palette.bg}
        stroke={variant === "outline" ? palette.ring : "transparent"}
        strokeWidth={variant === "outline" ? 1.5 : 0}
      />

      {/* Inner hairline ring */}
      <rect
        x="4.5"
        y="4.5"
        width="35"
        height="35"
        rx="8"
        fill="none"
        stroke={palette.ring}
        strokeOpacity={variant === "light" ? 0.35 : variant === "dark" ? 0.5 : 0}
        strokeWidth="1"
      />

      {/* Top stroke of the E */}
      <rect x="11" y="11" width="20" height="4" rx="2" fill={palette.stroke} />

      {/* Middle stroke — intentionally shorter */}
      <rect x="11" y="20" width="13" height="4" rx="2" fill={palette.stroke} />

      {/* Bottom stroke */}
      <rect x="11" y="29" width="20" height="4" rx="2" fill={palette.stroke} />

      {/* The "mark" dot on the middle stroke */}
      <circle cx="28.5" cy="22" r="2.4" fill={palette.accent} />
    </svg>
  );
}

/**
 * EdumarkWordmark — pairs the monogram with the EduMark wordmark set in
 * Wordmark: accent "m" echoes the logo dot.
 */
export function EdumarkWordmark({
  size = 28,
  variant = "light",
  className,
}: {
  size?: number;
  variant?: "light" | "dark" | "outline";
  className?: string;
}) {
  return (
    <span
      className={
        "flex items-center gap-2.5 " + (className ?? "")
      }
    >
      <EdumarkLogo size={size} variant={variant} />
      <span
        className={
          "font-sans text-[1.35rem] leading-none tracking-tight " +
          (variant === "dark" || variant === "outline"
            ? "text-ink"
            : "text-paper")
        }
        style={{ fontWeight: 600 }}
      >
        Edu<span className="text-gradient-cool" style={{ fontWeight: 700 }}>m</span>ark
      </span>
    </span>
  );
}
