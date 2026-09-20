"use client";
// Avatar IA animé — AXIA, l'assistante Axso
// 3 états : idle (respiration), thinking (ondes), speaking (ripple)

interface AgentAvatarProps {
  state?: "idle" | "thinking" | "speaking";
  size?: number;
}

export function AgentAvatar({ state = "idle", size = 80 }: AgentAvatarProps) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.32;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: s, height: s }}
      aria-label="AXIA — Assistante IA Axso"
    >
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Gradient principal */}
          <radialGradient id="axia-core" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFD080"/>
            <stop offset="45%" stopColor="#F5A623"/>
            <stop offset="100%" stopColor="#e8950f"/>
          </radialGradient>

          {/* Glow filter */}
          <filter id="axia-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={s * 0.06} result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>

          {/* Glow for rings */}
          <filter id="ring-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={s * 0.025} result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>

          {/* Shimmer gradient */}
          <linearGradient id="axia-shimmer" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)"/>
            <stop offset="50%" stopColor="rgba(255,255,255,0.1)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0.4)"/>
          </linearGradient>
        </defs>

        {/* ─── Rings externes ─────────────────────────────────────── */}
        {[1, 2, 3].map((i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r + (i * s * 0.1)}
            stroke="#F5A623"
            strokeWidth={state === "thinking" ? 1.5 : 1}
            fill="none"
            opacity={0.15 / i}
            filter="url(#ring-glow)"
            style={{
              animation: state === "thinking"
                ? `axiaRipple ${1.2 + i * 0.4}s ease-out ${i * 0.25}s infinite`
                : state === "speaking"
                ? `axiaPulse ${0.8 + i * 0.2}s ease-in-out ${i * 0.1}s infinite`
                : `axiaBreathe ${3 + i * 0.8}s ease-in-out ${i * 0.5}s infinite`,
            }}
          />
        ))}

        {/* ─── Sphère principale ──────────────────────────────────── */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="url(#axia-core)"
          filter="url(#axia-glow)"
          style={{
            animation: state === "thinking"
              ? `axiaRotate 2s linear infinite`
              : state === "speaking"
              ? `axiaBounce 0.6s ease-in-out infinite`
              : `axiaBreatheCore 4s ease-in-out infinite`,
          }}
        />

        {/* ─── Reflet/brillance ────────────────────────────────────── */}
        <ellipse
          cx={cx - r * 0.2}
          cy={cy - r * 0.3}
          rx={r * 0.45}
          ry={r * 0.28}
          fill="url(#axia-shimmer)"
          opacity={0.55}
          style={{
            animation: state === "thinking"
              ? `axiaRotate 2s linear infinite`
              : "none",
          }}
        />

        {/* ─── Icône centrale selon l'état ────────────────────────── */}
        {state === "idle" && (
          <g>
            {/* Étoile / sparkle */}
            <path
              d={`M${cx} ${cy - r * 0.4} L${cx + r * 0.12} ${cy - r * 0.08} L${cx + r * 0.4} ${cy - r * 0.06} L${cx + r * 0.18} ${cy + r * 0.18} L${cx + r * 0.24} ${cy + r * 0.44} L${cx} ${cy + r * 0.28} L${cx - r * 0.24} ${cy + r * 0.44} L${cx - r * 0.18} ${cy + r * 0.18} L${cx - r * 0.4} ${cy - r * 0.06} L${cx - r * 0.12} ${cy - r * 0.08} Z`}
              fill="white"
              opacity={0.9}
            />
          </g>
        )}

        {state === "thinking" && (
          <g>
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={cx + (i - 1) * r * 0.38}
                cy={cy}
                r={r * 0.14}
                fill="white"
                opacity={0.9}
                style={{ animation: `axiaDot 1s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </g>
        )}

        {state === "speaking" && (
          <g>
            {/* Sound waves */}
            {[1, 2, 3].map((i) => (
              <path
                key={i}
                d={`M${cx - r * 0.05} ${cy - r * 0.3 * i * 0.35} Q${cx + r * 0.25 * i * 0.4} ${cy} ${cx - r * 0.05} ${cy + r * 0.3 * i * 0.35}`}
                stroke="white"
                strokeWidth={r * 0.08}
                fill="none"
                opacity={0.9 - i * 0.2}
                strokeLinecap="round"
                style={{ animation: `axiaSoundWave ${0.7 + i * 0.1}s ease-in-out ${i * 0.1}s infinite` }}
              />
            ))}
          </g>
        )}
      </svg>

      {/* Label AXIA */}
      {size >= 60 && (
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-widest uppercase whitespace-nowrap"
          style={{ color: "#d4820a" }}
        >
          AXIA
        </div>
      )}

      <style>{`
        @keyframes axiaBreathe {
          0%, 100% { transform: scale(1);   opacity: 0.15; }
          50%       { transform: scale(1.08); opacity: 0.25; }
        }
        @keyframes axiaBreatheCore {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.04); }
        }
        @keyframes axiaRipple {
          0%   { transform: scale(0.85); opacity: 0.5; }
          100% { transform: scale(1.6);  opacity: 0; }
        }
        @keyframes axiaPulse {
          0%, 100% { transform: scale(1);    opacity: 0.2; }
          50%       { transform: scale(1.15); opacity: 0.4; }
        }
        @keyframes axiaBounce {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.06) translateY(-2px); }
        }
        @keyframes axiaRotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes axiaDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
        @keyframes axiaSoundWave {
          0%, 100% { transform: scaleX(1);   opacity: 0.8; }
          50%       { transform: scaleX(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
