import '../styles/animals.css';

/** Animated Fox — for children section */
export function FoxCharacter({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="animal-fox" aria-label="Лисёнок">
      {/* Body */}
      <ellipse cx="60" cy="85" rx="28" ry="22" fill="#FF8C42" />
      {/* Belly */}
      <ellipse cx="60" cy="88" rx="16" ry="14" fill="#FFD5A8" />
      {/* Head */}
      <ellipse cx="60" cy="54" rx="26" ry="24" fill="#FF8C42" />
      {/* Ears */}
      <polygon points="36,38 28,16 48,32" fill="#FF8C42" />
      <polygon points="84,38 92,16 72,32" fill="#FF8C42" />
      <polygon points="38,36 32,20 47,31" fill="#FF5C5C" />
      <polygon points="82,36 88,20 73,31" fill="#FF5C5C" />
      {/* Face white patch */}
      <ellipse cx="60" cy="58" rx="16" ry="14" fill="#FFD5A8" />
      {/* Eyes */}
      <circle cx="52" cy="50" r="5" fill="#2D2D2D" />
      <circle cx="68" cy="50" r="5" fill="#2D2D2D" />
      <circle cx="54" cy="48" r="2" fill="white" />
      <circle cx="70" cy="48" r="2" fill="white" />
      {/* Nose */}
      <ellipse cx="60" cy="58" rx="4" ry="3" fill="#CC4444" />
      {/* Mouth */}
      <path d="M56,62 Q60,66 64,62" stroke="#CC4444" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Cheeks */}
      <circle cx="46" cy="58" r="5" fill="rgba(255,150,100,0.4)" />
      <circle cx="74" cy="58" r="5" fill="rgba(255,150,100,0.4)" />
      {/* Tail */}
      <ellipse cx="84" cy="96" rx="12" ry="8" fill="#FF8C42" transform="rotate(-30 84 96)" />
      <ellipse cx="90" cy="93" rx="6" ry="4" fill="#FFD5A8" transform="rotate(-30 90 93)" />
      {/* Paws */}
      <ellipse cx="44" cy="104" rx="8" ry="5" fill="#FF8C42" />
      <ellipse cx="76" cy="104" rx="8" ry="5" fill="#FF8C42" />
    </svg>
  );
}

/** Animated Bear — for parents section */
export function BearCharacter({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="animal-bear" aria-label="Медвежонок">
      {/* Body */}
      <ellipse cx="60" cy="86" rx="27" ry="22" fill="#C8956C" />
      {/* Belly */}
      <ellipse cx="60" cy="90" rx="16" ry="13" fill="#E8C4A0" />
      {/* Head */}
      <circle cx="60" cy="52" r="26" fill="#C8956C" />
      {/* Ears */}
      <circle cx="38" cy="30" r="11" fill="#C8956C" />
      <circle cx="82" cy="30" r="11" fill="#C8956C" />
      <circle cx="38" cy="30" r="7" fill="#A06040" />
      <circle cx="82" cy="30" r="7" fill="#A06040" />
      {/* Snout */}
      <ellipse cx="60" cy="60" rx="14" ry="11" fill="#E8C4A0" />
      {/* Eyes */}
      <circle cx="51" cy="48" r="5.5" fill="#2D2D2D" />
      <circle cx="69" cy="48" r="5.5" fill="#2D2D2D" />
      <circle cx="53" cy="46" r="2" fill="white" />
      <circle cx="71" cy="46" r="2" fill="white" />
      {/* Nose */}
      <ellipse cx="60" cy="57" rx="5" ry="3.5" fill="#5C3317" />
      {/* Mouth */}
      <path d="M56,62 Q60,67 64,62" stroke="#5C3317" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Cheeks */}
      <circle cx="45" cy="57" r="6" fill="rgba(220,120,80,0.35)" />
      <circle cx="75" cy="57" r="6" fill="rgba(220,120,80,0.35)" />
      {/* Arms */}
      <ellipse cx="36" cy="86" rx="9" ry="14" fill="#C8956C" transform="rotate(-15 36 86)" />
      <ellipse cx="84" cy="86" rx="9" ry="14" fill="#C8956C" transform="rotate(15 84 86)" />
      {/* Paws */}
      <ellipse cx="46" cy="106" rx="9" ry="6" fill="#C8956C" />
      <ellipse cx="74" cy="106" rx="9" ry="6" fill="#C8956C" />
      {/* Heart on belly */}
      <path d="M57,88 C57,85 53,83 53,87 C53,91 60,95 60,95 C60,95 67,91 67,87 C67,83 63,85 63,88 C63,85 57,85 57,88Z" fill="rgba(255,107,107,0.5)" />
    </svg>
  );
}

/** Animated Owl — for therapist section */
export function OwlCharacter({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="animal-owl" aria-label="Сова">
      {/* Body */}
      <ellipse cx="60" cy="82" rx="26" ry="28" fill="#8B6FBE" />
      {/* Belly pattern */}
      <ellipse cx="60" cy="86" rx="16" ry="18" fill="#D4C5ED" />
      {/* Belly lines */}
      <path d="M54,76 Q60,79 66,76" stroke="#8B6FBE" strokeWidth="1.2" fill="none" />
      <path d="M52,82 Q60,86 68,82" stroke="#8B6FBE" strokeWidth="1.2" fill="none" />
      <path d="M54,88 Q60,92 66,88" stroke="#8B6FBE" strokeWidth="1.2" fill="none" />
      {/* Wings */}
      <ellipse cx="34" cy="84" rx="12" ry="20" fill="#6B4FA0" transform="rotate(-10 34 84)" />
      <ellipse cx="86" cy="84" rx="12" ry="20" fill="#6B4FA0" transform="rotate(10 86 84)" />
      {/* Head */}
      <circle cx="60" cy="46" r="26" fill="#8B6FBE" />
      {/* Ear tufts */}
      <polygon points="46,26 40,10 52,22" fill="#6B4FA0" />
      <polygon points="74,26 80,10 68,22" fill="#6B4FA0" />
      {/* Eye circles */}
      <circle cx="50" cy="46" r="12" fill="#FFE066" />
      <circle cx="70" cy="46" r="12" fill="#FFE066" />
      <circle cx="50" cy="46" r="8" fill="#2D2D2D" />
      <circle cx="70" cy="46" r="8" fill="#2D2D2D" />
      <circle cx="53" cy="43" r="3" fill="white" />
      <circle cx="73" cy="43" r="3" fill="white" />
      {/* Beak */}
      <polygon points="60,52 55,58 65,58" fill="#FFB347" />
      {/* Graduation cap */}
      <rect x="38" y="23" width="44" height="5" rx="2" fill="#3D2D6B" />
      <polygon points="60,10 38,23 82,23" fill="#3D2D6B" />
      <line x1="82" y1="23" x2="90" y2="30" stroke="#3D2D6B" strokeWidth="2" />
      <circle cx="90" cy="32" r="4" fill="#FFE066" />
      {/* Feet */}
      <path d="M48,108 L44,116 M48,108 L48,116 M48,108 L52,116" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M72,108 L68,116 M72,108 L72,116 M72,108 L76,116" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Star decoration */
export function StarDecor({ color = '#FFE066', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="star-decor" aria-hidden>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill={color} />
    </svg>
  );
}

/** Floating hearts */
export function HeartDecor({ color = '#FF6B6B', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="heart-decor" aria-hidden>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill={color} />
    </svg>
  );
}

/** Note / music note for speech */
export function NoteDecor({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="note-decor" aria-hidden>
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="#FF8C42" />
    </svg>
  );
}
