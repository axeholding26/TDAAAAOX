"use client";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "countdown3" | "countdown2" | "countdown1" | "ignition" | "launch" | "cloud" | "space" | "orbit";

const STARS = Array.from({ length: 200 }, (_, i) => ({
  x: ((i * 37 + 13) % 100), y: ((i * 71 + 29) % 100),
  r: 0.3 + ((i * 53) % 12) * 0.13,
  delay: ((i * 17) % 30) * 0.1,
  dur: 1.5 + ((i * 23) % 18) * 0.15,
  opacity: 0.2 + ((i * 11) % 8) * 0.09,
  bright: i % 7 === 0,
}));

const DEEP_STARS = Array.from({ length: 60 }, (_, i) => ({
  x: ((i * 97 + 43) % 100), y: ((i * 53 + 7) % 100),
  r: 0.8 + ((i * 31) % 6) * 0.2,
  delay: ((i * 41) % 25) * 0.1,
  dur: 2 + ((i * 19) % 15) * 0.2,
}));

export function RocketLaunch3D() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [altitude, setAltitude] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [cameraShake, setCameraShake] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const altRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !hasTriggered.current) {
        hasTriggered.current = true;
        obs.disconnect();
        const t = (ms: number, fn: () => void) => setTimeout(fn, ms);
        t(600,  () => setPhase("countdown3"));
        t(1500, () => setPhase("countdown2"));
        t(2400, () => setPhase("countdown1"));
        t(3300, () => { setPhase("ignition"); setCameraShake(1); });
        t(3800, () => { setPhase("launch"); setCameraShake(2); });
        t(4800, () => setCameraShake(0));
        t(6500, () => setPhase("cloud"));
        t(8500, () => setPhase("space"));
        t(11000, () => { setPhase("orbit"); setCameraShake(0); });
      }
    }, { threshold: 0.3 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  // Altitude + speed counter
  useEffect(() => {
    if (phase === "launch" || phase === "cloud" || phase === "space") {
      altRef.current = setInterval(() => {
        setAltitude(prev => {
          const target = phase === "space" ? 280 : phase === "cloud" ? 12 : 5;
          if (prev >= target) return prev;
          const step = phase === "space" ? 8 : phase === "cloud" ? 1 : 0.3;
          return Math.min(prev + step, target);
        });
        setSpeed(prev => {
          const target = phase === "space" ? 5000 : 800;
          if (prev >= target) return prev;
          return Math.min(prev + (phase === "space" ? 150 : 25), target);
        });
      }, 100);
    }
    return () => clearInterval(altRef.current);
  }, [phase]);

  const isLaunching = phase === "launch" || phase === "cloud" || phase === "space" || phase === "orbit";
  const isInSpace = phase === "space" || phase === "orbit";
  const showFlame = phase === "ignition" || isLaunching;

  const rocketStyle: React.CSSProperties = {
    transform: isLaunching
      ? `translateY(${phase === "orbit" ? "-200vh" : phase === "space" ? "-160vh" : phase === "cloud" ? "-80vh" : "-40vh"}) scale(${phase === "orbit" ? 0.15 : phase === "space" ? 0.4 : 1})`
      : "translateY(0)",
    transition: isLaunching
      ? `transform ${phase === "orbit" ? "3s" : phase === "space" ? "3.5s" : phase === "cloud" ? "2.5s" : "2s"} ${phase === "orbit" ? "cubic-bezier(0.2,0,0.4,1)" : "cubic-bezier(0.22,0.85,0.1,1)"}`
      : "none",
    animation: phase === "ignition" ? "rocketShake .12s ease-in-out infinite" : (phase === "launch" ? "rocketShake .08s ease-in-out infinite" : "none"),
    willChange: "transform",
  };

  const shakeStyle: React.CSSProperties = cameraShake > 0 ? {
    animation: `camShake ${cameraShake === 2 ? "0.08s" : "0.15s"} ease-in-out infinite`,
  } : {};

  const countdownMap: Record<string, string> = {
    countdown3: "T – 3", countdown2: "T – 2", countdown1: "T – 1",
    ignition: "IGNITION", launch: "LIFTOFF", cloud: "ALTITUDE",
    space: "MAX-Q", orbit: "ORBITE",
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden" style={{
      height: "100vh",
      background: "linear-gradient(to bottom, #000308 0%, #010818 25%, #020C20 55%, #041228 100%)",
      ...shakeStyle,
    }}>

      {/* ── Deep star field ── */}
      <div className="absolute inset-0 pointer-events-none">
        {STARS.map((s, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: `${s.r * 2}px`, height: `${s.r * 2}px`,
            opacity: isInSpace ? Math.min(s.opacity * 2.5, 1) : s.opacity,
            transition: "opacity 2s",
            animation: `starTwinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
            boxShadow: s.bright ? `0 0 ${s.r * 4}px rgba(255,255,255,0.8)` : "none",
          }}/>
        ))}
      </div>

      {/* ── Nebula clouds ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { top:"8%", left:"8%", w:500, h:350, color:"rgba(27,79,216,0.07)", dur:13, delay:0 },
          { top:"55%", right:"6%", w:420, h:300, color:"rgba(124,58,237,0.055)", dur:17, delay:4 },
          { top:"35%", left:"42%", w:600, h:250, color:"rgba(27,79,216,0.04)", dur:22, delay:7 },
        ].map((n,i) => (
          <div key={i} className="absolute rounded-full" style={{
            top: n.top, left: (n as any).left, right: (n as any).right,
            width: n.w, height: n.h,
            background: `radial-gradient(ellipse, ${n.color} 0%, transparent 70%)`,
            filter: "blur(50px)",
            animation: `nebulaDrift ${n.dur}s ease-in-out ${n.delay}s infinite`,
            opacity: isInSpace ? 0.3 : 1, transition: "opacity 3s",
          }}/>
        ))}
      </div>

      {/* ── Star streaks in space ── */}
      {isInSpace && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {DEEP_STARS.map((s, i) => (
            <div key={i} className="absolute bg-white" style={{
              left: `${s.x}%`, top: `${s.y}%`,
              width: `${20 + i * 5}px`, height: "1px",
              opacity: 0.12 + (i % 5) * 0.04,
              animation: `starStreak .9s ${s.delay * 0.05}s linear infinite`,
            }}/>
          ))}
        </div>
      )}

      {/* ── Aurora borealis in space ── */}
      {isInSpace && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ animation: "auroraFadeIn 2s ease both" }}>
          {[
            { color:"rgba(27,79,216,0.12)", top:"15%", left:"-10%", w:"60%", h:"20%" },
            { color:"rgba(52,211,153,0.06)", top:"22%", left:"30%", w:"70%", h:"18%" },
            { color:"rgba(124,58,237,0.08)", top:"10%", left:"20%", w:"50%", h:"25%" },
          ].map((a,i) => (
            <div key={i} className="absolute" style={{
              top: a.top, left: a.left, width: a.w, height: a.h,
              background: `linear-gradient(180deg, transparent, ${a.color}, transparent)`,
              filter: "blur(30px)",
              animation: `auroraWave ${8+i*3}s ease-in-out ${i*2}s infinite`,
            }}/>
          ))}
        </div>
      )}

      {/* ── Earth horizon ── */}
      <div className="absolute bottom-0 left-1/2 pointer-events-none" style={{
        transform: "translateX(-50%) translateY(68%)",
        width: "1000px", height: "500px",
        background: "radial-gradient(ellipse at 50% 28%, #1B4FD8 0%, #0D2A6B 38%, #061428 62%, transparent 80%)",
        borderRadius: "50%",
        opacity: isInSpace ? 0.12 : 0.55, transition: "opacity 3s ease",
        filter: "blur(1px)",
      }}/>
      <div className="absolute bottom-0 left-1/2 pointer-events-none" style={{
        transform: "translateX(-50%) translateY(62%)",
        width: "1100px", height: "350px",
        background: "radial-gradient(ellipse at 50% 18%, rgba(75,123,255,0.25) 0%, rgba(27,79,216,0.08) 45%, transparent 70%)",
        borderRadius: "50%",
        opacity: isInSpace ? 0 : 1, transition: "opacity 2.5s ease", filter: "blur(20px)",
      }}/>

      {/* ── Cloud layer ── */}
      {(phase === "cloud" || phase === "space" || phase === "orbit") && (
        <div className="absolute left-0 right-0 pointer-events-none" style={{
          top: "50%", height: "80px",
          background: "linear-gradient(180deg, transparent, rgba(180,200,230,0.15), rgba(200,220,245,0.2), rgba(180,200,230,0.15), transparent)",
          filter: "blur(12px)",
          animation: "cloudPass 3s ease both",
        }}/>
      )}

      {/* ── Mission badge ── */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30" style={{
        opacity: phase === "orbit" ? 0 : 1, transition: "opacity 1s",
      }}>
        <div className="inline-flex items-center gap-3 px-5 py-2.5 backdrop-blur-md" style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "100px",
        }}>
          <span className="w-2 h-2 rounded-full bg-[#1B4FD8]" style={{
            animation: phase !== "idle" ? "dotPulse 1s ease-in-out infinite" : "none",
            boxShadow: "0 0 8px #1B4FD8",
          }}/>
          <span className="text-sm font-medium tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.6)" }}>
            {phase === "idle" ? "Mission AXSO · En attente"
              : countdownMap[phase] ?? "Mission AXSO"}
          </span>
          {(phase === "launch" || phase === "cloud" || phase === "space") && (
            <span className="text-xs font-bold" style={{ color: "#34d399" }}>● LIVE</span>
          )}
        </div>
      </div>

      {/* ── Telemetry HUD (masqué sur mobile) ── */}
      {(isLaunching) && (
        <div className="absolute top-20 right-4 sm:right-8 z-30 space-y-2 hidden sm:block" style={{ animation: "hudFadeIn .5s ease both" }}>
          {[
            { label: "ALT", val: `${altitude < 10 ? altitude.toFixed(1) : Math.round(altitude)} km`, color: "#7B9EFF" },
            { label: "SPD", val: `${speed < 1000 ? speed.toFixed(0) : (speed/1000).toFixed(2)+"k"} m/s`, color: "#34d399" },
            { label: "STA", val: phase === "orbit" ? "ORBITE" : phase === "space" ? "MAX-Q" : phase === "cloud" ? "ASCENT" : "T+0:00", color: "#fb923c" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 backdrop-blur-md" style={{
              background: "rgba(0,0,0,0.5)", border: `1px solid ${item.color}30`, borderRadius: "8px",
              minWidth: "130px",
            }}>
              <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>{item.label}</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: item.color, fontFamily: "monospace", marginLeft: "auto" }}>{item.val}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Countdown display ── */}
      {(phase === "countdown3" || phase === "countdown2" || phase === "countdown1") && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div style={{ animation: "countdownAnim .6s cubic-bezier(0.23,1,0.32,1) both" }}>
            <span style={{
              fontSize: "clamp(100px, 20vw, 180px)",
              fontWeight: 900,
              fontFamily: "monospace",
              color: "transparent",
              WebkitTextStroke: `2px ${phase === "countdown1" ? "#ff6b6b" : "#1B4FD8"}`,
              textShadow: `0 0 60px ${phase === "countdown1" ? "rgba(255,107,107,0.4)" : "rgba(27,79,216,0.4)"}`,
              letterSpacing: "-8px",
              display: "block",
              lineHeight: 1,
            }}>
              {phase === "countdown3" ? "3" : phase === "countdown2" ? "2" : "1"}
            </span>
          </div>
        </div>
      )}
      {phase === "ignition" && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div style={{ animation: "ignitionFlash .4s ease both" }}>
            <span style={{
              fontSize: "clamp(40px, 8vw, 72px)",
              fontWeight: 900, letterSpacing: "0.25em",
              color: "#FB923C",
              textShadow: "0 0 40px rgba(251,146,60,0.8), 0 0 80px rgba(251,146,60,0.4)",
              fontFamily: "monospace",
            }}>
              IGNITION
            </span>
          </div>
        </div>
      )}

      {/* ── Rocket assembly ── */}
      <div className="absolute left-1/2 z-10 rocket-wrap" style={{ bottom: "22%", transform: "translateX(-50%)" }}>
        <div style={rocketStyle}>

          {/* Rocket SVG */}
          <svg width="160" height="300" viewBox="0 0 160 300" fill="none" xmlns="http://www.w3.org/2000/svg" style={{
            filter: showFlame
              ? "drop-shadow(0 0 30px rgba(27,79,216,0.9)) drop-shadow(0 0 80px rgba(75,123,255,0.5))"
              : "drop-shadow(0 8px 30px rgba(0,0,0,0.6))",
            transition: "filter 0.4s",
            display: "block",
          }}>
            {/* Support arms (retract on ignition) */}
            {(phase === "idle" || phase === "countdown3" || phase === "countdown2" || phase === "countdown1") && (
              <>
                <line x1="80" y1="200" x2="20" y2="220" stroke="#1B4FD8" strokeWidth="3" opacity="0.4"/>
                <line x1="80" y1="200" x2="140" y2="220" stroke="#1B4FD8" strokeWidth="3" opacity="0.4"/>
                <rect x="8" y="216" width="20" height="4" rx="2" fill="#1B4FD8" opacity="0.35"/>
                <rect x="132" y="216" width="20" height="4" rx="2" fill="#1B4FD8" opacity="0.35"/>
              </>
            )}

            {/* ── Rocket body ── */}
            <path d="M80 14 C58 14 40 56 37 104 L37 200 L123 200 L123 104 C120 56 102 14 80 14Z" fill="#1B4FD8"/>
            <path d="M80 14 C64 14 50 48 47 82 L113 82 C110 48 96 14 80 14Z" fill="#1440BE"/>
            <path d="M80 14 C70 14 60 32 58 54 L102 54 C100 32 90 14 80 14Z" fill="#1030A0"/>

            {/* Body panel lines */}
            <line x1="37" y1="108" x2="123" y2="108" stroke="#1030A0" strokeWidth="0.8" opacity="0.5"/>
            <line x1="37" y1="140" x2="123" y2="140" stroke="#1030A0" strokeWidth="0.8" opacity="0.4"/>
            <line x1="37" y1="168" x2="123" y2="168" stroke="#1030A0" strokeWidth="0.8" opacity="0.35"/>

            {/* Longitudinal stripe */}
            <rect x="77" y="14" width="6" height="186" fill="white" opacity="0.04"/>

            {/* Specular shine */}
            <path d="M46 52 C44 72 44 105 46 136 L56 134 L56 50Z" fill="white" opacity="0.08"/>
            <path d="M48 58 C47 76 47 105 48 130 L52 129 L52 57Z" fill="white" opacity="0.06"/>

            {/* Main porthole */}
            <circle cx="80" cy="108" r="22" fill="white" opacity="0.08"/>
            <circle cx="80" cy="108" r="19" fill="#050E28"/>
            <circle cx="80" cy="108" r="16" fill="#0A1E50"/>
            <circle cx="80" cy="108" r="12" fill="#1B4FD8"/>
            <circle cx="80" cy="108" r="9" fill="#3A6AE8"/>
            <circle cx="80" cy="108" r="5" fill="#7B9EFF" opacity="0.9"/>
            <path d="M72 102 C74 100 80 100 84 102" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
            <circle cx="74" cy="104" r="2.5" fill="white" opacity="0.5"/>

            {/* Secondary porthole */}
            <circle cx="80" cy="158" r="14" fill="white" opacity="0.07"/>
            <circle cx="80" cy="158" r="12" fill="#050E28"/>
            <circle cx="80" cy="158" r="9.5" fill="#0A1E50"/>
            <circle cx="80" cy="158" r="7" fill="#1B4FD8"/>
            <circle cx="80" cy="158" r="4" fill="#7B9EFF" opacity="0.8"/>
            <circle cx="76" cy="154" r="1.5" fill="white" opacity="0.45"/>

            {/* AXSO text */}
            <text x="80" y="188" textAnchor="middle" fill="white" fontSize="8" fontWeight="800" opacity="0.5" letterSpacing="3">AXSO</text>

            {/* Engine bay */}
            <rect x="44" y="194" width="72" height="26" rx="6" fill="#040A1A"/>
            <rect x="48" y="198" width="64" height="18" rx="4" fill="#070E20"/>
            {/* 3 engine nozzles */}
            <ellipse cx="60" cy="216" rx="11" ry="4.5" fill="#020810"/>
            <ellipse cx="80" cy="216" rx="11" ry="4.5" fill="#020810"/>
            <ellipse cx="100" cy="216" rx="11" ry="4.5" fill="#020810"/>
            <ellipse cx="60" cy="216" rx="7" ry="2.8" fill="#0A1628"/>
            <ellipse cx="80" cy="216" rx="7" ry="2.8" fill="#0A1628"/>
            <ellipse cx="100" cy="216" rx="7" ry="2.8" fill="#0A1628"/>

            {/* Left main fin */}
            <path d="M37 128 L10 192 L15 205 L37 200Z" fill="#1440BE"/>
            <path d="M37 128 L10 192 L20 190 L37 168Z" fill="#1B4FD8"/>
            <path d="M37 128 L13 185 L18 183 L37 155Z" fill="white" opacity="0.05"/>
            {/* Right main fin */}
            <path d="M123 128 L150 192 L145 205 L123 200Z" fill="#1440BE"/>
            <path d="M123 128 L150 192 L140 190 L123 168Z" fill="#1B4FD8"/>
            <path d="M123 128 L147 185 L142 183 L123 155Z" fill="white" opacity="0.05"/>

            {/* Small stabilizer fins */}
            <path d="M50 194 L38 220 L50 215Z" fill="#0A1628"/>
            <path d="M110 194 L122 220 L110 215Z" fill="#0A1628"/>

            {/* ── Flames ── */}
            {showFlame && (
              <g>
                {/* Left engine flame */}
                <ellipse cx="60" cy="232" rx="9" ry="28" fill="url(#flameSide1)" style={{animation:"flameFlick .07s ease-in-out infinite alternate"}}/>
                <ellipse cx="60" cy="228" rx="5" ry="18" fill="white" opacity="0.75" style={{animation:"flameFlick .05s ease-in-out infinite alternate-reverse"}}/>
                {/* Center engine flame */}
                <ellipse cx="80" cy="238" rx="11" ry="36" fill="url(#flameMain)" style={{animation:"flameFlick .06s ease-in-out infinite alternate"}}/>
                <ellipse cx="80" cy="232" rx="6.5" ry="22" fill="url(#flameCore)" style={{animation:"flameFlick .04s ease-in-out infinite alternate-reverse"}}/>
                <ellipse cx="80" cy="228" rx="3" ry="14" fill="white" opacity="0.9" style={{animation:"flameFlick .05s ease-in-out infinite alternate"}}/>
                {/* Right engine flame */}
                <ellipse cx="100" cy="232" rx="9" ry="28" fill="url(#flameSide2)" style={{animation:"flameFlick .08s ease-in-out infinite alternate"}}/>
                <ellipse cx="100" cy="228" rx="5" ry="18" fill="white" opacity="0.75" style={{animation:"flameFlick .06s ease-in-out infinite alternate-reverse"}}/>
                {/* Shock diamonds */}
                <ellipse cx="80" cy="252" rx="8" ry="5" fill="white" opacity="0.25" style={{animation:"shockDiamond .12s ease-in-out infinite"}}/>
                <ellipse cx="80" cy="265" rx="6" ry="4" fill="white" opacity="0.15" style={{animation:"shockDiamond .12s ease-in-out .04s infinite"}}/>
              </g>
            )}

            <defs>
              <linearGradient id="flameMain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity="0.95"/>
                <stop offset="15%" stopColor="#FFE566"/>
                <stop offset="40%" stopColor="#FF8C00"/>
                <stop offset="70%" stopColor="#FF4500"/>
                <stop offset="100%" stopColor="#FF0000" stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="flameCore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white"/>
                <stop offset="50%" stopColor="#FFD700"/>
                <stop offset="100%" stopColor="#FF6600" stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="flameSide1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD700" stopOpacity="0.9"/>
                <stop offset="45%" stopColor="#FF6600"/>
                <stop offset="100%" stopColor="#FF2200" stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="flameSide2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD700" stopOpacity="0.9"/>
                <stop offset="45%" stopColor="#FF6600"/>
                <stop offset="100%" stopColor="#FF2200" stopOpacity="0"/>
              </linearGradient>
            </defs>
          </svg>

          {/* Exhaust smoke trail */}
          {isLaunching && (
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "280px" }}>
              {Array.from({length:14}, (_,i) => (
                <div key={i} className="absolute rounded-full" style={{
                  width: `${12 + i*9}px`, height: `${12 + i*9}px`,
                  left: `${-40 + ((i*13+7)%80) - 20}px`, top: 0,
                  background: `radial-gradient(circle, rgba(200,210,230,${0.35 - i*0.022}) 0%, rgba(130,140,160,0.05) 60%, transparent 100%)`,
                  animation: `smokeRise ${1.4 + i*0.18}s ${i*0.1}s ease-out infinite`,
                  filter: `blur(${2 + i*0.6}px)`,
                }}/>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Launch blast ring ── */}
      {(phase === "ignition" || phase === "launch") && (
        <div className="absolute left-1/2 pointer-events-none z-5" style={{
          bottom: "21%",
          transform: "translateX(-50%)",
          width: phase === "launch" ? "400px" : "100px",
          height: phase === "launch" ? "120px" : "30px",
          background: "radial-gradient(ellipse, rgba(255,140,0,0.55) 0%, rgba(255,69,0,0.2) 45%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(18px)",
          transition: "width 1s ease, height 1s ease",
        }}/>
      )}

      {/* ── Launch pad ── */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-10" style={{
        bottom: "18%",
        opacity: isInSpace ? 0 : 1, transition: "opacity 2s",
      }}>
        <div style={{
          width: "200px", height: "12px",
          background: "linear-gradient(90deg, transparent, rgba(27,79,216,0.5), transparent)",
          borderRadius: "4px",
        }}/>
        <div style={{
          width: "120px", height: "50px", margin: "0 auto",
          background: "linear-gradient(to bottom, #0A1628, #040A18)",
          borderRadius: "4px 4px 0 0", opacity: 0.8,
        }}/>
        <div style={{
          width: "180px", height: "8px", margin: "0 auto",
          background: "#040A18", borderRadius: "2px", opacity: 0.6,
        }}/>
      </div>

      {/* ── Orbit achieved ── */}
      {phase === "orbit" && (
        <div className="absolute inset-0 flex items-center justify-center z-20" style={{ animation: "orbitReveal 1.2s cubic-bezier(0.23,1,0.32,1) both" }}>
          <div className="text-center px-8">
            <p style={{ color: "#7B9EFF", fontSize: "12px", fontWeight: 700, letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: "12px", opacity: 0.7 }}>
              Mission accomplie · Orbite LEO atteinte
            </p>
            <h2 className="font-playfair font-bold" style={{
              fontSize: "clamp(32px,6vw,58px)", color: "white",
              lineHeight: 1.15, marginBottom: "12px",
            }}>
              Propulsez votre business<br/>
              <span style={{
                background: "linear-gradient(135deg, #1B4FD8 0%, #7B9EFF 50%, #a78bfa 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundSize: "200% auto", animation: "shimmer 3s linear infinite",
              }}>
                vers l'infini
              </span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "15px" }}>
              7 agents IA · e-commerce africain · déployés en orbite
            </p>
            <a href="/inscription" style={{
              display: "inline-flex", alignItems: "center", gap: "10px",
              marginTop: "28px", padding: "14px 32px",
              background: "linear-gradient(135deg, #1B4FD8, #1440BE)",
              color: "white", fontWeight: 700, fontSize: "15px",
              borderRadius: "14px", textDecoration: "none",
              boxShadow: "0 0 50px rgba(27,79,216,0.4)",
            }}>
              <span>Lancer ma boutique</span>
              <span>→</span>
            </a>
          </div>
        </div>
      )}

      {/* ── Footer label ── */}
      {!isInSpace && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20" style={{ opacity: 0.35 }}>
          <p style={{ color: "white", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase" }}>
            AXSO · E-commerce IA · Afrique
          </p>
        </div>
      )}

      <style>{`
        @keyframes starTwinkle { 0%,100%{opacity:.2;transform:scale(1)} 50%{opacity:1;transform:scale(1.8)} }
        @keyframes nebulaDrift { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(25px,-18px) scale(1.1)} }
        @keyframes starStreak { 0%{transform:scaleX(0) translateX(0);opacity:0} 15%{opacity:.2} 85%{opacity:.2} 100%{transform:scaleX(1) translateX(60vw);opacity:0} }
        @keyframes auroraFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes auroraWave { 0%,100%{transform:translateX(0) scaleX(1)} 50%{transform:translateX(30px) scaleX(1.15)} }
        @keyframes cloudPass { from{opacity:0;transform:scaleX(0.5)} to{opacity:1;transform:scaleX(1)} }
        @keyframes dotPulse { 0%,100%{opacity:1;box-shadow:0 0 8px #1B4FD8} 50%{opacity:.25;box-shadow:none} }
        @keyframes hudFadeIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes countdownAnim { from{opacity:0;transform:scale(2) rotateX(-20deg)} to{opacity:1;transform:scale(1) rotateX(0deg)} }
        @keyframes ignitionFlash { 0%{opacity:0;transform:scale(.5)} 40%{opacity:1;transform:scale(1.1)} 100%{opacity:.9;transform:scale(1)} }
        @keyframes rocketShake { 0%{transform:translateX(-1px) rotate(-.3deg)} 50%{transform:translateX(1px) rotate(.3deg)} 100%{transform:translateX(-1px) rotate(-.3deg)} }
        @keyframes camShake { 0%{transform:translate(-1px,-1px)} 25%{transform:translate(1px,0)} 50%{transform:translate(-1px,1px)} 75%{transform:translate(1px,-1px)} 100%{transform:translate(-1px,-1px)} }
        @keyframes flameFlick { 0%{transform:scaleX(1) scaleY(1)} 100%{transform:scaleX(1.2) scaleY(.88)} }
        @keyframes shockDiamond { 0%,100%{opacity:.25;transform:scaleX(1)} 50%{opacity:.4;transform:scaleX(1.3)} }
        @keyframes smokeRise { 0%{opacity:.5;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-90px) scale(3)} }
        @keyframes orbitReveal { from{opacity:0;transform:scale(.92) translateY(25px)} to{opacity:1;transform:scale(1) translateY(0)} }

        /* ── Mobile responsive ── */
        @media (max-width: 640px) {
          .rocket-wrap { transform: scale(0.62) !important; transform-origin: bottom center; }
          .rocket-launch { transform: scale(0.62) translateY(-140vh) !important; }
        }
      `}</style>
    </section>
  );
}
