"use client";

// Avatar 3D unique pour chaque agent IA — utilisé dans le dashboard et le hub des agents.
// Chaque agent a une identité visuelle distincte (forme, couleur, animation).

export type AgentId = "orion" | "axia" | "nova" | "kira" | "zeta" | "atlas" | "lyra"
  | "rex" | "veil" | "grow" | "stoq" | "fid";

export const AGENT_META: Record<AgentId, {
  nom: string; role: string; color: string; colorAlt: string; glow: string;
}> = {
  orion: { nom: "ORION", role: "Onboarding",  color: "#1B4FD8", colorAlt: "#7B9EFF", glow: "rgba(27,79,216,0.5)" },
  axia:  { nom: "AXIA",  role: "Copilote IA", color: "#1B2A4A", colorAlt: "#FFD280", glow: "rgba(124,58,237,0.5)" },
  nova:  { nom: "NOVA",  role: "Marketing",   color: "#f472b6", colorAlt: "#fb7185", glow: "rgba(244,114,182,0.5)" },
  kira:  { nom: "KIRA",  role: "Produits",    color: "#34d399", colorAlt: "#6ee7b7", glow: "rgba(52,211,153,0.5)" },
  zeta:  { nom: "ZETA",  role: "Clients",     color: "#22d3ee", colorAlt: "#67e8f9", glow: "rgba(34,211,238,0.5)" },
  atlas: { nom: "ATLAS", role: "Livraison",   color: "#fb923c", colorAlt: "#fcd34d", glow: "rgba(251,146,60,0.5)" },
  lyra:  { nom: "LYRA",  role: "Analytics",   color: "#FFD280", colorAlt: "#c4b5fd", glow: "rgba(167,139,250,0.5)" },
  // Agents autonomes
  rex:   { nom: "REX",   role: "Revenue",     color: "#16a34a", colorAlt: "#4ade80", glow: "rgba(22,163,74,0.5)" },
  veil:  { nom: "VEIL",  role: "Veille",      color: "#0891b2", colorAlt: "#22d3ee", glow: "rgba(8,145,178,0.5)" },
  grow:  { nom: "GROW",  role: "Growth",      color: "#d97706", colorAlt: "#fbbf24", glow: "rgba(217,119,6,0.5)" },
  stoq:  { nom: "STOQ",  role: "Stock",       color: "#dc2626", colorAlt: "#f87171", glow: "rgba(220,38,38,0.5)" },
  fid:   { nom: "FID",   role: "Fidélité",    color: "#db2777", colorAlt: "#f9a8d4", glow: "rgba(219,39,119,0.5)" },
};

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

interface Props {
  agentId: AgentId;
  size?: number;
  pulse?: boolean;
}

