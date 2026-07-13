function Arrow({ style, size = 12, color = '#27500A' }: { style: React.CSSProperties; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ position: 'absolute', ...style }}>
      <path d="M6,0 L11,9 L6,7 L1,9 Z" fill={color} />
    </svg>
  );
}

export default function AnimatedGlobe({ size = 260 }: { size?: number }) {
  const innerSize = Math.round(size * 0.807); // ~210 at size=260

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {/* Outer orbit ring */}
      <div className="mawq3i-orbit-a" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px dashed #97C459', opacity: 0.5 }}>
        <Arrow style={{ top: -6, left: '50%', marginLeft: -6 }} />
        <Arrow style={{ top: '50%', right: -6, marginTop: -6, transform: 'rotate(90deg)' }} />
        <Arrow style={{ bottom: -6, left: '20%', marginLeft: -6, transform: 'rotate(215deg)' }} />
      </div>

      {/* Inner orbit ring (reverse) */}
      <div className="mawq3i-orbit-b" style={{ position: 'absolute', inset: size * 0.06, borderRadius: '50%', border: '1px dashed #97C459', opacity: 0.32 }}>
        <Arrow size={10} color="#3B6D11" style={{ bottom: -5, left: '50%', marginLeft: -5, transform: 'rotate(180deg)' }} />
        <Arrow size={10} color="#3B6D11" style={{ top: '15%', left: -5, marginTop: -5, transform: 'rotate(270deg)' }} />
      </div>

      {/* Globe sphere */}
      <div
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#C0DD97',
          border: '1.5px solid #3B6D11',
        }}
      >
        {/* Scrolling continents map (seamless loop: two copies side by side) */}
        <svg
          className="mawq3i-globe-map"
          width={innerSize * 2.86}
          height={innerSize}
          viewBox="0 0 600 220"
          style={{ display: 'block', position: 'absolute', top: -innerSize * 0.024, left: 0 }}
        >
          {[0, 300].map((offset) => (
            <g key={offset} fill="#3B6D11" transform={`translate(${offset},0)`}>
              <path d="M20,55 C35,40 60,38 78,50 C90,58 88,78 75,88 C82,100 78,118 62,124 C48,118 42,100 48,88 C30,84 15,70 20,55 Z" />
              <path d="M55,130 C68,126 80,138 78,155 C82,168 74,185 62,192 C52,182 50,165 55,150 Z" />
              <path d="M148,45 C160,40 172,46 170,58 C178,62 176,72 166,72 C156,68 148,58 148,45 Z" />
              <path d="M138,78 C158,72 176,82 174,102 C180,118 172,140 158,158 C144,150 138,128 142,108 C132,98 132,86 138,78 Z" />
              <path d="M188,35 C215,25 250,30 272,45 C288,55 282,72 262,78 C270,90 258,102 240,98 C222,108 200,102 194,86 C182,78 180,52 188,35 Z" />
              <path d="M238,158 C252,152 268,158 268,170 C270,180 258,188 246,184 C236,178 232,166 238,158 Z" />
            </g>
          ))}
        </svg>

        {/* Latitude / longitude grid */}
        <svg width={innerSize} height={innerSize} viewBox="0 0 210 210" style={{ position: 'absolute', top: 0, left: 0 }}>
          <ellipse cx="105" cy="105" rx="105" ry="34" fill="none" stroke="#173404" strokeWidth="0.6" opacity="0.3" />
          <ellipse cx="105" cy="105" rx="105" ry="65" fill="none" stroke="#173404" strokeWidth="0.6" opacity="0.25" />
          <line x1="0" y1="105" x2="210" y2="105" stroke="#173404" strokeWidth="0.6" opacity="0.25" />
        </svg>

        {/* Light highlight */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: '#EAF3DE',
            opacity: 0.2,
            WebkitMaskImage: 'radial-gradient(circle at 30% 26%, black 0%, transparent 52%)',
            maskImage: 'radial-gradient(circle at 30% 26%, black 0%, transparent 52%)',
          }}
        />
        {/* Inner edge shadow for depth */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            boxShadow: 'inset -16px -12px 0 -6px rgba(0,0,0,0.10)',
          }}
        />
      </div>

      <style>{`
        @keyframes mawq3i-scrollmap { from { transform: translateX(0); } to { transform: translateX(-${innerSize}px); } }
        @keyframes mawq3i-orbitspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mawq3i-globe-map { animation: mawq3i-scrollmap 16s linear infinite; }
        .mawq3i-orbit-a { animation: mawq3i-orbitspin 14s linear infinite; }
        .mawq3i-orbit-b { animation: mawq3i-orbitspin 20s linear infinite reverse; }
      `}</style>
    </div>
  );
}
