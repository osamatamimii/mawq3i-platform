export default function AdvisorMascot({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mascotGlow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#52FF3F" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#52FF3F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mascotBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#232826" />
          <stop offset="100%" stopColor="#0e1210" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="115" rx="95" ry="95" fill="url(#mascotGlow)" />

      {/* antenna */}
      <line x1="100" y1="18" x2="100" y2="34" stroke="#3a423e" strokeWidth="3" />
      <circle cx="100" cy="14" r="6" fill="#52FF3F">
        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* head */}
      <rect x="45" y="34" width="110" height="90" rx="34" fill="url(#mascotBody)" stroke="#3a423e" strokeWidth="2" />
      {/* visor */}
      <rect x="60" y="58" width="80" height="42" rx="21" fill="#060809" />
      <ellipse cx="82" cy="79" rx="11" ry="14" fill="#52FF3F">
        <animate attributeName="ry" values="14;1;14" dur="4s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="118" cy="79" rx="11" ry="14" fill="#52FF3F">
        <animate attributeName="ry" values="14;1;14" dur="4s" repeatCount="indefinite" />
      </ellipse>

      {/* ears */}
      <rect x="34" y="66" width="12" height="26" rx="6" fill="#232826" stroke="#3a423e" strokeWidth="2" />
      <rect x="154" y="66" width="12" height="26" rx="6" fill="#232826" stroke="#3a423e" strokeWidth="2" />

      {/* body */}
      <rect x="55" y="128" width="90" height="70" rx="26" fill="url(#mascotBody)" stroke="#3a423e" strokeWidth="2" />
      {/* M badge */}
      <circle cx="100" cy="160" r="17" fill="#0c0f10" stroke="#52FF3F" strokeWidth="2" />
      <text x="100" y="167" textAnchor="middle" fontSize="16" fontWeight="900" fill="#52FF3F" fontFamily="sans-serif">M</text>

      {/* arms */}
      <circle cx="48" cy="150" r="13" fill="url(#mascotBody)" stroke="#3a423e" strokeWidth="2" />
      <circle cx="152" cy="150" r="13" fill="url(#mascotBody)" stroke="#3a423e" strokeWidth="2" />
    </svg>
  );
}
