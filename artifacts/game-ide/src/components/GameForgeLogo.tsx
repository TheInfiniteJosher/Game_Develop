interface GameForgeLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textSize?: "sm" | "md" | "lg" | "xl";
}

export function GameForgeLogo({ size = 40, className, showText = false, textSize = "md" }: GameForgeLogoProps) {
  const textSizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="gf-bg-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e1830" />
            <stop offset="100%" stopColor="#0e0c1a" />
          </linearGradient>
          <linearGradient id="gf-orange" x1="24" y1="8" x2="24" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="55%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <radialGradient id="gf-glow" cx="24" cy="28" r="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </radialGradient>
          <filter id="gf-spark-glow">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background rounded square */}
        <rect width="48" height="48" rx="12" fill="url(#gf-bg-grad)" />
        <rect width="48" height="48" rx="12" fill="url(#gf-glow)" />

        {/* Controller body */}
        <path
          d="M9 28 C9 20 14 18 18 18 L30 18 C34 18 39 20 39 28 C39 34 36 36 33 36 L30 36 L28 32 L20 32 L18 36 L15 36 C12 36 9 34 9 28 Z"
          fill="url(#gf-orange)"
        />

        {/* D-pad left side */}
        <rect x="14" y="25" width="7" height="2.5" rx="1.2" fill="#1e1830" />
        <rect x="16.75" y="22" width="2.5" height="7" rx="1.2" fill="#1e1830" />

        {/* Action buttons right side */}
        <circle cx="31" cy="23.5" r="1.8" fill="#1e1830" />
        <circle cx="31" cy="28.5" r="1.8" fill="#1e1830" />
        <circle cx="28.5" cy="26" r="1.8" fill="#1e1830" />
        <circle cx="33.5" cy="26" r="1.8" fill="#1e1830" />

        {/* Shoulder buttons hint */}
        <rect x="13" y="17" width="7" height="3" rx="2" fill="#EA580C" opacity="0.6" />
        <rect x="28" y="17" width="7" height="3" rx="2" fill="#EA580C" opacity="0.6" />

        {/* Forge flame above */}
        <path
          d="M22 15 C22 12 20 10 21 7 C22 5 24 6 24 6 C24 6 23 9 25 10 C27 8 26 5 28 4 C30 8 27 11 28 14 C29 12 30 12 30 12 C28 16 26 16 24 16 C22 16 20 15 20 14 C20 14 21 15 22 15 Z"
          fill="url(#gf-orange)"
          filter="url(#gf-spark-glow)"
        />

        {/* Sparks */}
        <circle cx="19" cy="11" r="1.2" fill="#FCD34D" opacity="0.9" filter="url(#gf-spark-glow)" />
        <circle cx="32" cy="10" r="0.9" fill="#FCD34D" opacity="0.75" filter="url(#gf-spark-glow)" />
        <path d="M35 13 L36.5 11 L36 13.5 L38 12" stroke="#FBBF24" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
      </svg>

      {showText && (
        <span className={`font-bold tracking-tight ${textSizes[textSize]} bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent`}>
          GameForge
        </span>
      )}
    </div>
  );
}
