export const Logo = ({ className = "w-64" }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 400 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {}
      {}
      
      <defs>
        <linearGradient id="GlyphConnect-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" /> 
          <stop offset="100%" stopColor="#a855f7" /> 
        </linearGradient>
      </defs>

      <g transform="translate(40, 30)">
        {}
        <rect x="0" y="20" width="6" height="20" rx="3" fill="url(#GlyphConnect-gradient)"/>
        <rect x="10" y="10" width="6" height="40" rx="3" fill="url(#GlyphConnect-gradient)"/>
        <rect x="20" y="0" width="6" height="60" rx="3" fill="url(#GlyphConnect-gradient)"/>
        <rect x="30" y="15" width="6" height="30" rx="3" fill="url(#GlyphConnect-gradient)"/>
        
        {}
        <path d="M48 20 C48 13.37 53.37 8 60 8 L72 8 C78.63 8 84 13.37 84 20 C84 26.63 78.63 32 72 32 L68 32" stroke="url(#GlyphConnect-gradient)" strokeWidth="8" strokeLinecap="round"/>
        <path d="M84 40 C84 46.63 78.63 52 72 52 L60 52 C53.37 52 48 46.63 48 40 C48 33.37 53.37 28 60 28 L64 28" stroke="url(#GlyphConnect-gradient)" strokeWidth="8" strokeLinecap="round"/>
      </g>

      <g transform="translate(140, 78)" fontFamily="sans-serif" fontWeight="bold" fontSize="48">
        <text x="0" y="0" fill="white">Stream</text>
        <text x="170" y="0" fill="url(#GlyphConnect-gradient)">Link</text>
      </g>
    </svg>
  );
};