export function AgentAvatar3D({ agentId, size = 52, pulse = false }: Props) {
  const meta = AGENT_META[agentId];
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const uid = `da-${agentId}-${size}`;
  const { color, colorAlt } = meta;

  const avatars: Record<AgentId, React.ReactNode> = {
    // ORION — prisme diamant bleu
    orion: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor={colorAlt}/><stop offset="60%" stopColor={color}/><stop offset="100%" stopColor="#020B1A"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.04} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*0.9} fill="none" stroke={color} strokeWidth="0.5" opacity="0.2" style={{animation:"daOrb 5s linear infinite"}}/>
        <polygon points={`${cx},${s*.08} ${s*.88},${cy} ${cx},${s*.92} ${s*.12},${cy}`} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation: pulse ? "daPulse 1.2s ease-in-out infinite" : "daFloat 4s ease-in-out infinite"}}/>
        <line x1={cx} y1={s*.08} x2={s*.88} y2={cy} stroke={colorAlt} strokeWidth="0.6" opacity="0.3"/>
        <line x1={s*.88} y1={cy} x2={cx} y2={s*.92} stroke={colorAlt} strokeWidth="0.6" opacity="0.3"/>
        <line x1={cx} y1={s*.92} x2={s*.12} y2={cy} stroke={colorAlt} strokeWidth="0.6" opacity="0.3"/>
        <line x1={s*.12} y1={cy} x2={cx} y2={s*.08} stroke={colorAlt} strokeWidth="0.6" opacity="0.3"/>
        <circle cx={cx} cy={cy} r={s*.07} fill="white" opacity="0.9" style={{animation:"daFlash 2.5s ease-in-out infinite"}}/>
        <ellipse cx={cx-s*.1} cy={cy-s*.14} rx={s*.07} ry={s*.04} fill="white" opacity="0.3" transform={`rotate(-35 ${cx} ${cy})`}/>
      </>
    ),

    // AXIA — sphère neurale violette
    axia: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="38%" cy="33%" r="65%">
            <stop offset="0%" stopColor="#c4b5fd"/><stop offset="50%" stopColor={color}/><stop offset="100%" stopColor="#0a0520"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.05} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*0.88} fill="none" stroke={colorAlt} strokeWidth="0.8" opacity="0.18" strokeDasharray="3 5" style={{animation:"daOrb 7s linear infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*0.52} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation: pulse ? "daPulse 1s ease-in-out infinite" : "daBreathe 3s ease-in-out infinite"}}/>
        {[0,60,120,180,240,300].map((a,i)=>{
          const rad=a*Math.PI/180;
          return <line key={i} x1={cx+Math.cos(rad)*cx*.52} y1={cy+Math.sin(rad)*cx*.52} x2={cx+Math.cos(rad)*cx*.8} y2={cy+Math.sin(rad)*cx*.8} stroke={colorAlt} strokeWidth="0.7" opacity="0.45" style={{animation:`daNeuron ${1.5+i*.2}s ease-in-out ${i*.15}s infinite`}}/>;
        })}
        {[30,90,150,210,270,330].map((a,i)=>{
          const rad=a*Math.PI/180;
          return <circle key={i} cx={cx+Math.cos(rad)*cx*.8} cy={cy+Math.sin(rad)*cx*.8} r={s*.04} fill={colorAlt} opacity="0.7" style={{animation:`daSynapse ${2+i*.3}s ease-in-out ${i*.18}s infinite`}}/>;
        })}
        <path d={`M${cx} ${cy-s*.1} L${cx+s*.03} ${cy-s*.02} L${cx+s*.1} ${cy} L${cx+s*.03} ${cy+s*.02} L${cx} ${cy+s*.1} L${cx-s*.03} ${cy+s*.02} L${cx-s*.1} ${cy} L${cx-s*.03} ${cy-s*.02} Z`} fill="white" opacity="0.85"/>
        <ellipse cx={cx-s*.07} cy={cy-s*.09} rx={s*.05} ry={s*.03} fill="white" opacity="0.28"/>
      </>
    ),

    // NOVA — supernova rose
    nova: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white"/><stop offset="30%" stopColor={colorAlt}/><stop offset="70%" stopColor={color}/><stop offset="100%" stopColor="#1f0a14" stopOpacity="0"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.06} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*0.88} fill="none" stroke={color} strokeWidth="0.4" opacity="0.2" style={{animation:"daExpand 3s ease-out infinite"}}/>
        {Array.from({length:8},(_,i)=>{
          const a=(i*45)*Math.PI/180, inner=cx*.26, outer=cx*(i%2===0?.82:.62);
          return <line key={i} x1={cx+Math.cos(a)*inner} y1={cy+Math.sin(a)*inner} x2={cx+Math.cos(a)*outer} y2={cy+Math.sin(a)*outer} stroke={i%2===0?color:colorAlt} strokeWidth={i%2===0?2:1.2} strokeLinecap="round" opacity="0.8" style={{animation:`daRay ${2+i*.15}s ease-in-out ${i*.1}s infinite`}}/>;
        })}
        <circle cx={cx} cy={cy} r={cx*0.3} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation: pulse ? "daPulse 1s ease-in-out infinite" : "daBreathe 2s ease-in-out infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*0.11} fill="white" opacity="0.95"/>
        <ellipse cx={cx-s*.06} cy={cy-s*.08} rx={s*.04} ry={s*.025} fill="white" opacity="0.5"/>
      </>
    ),

    // KIRA — hexagone scanner vert
    kira: (
      <>
        <defs>
          <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorAlt} stopOpacity="0.8"/><stop offset="100%" stopColor={color} stopOpacity="0.9"/>
          </linearGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.03} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
          <clipPath id={`${uid}c`}><polygon points={hexPoints(cx,cy,s*.41)}/></clipPath>
        </defs>
        <polygon points={hexPoints(cx,cy,s*.43)} fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" filter={`url(#${uid}f)`}/>
        <polygon points={hexPoints(cx,cy,s*.34)} fill={`url(#${uid}g)`} opacity="0.1"/>
        <polygon points={hexPoints(cx,cy,s*.34)} fill="none" stroke={colorAlt} strokeWidth="0.7" opacity="0.35"/>
        {[s*.58,s*.73,s*.88].map((r,i)=>(
          <circle key={i} cx={cx} cy={cy} r={r/2} fill="none" stroke={colorAlt} strokeWidth="0.4" opacity="0.18" style={{animation:`daRadar ${2+i*.8}s ease-out ${i*.4}s infinite`}}/>
        ))}
        <line x1={s*.08} y1={cy} x2={s*.92} y2={cy} stroke={colorAlt} strokeWidth="1.4" opacity="0.9" clipPath={`url(#${uid}c)`} style={{animation:"daScan 2s ease-in-out infinite"}}/>
        <line x1={cx-s*.07} y1={cy} x2={cx+s*.07} y2={cy} stroke="white" strokeWidth="0.9" opacity="0.7"/>
        <line x1={cx} y1={cy-s*.07} x2={cx} y2={cy+s*.07} stroke="white" strokeWidth="0.9" opacity="0.7"/>
        <circle cx={cx} cy={cy} r={s*.035} fill={colorAlt} opacity="0.9"/>
      </>
    ),

    // ZETA — réseau moléculaire cyan
    zeta: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colorAlt} stopOpacity="0.9"/><stop offset="100%" stopColor={color} stopOpacity="0.7"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.04} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*0.86} fill="none" stroke={color} strokeWidth="0.4" opacity="0.15" strokeDasharray="3 5"/>
        {[0,60,120,180,240,300].map((a,i)=>{
          const rad=a*Math.PI/180, r=cx*.65, nx=cx+Math.cos(rad)*r, ny=cy+Math.sin(rad)*r;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={colorAlt} strokeWidth="0.7" opacity="0.3" style={{animation:`daSignal ${2+i*.3}s ease-in-out ${i*.2}s infinite`}}/>
              <circle cx={nx} cy={ny} r={s*.05} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation:`daNode ${1.5+i*.35}s ease-in-out ${i*.22}s infinite`}}/>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={cx*0.27} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation: pulse ? "daPulse 1s ease-in-out infinite" : "daBreathe 3s ease-in-out infinite"}}/>
        {[1,2].map(i=>(<circle key={i} cx={cx} cy={cy} r={cx*.27} fill="none" stroke={colorAlt} strokeWidth="1.2" opacity="0.35" style={{animation:`daWave 2.2s ease-out ${i*.7}s infinite`}}/>))}
        <circle cx={cx} cy={cy} r={cx*0.1} fill="white" opacity="0.9"/>
        <ellipse cx={cx-s*.06} cy={cy-s*.08} rx={s*.04} ry={s*.025} fill="white" opacity="0.28"/>
      </>
    ),

    // ATLAS — boussole globe orange
    atlas: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fcd34d"/><stop offset="45%" stopColor={color}/><stop offset="100%" stopColor="#1f0e05"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.04} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
          <clipPath id={`${uid}c`}><circle cx={cx} cy={cy} r={cx*.52}/></clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={cx*.54} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`}/>
        {[-30,0,30].map((lat,i)=>{const y=cy+(lat/90)*cx*.52; const hw=Math.sqrt(Math.max(0,(cx*.52)**2-(y-cy)**2)); return <ellipse key={i} cx={cx} cy={y} rx={hw} ry={hw*.25} fill="none" stroke="white" strokeWidth="0.4" opacity="0.18" clipPath={`url(#${uid}c)`}/>;})}
        {[0,60,120].map((lon,i)=>{const rad=lon*Math.PI/180; return <ellipse key={i} cx={cx} cy={cy} rx={cx*.52*Math.abs(Math.cos(rad))} ry={cx*.52} fill="none" stroke="white" strokeWidth="0.4" opacity="0.18" clipPath={`url(#${uid}c)`}/>;})}
        <circle cx={cx} cy={cy} r={cx*.76} fill="none" stroke={color} strokeWidth="1.2" opacity="0.6"/>
        <g style={{animation:"daCompass 7s ease-in-out infinite",transformOrigin:`${cx}px ${cy}px`}}>
          <polygon points={`${cx},${cy-cx*.44} ${cx+2.5},${cy+cx*.08} ${cx-2.5},${cy+cx*.08}`} fill={colorAlt} opacity="0.9"/>
          <polygon points={`${cx},${cy+cx*.44} ${cx+2.5},${cy-cx*.08} ${cx-2.5},${cy-cx*.08}`} fill={color} opacity="0.6"/>
        </g>
        <circle cx={cx} cy={cy} r={s*.045} fill="white" opacity="0.9"/>
        <ellipse cx={cx-s*.08} cy={cy-s*.1} rx={s*.06} ry={s*.035} fill="white" opacity="0.28" transform={`rotate(-30 ${cx} ${cy})`}/>
      </>
    ),

    // REX — triangle revenus vert
    rex: (
      <>
        <defs>
          <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorAlt}/><stop offset="100%" stopColor={color}/>
          </linearGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.04} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        {[cx*.88, cx*.72, cx*.58].map((r, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={colorAlt} strokeWidth="0.5" opacity={0.12 + i*0.06}/>
        ))}
        <polygon points={`${cx},${s*.12} ${s*.9},${s*.85} ${s*.1},${s*.85}`} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation: pulse ? "daPulse 1s ease-in-out infinite" : "daFloat 4s ease-in-out infinite"}}/>
        <polyline points={`${cx-s*.2},${cy+s*.1} ${cx-s*.05},${cy-s*.05} ${cx+s*.05},${cy+s*.05} ${cx+s*.2},${cy-s*.12}`} fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
        <circle cx={cx+s*.2} cy={cy-s*.12} r={s*.03} fill="white" opacity="0.9"/>
        <ellipse cx={cx-s*.07} cy={s*.22} rx={s*.04} ry={s*.025} fill="white" opacity="0.3"/>
      </>
    ),
    // VEIL — œil intelligence bleu
    veil: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colorAlt}/><stop offset="100%" stopColor={color}/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.04} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <ellipse cx={cx} cy={cy} rx={cx*.8} ry={cx*.42} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} opacity="0.85" style={{animation: pulse ? "daPulse 1s ease-in-out infinite" : "daBreathe 3s ease-in-out infinite"}}/>
        <ellipse cx={cx} cy={cy} rx={cx*.8} ry={cx*.42} fill="none" stroke={colorAlt} strokeWidth="1.2" opacity="0.6"/>
        <circle cx={cx} cy={cy} r={cx*.22} fill={color} opacity="0.95"/>
        <circle cx={cx} cy={cy} r={cx*.1} fill="white" opacity="0.9"/>
        <circle cx={cx-s*.05} cy={cy-s*.06} r={s*.04} fill="white" opacity="0.35"/>
        {[0,60,120,180,240,300].map((a,i) => {
          const rad=a*Math.PI/180, r=cx*.75;
          return <line key={i} x1={cx} y1={cy} x2={cx+Math.cos(rad)*r*0.5} y2={cy+Math.sin(rad)*r*0.28} stroke={colorAlt} strokeWidth="0.5" opacity="0.3" style={{animation:`daSignal ${2+i*.3}s ease-in-out ${i*.15}s infinite`}}/>;
        })}
      </>
    ),
    // GROW — flèche croissance orange
    grow: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor={colorAlt}/><stop offset="100%" stopColor={color}/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.04} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*.82} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} opacity="0.7" style={{animation: pulse ? "daPulse 1s ease-in-out infinite" : "daBreathe 3.5s ease-in-out infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*.82} fill="none" stroke={colorAlt} strokeWidth="0.8" opacity="0.4"/>
        <g style={{transformOrigin:`${cx}px ${cy}px`, animation:"daFloat 3s ease-in-out infinite"}}>
          <line x1={s*.22} y1={s*.72} x2={s*.78} y2={s*.28} stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
          <polygon points={`${s*.78},${s*.28} ${s*.6},${s*.3} ${s*.76},${s*.46}`} fill="white" opacity="0.9"/>
        </g>
        <circle cx={s*.22} cy={s*.72} r={s*.04} fill="white" opacity="0.6"/>
        <ellipse cx={cx-s*.08} cy={cy-s*.1} rx={s*.05} ry={s*.03} fill="white" opacity="0.25"/>
      </>
    ),
    // STOQ — cube stock rouge
    stoq: (
      <>
        <defs>
          <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorAlt}/><stop offset="100%" stopColor={color}/>
          </linearGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.03} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <rect x={cx-s*.35} y={cy-s*.35} width={s*.7} height={s*.7} rx={s*.06} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation: pulse ? "daPulse 1s ease-in-out infinite" : "daFloat 4s ease-in-out infinite"}}/>
        <line x1={cx-s*.35} y1={cy-s*.1} x2={cx+s*.35} y2={cy-s*.1} stroke="white" strokeWidth="0.8" opacity="0.3"/>
        <line x1={cx-s*.35} y1={cy+s*.1} x2={cx+s*.35} y2={cy+s*.1} stroke="white" strokeWidth="0.8" opacity="0.3"/>
        <line x1={cx-s*.1} y1={cy-s*.35} x2={cx-s*.1} y2={cy+s*.35} stroke="white" strokeWidth="0.8" opacity="0.3"/>
        <line x1={cx+s*.1} y1={cy-s*.35} x2={cx+s*.1} y2={cy+s*.35} stroke="white" strokeWidth="0.8" opacity="0.3"/>
        <text x={cx} y={cy+s*.08} textAnchor="middle" fontSize={s*.28} fontWeight="bold" fill="white" opacity="0.9">▲</text>
        <ellipse cx={cx-s*.08} cy={cy-s*.22} rx={s*.06} ry={s*.03} fill="white" opacity="0.25"/>
      </>
    ),
    // FID — cœur fidélité rose
    fid: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={colorAlt}/><stop offset="100%" stopColor={color}/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.05} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*.88} fill="none" stroke={colorAlt} strokeWidth="0.5" opacity="0.15" style={{animation:"daExpand 3s ease-out infinite"}}/>
        <path d={`M${cx},${cy+s*.28} C${cx-s*.38},${cy} ${cx-s*.38},${cy-s*.26} ${cx},${cy-s*.05} C${cx+s*.38},${cy-s*.26} ${cx+s*.38},${cy} ${cx},${cy+s*.28}`} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation: pulse ? "daPulse 1s ease-in-out infinite" : "daBreathe 2s ease-in-out infinite"}}/>
        {[1,2].map(i=><circle key={i} cx={cx} cy={cy+s*.05} r={cx*.45*i} fill="none" stroke={colorAlt} strokeWidth="0.7" opacity="0.2" style={{animation:`daWave 2s ease-out ${i*.5}s infinite`}}/>)}
        <circle cx={cx} cy={cy} r={s*.055} fill="white" opacity="0.9"/>
        <ellipse cx={cx-s*.09} cy={cy-s*.12} rx={s*.06} ry={s*.035} fill="white" opacity="0.28"/>
      </>
    ),
    // LYRA — orbe de données violet
    lyra: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={colorAlt}/><stop offset="55%" stopColor={color}/><stop offset="100%" stopColor="#110a26"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation={s*0.04} result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
          <clipPath id={`${uid}c`}><circle cx={cx} cy={cy} r={cx*.52}/></clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={cx*.54} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation:"daBreathe 3s ease-in-out infinite"}}/>
        {[{h:.3,d:"0s"},{h:.44,d:".1s"},{h:.22,d:".2s"},{h:.5,d:".05s"},{h:.36,d:".15s"}].map((bar,i)=>{
          const bw=s*.048, maxH=s*.33, bx=cx-s*.12+i*(bw+s*.02), bh=maxH*bar.h, by=cy+s*.12-bh;
          return <rect key={i} x={bx} y={by} width={bw} height={bh} rx="1.5" fill="white" opacity="0.6" clipPath={`url(#${uid}c)`} style={{animation:`daBar ${1.5+i*.2}s ease-in-out ${bar.d} infinite`, transformOrigin:`${bx+bw/2}px ${cy+s*.12}px`}}/>;
        })}
        <circle cx={cx} cy={cy} r={cx*.76} fill="none" stroke={colorAlt} strokeWidth="0.5" opacity="0.2" strokeDasharray="2 4" style={{animation:"daOrb 10s linear infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*.52} fill="none" stroke={colorAlt} strokeWidth="0.8" opacity="0.28" style={{animation:`daWave 2.5s ease-out ${pulse ? "0s" : "0s"} infinite`}}/>
        <ellipse cx={cx-s*.07} cy={cy-s*.09} rx={s*.05} ry={s*.03} fill="white" opacity="0.28"/>
      </>
    ),
  };

  return (
    <div style={{ width: s, height: s, position: "relative", flexShrink: 0 }}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" overflow="visible" style={{ display: "block" }}>
        {avatars[agentId]}
      </svg>

      <style>{`
        @keyframes daOrb    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes daFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes daBreathe{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes daPulse  { 0%,100%{transform:scale(1);filter:brightness(1)} 50%{transform:scale(1.1);filter:brightness(1.4)} }
        @keyframes daFlash  { 0%,75%,100%{opacity:.5;transform:scale(1)} 10%{opacity:1;transform:scale(1.6)} }
        @keyframes daNeuron { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes daSynapse{ 0%,100%{r:3;opacity:.7} 50%{r:5;opacity:1} }
        @keyframes daExpand { 0%{transform:scale(.7);opacity:.5} 100%{transform:scale(1.4);opacity:0} }
        @keyframes daRay    { 0%,100%{opacity:.8} 50%{opacity:1} }
        @keyframes daRadar  { 0%{transform:scale(.7);opacity:.4} 100%{transform:scale(1.4);opacity:0} }
        @keyframes daScan   { 0%{transform:translateY(-${s*.35}px);opacity:0} 8%{opacity:.9} 92%{opacity:.9} 100%{transform:translateY(${s*.35}px);opacity:0} }
        @keyframes daSignal { 0%,100%{opacity:.3} 50%{opacity:.7} }
        @keyframes daNode   { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.4);opacity:1} }
        @keyframes daWave   { 0%{transform:scale(1);opacity:.35} 100%{transform:scale(2.2);opacity:0} }
        @keyframes daCompass{ 0%{transform:rotate(0)} 15%{transform:rotate(220deg)} 30%{transform:rotate(160deg)} 50%{transform:rotate(185deg)} 80%{transform:rotate(180deg)} 100%{transform:rotate(180deg)} }
        @keyframes daBar    { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(1.4)} }
      `}</style>
    </div>
  );
}
