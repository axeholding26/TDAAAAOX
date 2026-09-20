"use client";
import { useEffect, useRef, useState } from "react";

const AGENTS = [
  {
    id: "orion", nom: "ORION", role: "Agent Onboarding", num: "01",
    tagline: "Votre boutique en 60 secondes",
    description: "Décrivez votre business. ORION analyse votre marché africain, génère le catalogue, configure les prix et déploie votre boutique complète — automatiquement.",
    color: "#1B4FD8", colorAlt: "#7B9EFF", glow: "rgba(27,79,216,0.5)",
    tag: "SETUP", stats: ["60s déploiement", "∞ produits", "0 config"],
  },
  {
    id: "axia", nom: "AXIA", role: "Agent Copilote", num: "02",
    tagline: "L'intelligence centrale de votre boutique",
    description: "Parlez en français, wolof ou anglais. AXIA comprend vos intentions, orchestre les autres agents et exécute des actions complexes en langage naturel.",
    color: "#7c3aed", colorAlt: "#a78bfa", glow: "rgba(124,58,237,0.5)",
    tag: "IA CENTRALE", stats: ["24/7 actif", "7 langues", "NLP avancé"],
  },
  {
    id: "nova", nom: "NOVA", role: "Agent Marketing", num: "03",
    tagline: "Campagnes qui explosent les ventes",
    description: "NOVA génère des emails HTML pro, posts Instagram/TikTok viraux, scripts vidéo UGC et campagnes Meta Ads calibrés sur les tendances africaines.",
    color: "#f472b6", colorAlt: "#fb7185", glow: "rgba(244,114,182,0.5)",
    tag: "MARKETING", stats: ["×3.2 ouvertures", "5 plateformes", "A/B testing"],
  },
  {
    id: "kira", nom: "KIRA", role: "Agent Produits", num: "04",
    tagline: "Catalogue optimisé, conversions maximales",
    description: "KIRA enrichit chaque fiche — descriptions percutantes, SEO optimisé, images IA, tags et prix concurrentiels — en 3 secondes par produit.",
    color: "#34d399", colorAlt: "#6ee7b7", glow: "rgba(52,211,153,0.5)",
    tag: "CATALOGUE", stats: ["+67% conversions", "3s/produit", "SEO auto"],
  },
  {
    id: "zeta", nom: "ZETA", role: "Agent Clients", num: "05",
    tagline: "Fidélisation prédictive",
    description: "ZETA segmente vos clients par comportement, prédit les abandons, envoie des messages hyper-personnalisés et booste le taux de réachat.",
    color: "#22d3ee", colorAlt: "#67e8f9", glow: "rgba(34,211,238,0.5)",
    tag: "CRM", stats: ["+89% réachat", "Profil 360°", "Prédictif"],
  },
  {
    id: "atlas", nom: "ATLAS", role: "Agent Livraison", num: "06",
    tagline: "Logistique panafricaine sans friction",
    description: "ATLAS assigne le livreur optimal, trace les colis en temps réel, notifie les clients et résout les litiges — zéro intervention manuelle.",
    color: "#fb923c", colorAlt: "#fcd34d", glow: "rgba(251,146,60,0.5)",
    tag: "LOGISTIQUE", stats: ["98% livré", "−40% retards", "12 villes"],
  },
  {
    id: "lyra", nom: "LYRA", role: "Agent Analytics", num: "07",
    tagline: "Insights stratégiques en temps réel",
    description: "LYRA analyse vos données, détecte les tendances, prédit la demande et génère des rapports PDF actionnables avec recommandations stratégiques.",
    color: "#a78bfa", colorAlt: "#c4b5fd", glow: "rgba(167,139,250,0.5)",
    tag: "DATA", stats: ["+42% CA moyen", "Prédictions IA", "Rapports PDF"],
  },
];

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}
function hexCorners(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

function AgentAvatarSVG({ id, color, colorAlt, hovered }: {
  id: string; color: string; colorAlt: string; hovered: boolean;
}) {
  const s = 96;
  const cx = s / 2;
  const cy = s / 2;
  const uid = `av-${id}`;

  const content: Record<string, React.ReactNode> = {
    orion: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="42%" cy="35%" r="70%">
            <stop offset="0%" stopColor={colorAlt}/><stop offset="55%" stopColor={color}/><stop offset="100%" stopColor="#020B1A"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation="4" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*0.9} fill="none" stroke={color} strokeWidth="0.5" opacity="0.2" style={{animation:"orionOrb 5s linear infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*0.72} fill="none" stroke={colorAlt} strokeWidth="0.4" opacity="0.15" style={{animation:"orionOrb 3s linear infinite reverse"}}/>
        <polygon points={`${cx},${s*.07} ${s*.9},${cy} ${cx},${s*.93} ${s*.1},${cy}`} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation: hovered ? "orionPulse 1.2s ease-in-out infinite" : "orionFloat 4s ease-in-out infinite"}}/>
        <line x1={cx} y1={s*.07} x2={s*.9} y2={cy} stroke={colorAlt} strokeWidth="0.7" opacity="0.35"/>
        <line x1={s*.9} y1={cy} x2={cx} y2={s*.93} stroke={colorAlt} strokeWidth="0.7" opacity="0.35"/>
        <line x1={cx} y1={s*.93} x2={s*.1} y2={cy} stroke={colorAlt} strokeWidth="0.7" opacity="0.35"/>
        <line x1={s*.1} y1={cy} x2={cx} y2={s*.07} stroke={colorAlt} strokeWidth="0.7" opacity="0.35"/>
        <line x1={cx} y1={s*.07} x2={cx} y2={s*.93} stroke="white" strokeWidth="0.4" opacity="0.15"/>
        <line x1={s*.1} y1={cy} x2={s*.9} y2={cy} stroke="white" strokeWidth="0.4" opacity="0.15"/>
        <circle cx={cx} cy={cy} r={s*.07} fill="white" opacity="0.9" style={{animation:"orionFlash 2.5s ease-in-out infinite"}}/>
        <ellipse cx={cx-s*.1} cy={cy-s*.15} rx={s*.08} ry={s*.05} fill="white" opacity="0.3" transform={`rotate(-35 ${cx} ${cy})`}/>
      </>
    ),
    axia: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#c4b5fd"/><stop offset="50%" stopColor={color}/><stop offset="100%" stopColor="#0a0520"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation="5" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*.9} fill="none" stroke={colorAlt} strokeWidth="1" opacity="0.18" strokeDasharray="4 6" style={{animation:"axiaOrb 8s linear infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*.72} fill="none" stroke={color} strokeWidth="0.6" opacity="0.2" strokeDasharray="2 8" style={{animation:"axiaOrb 5s linear infinite reverse"}}/>
        <circle cx={cx} cy={cy} r={cx*.52} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation:"axiaBreathe 3s ease-in-out infinite"}}/>
        {[0,45,90,135,180,225,270,315].map((a,i)=>{
          const rad=a*Math.PI/180;
          return <line key={i} x1={cx+Math.cos(rad)*cx*.52} y1={cy+Math.sin(rad)*cx*.52} x2={cx+Math.cos(rad)*cx*.82} y2={cy+Math.sin(rad)*cx*.82} stroke={colorAlt} strokeWidth="0.8" opacity="0.4" style={{animation:`axiaNeuron ${1.5+i*.2}s ease-in-out ${i*.12}s infinite`}}/>;
        })}
        {[30,90,150,210,270,330].map((a,i)=>{
          const rad=a*Math.PI/180;
          return <circle key={i} cx={cx+Math.cos(rad)*cx*.82} cy={cy+Math.sin(rad)*cx*.82} r="2.5" fill={colorAlt} opacity="0.7" style={{animation:`axiaSynapse ${2+i*.3}s ease-in-out ${i*.18}s infinite`}}/>;
        })}
        <path d={`M${cx} ${cy-s*.12} L${cx+s*.04} ${cy-s*.02} L${cx+s*.12} ${cy} L${cx+s*.04} ${cy+s*.02} L${cx} ${cy+s*.12} L${cx-s*.04} ${cy+s*.02} L${cx-s*.12} ${cy} L${cx-s*.04} ${cy-s*.02} Z`} fill="white" opacity="0.85"/>
        <ellipse cx={cx-s*.08} cy={cy-s*.1} rx={s*.06} ry={s*.04} fill="white" opacity="0.3"/>
      </>
    ),
    nova: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white"/><stop offset="30%" stopColor={colorAlt}/><stop offset="70%" stopColor={color}/><stop offset="100%" stopColor="#1f0a14" stopOpacity="0"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation="6" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*.9} fill="none" stroke={color} strokeWidth="0.5" opacity="0.2" style={{animation:"novaExpand 3s ease-out infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*.75} fill="none" stroke={colorAlt} strokeWidth="0.4" opacity="0.15" style={{animation:"novaExpand 3s ease-out .6s infinite"}}/>
        {Array.from({length:8},(_,i)=>{
          const a=(i*45)*Math.PI/180;
          const inner=cx*.28, outer=cx*(i%2===0?.84:.64);
          return <line key={i} x1={cx+Math.cos(a)*inner} y1={cy+Math.sin(a)*inner} x2={cx+Math.cos(a)*outer} y2={cy+Math.sin(a)*outer} stroke={i%2===0?color:colorAlt} strokeWidth={i%2===0?2.5:1.5} strokeLinecap="round" opacity="0.85" style={{animation:`novaRay ${2+i*.15}s ease-in-out ${i*.1}s infinite`}}/>;
        })}
        <circle cx={cx} cy={cy} r={cx*.32} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation: hovered ? "novaPulse 1s ease-in-out infinite" : "novaPulse 2s ease-in-out infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*.12} fill="white" opacity="0.95"/>
        <ellipse cx={cx-s*.06} cy={cy-s*.08} rx={s*.05} ry={s*.03} fill="white" opacity="0.5"/>
      </>
    ),
    kira: (
      <>
        <defs>
          <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorAlt} stopOpacity="0.8"/><stop offset="100%" stopColor={color} stopOpacity="0.9"/>
          </linearGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation="3" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
          <clipPath id={`${uid}c`}><polygon points={hexPoints(cx,cy,s*.42)}/></clipPath>
        </defs>
        <polygon points={hexPoints(cx,cy,s*.44)} fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" filter={`url(#${uid}f)`}/>
        <polygon points={hexPoints(cx,cy,s*.35)} fill={`url(#${uid}g)`} opacity="0.12"/>
        <polygon points={hexPoints(cx,cy,s*.35)} fill="none" stroke={colorAlt} strokeWidth="0.8" opacity="0.35"/>
        <polygon points={hexPoints(cx,cy,s*.24)} fill={color} opacity="0.25"/>
        {[s*.62,s*.76,s*.9].map((r,i)=>(
          <circle key={i} cx={cx} cy={cy} r={r/2} fill="none" stroke={colorAlt} strokeWidth="0.5" opacity="0.18" style={{animation:`kiraRadar ${2+i*.8}s ease-out ${i*.4}s infinite`}}/>
        ))}
        <line x1={s*.08} y1={cy} x2={s*.92} y2={cy} stroke={colorAlt} strokeWidth="1.5" opacity="0.9" clipPath={`url(#${uid}c)`} style={{animation:"kiraScan 2.2s ease-in-out infinite"}}/>
        <line x1={cx-s*.08} y1={cy} x2={cx+s*.08} y2={cy} stroke="white" strokeWidth="1" opacity="0.7"/>
        <line x1={cx} y1={cy-s*.08} x2={cx} y2={cy+s*.08} stroke="white" strokeWidth="1" opacity="0.7"/>
        <circle cx={cx} cy={cy} r={3} fill={colorAlt} opacity="0.9"/>
        {hexCorners(cx,cy,s*.44).map((pt,i)=>(
          <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={color} opacity="0.7" style={{animation:`kiraCorner ${1+i*.2}s ease-in-out ${i*.1}s infinite`}}/>
        ))}
      </>
    ),
    zeta: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colorAlt} stopOpacity="0.9"/><stop offset="100%" stopColor={color} stopOpacity="0.7"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation="4" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
        </defs>
        <circle cx={cx} cy={cy} r={cx*.86} fill="none" stroke={color} strokeWidth="0.5" opacity="0.15" strokeDasharray="3 5"/>
        {[0,60,120,180,240,300].map((a,i)=>{
          const rad=a*Math.PI/180;
          const r=cx*.66, nx=cx+Math.cos(rad)*r, ny=cy+Math.sin(rad)*r;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={colorAlt} strokeWidth="0.8" opacity="0.3" style={{animation:`zetaSignal ${2+i*.3}s ease-in-out ${i*.2}s infinite`}}/>
              <circle cx={nx} cy={ny} r={s*.055} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation:`zetaNode ${1.5+i*.35}s ease-in-out ${i*.22}s infinite`}}/>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={cx*.28} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation:"zetaCenter 3s ease-in-out infinite"}}/>
        {[1,2].map(i=>(<circle key={i} cx={cx} cy={cy} r={cx*.28} fill="none" stroke={colorAlt} strokeWidth="1.5" opacity="0.4" style={{animation:`zetaPulse 2.2s ease-out ${i*.7}s infinite`}}/>))}
        <circle cx={cx} cy={cy} r={cx*.12} fill="white" opacity="0.9"/>
        <ellipse cx={cx-s*.07} cy={cy-s*.09} rx={s*.05} ry={s*.03} fill="white" opacity="0.3"/>
      </>
    ),
    atlas: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fcd34d"/><stop offset="45%" stopColor={color}/><stop offset="100%" stopColor="#1f0e05"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation="4" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
          <clipPath id={`${uid}c`}><circle cx={cx} cy={cy} r={cx*.53}/></clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={cx*.54} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`}/>
        {[-30,0,30].map((lat,i)=>{const y=cy+(lat/90)*cx*.52; const hw=Math.sqrt(Math.max(0,(cx*.52)**2-(y-cy)**2)); return <ellipse key={i} cx={cx} cy={y} rx={hw} ry={hw*.25} fill="none" stroke="white" strokeWidth="0.4" opacity="0.2" clipPath={`url(#${uid}c)`}/>;})}
        {[0,60,120].map((lon,i)=>{const rad=lon*Math.PI/180; return <ellipse key={i} cx={cx} cy={cy} rx={cx*.52*Math.abs(Math.cos(rad))} ry={cx*.52} fill="none" stroke="white" strokeWidth="0.4" opacity="0.2" clipPath={`url(#${uid}c)`}/>;})}
        <circle cx={cx} cy={cy} r={cx*.78} fill="none" stroke={color} strokeWidth="1.5" opacity="0.6"/>
        {[{a:270,l:"N"},{a:0,l:"E"},{a:90,l:"S"},{a:180,l:"W"}].map(({a,l})=>{
          const rad=(a*Math.PI)/180;
          return <text key={l} x={cx+Math.cos(rad)*cx*.78} y={cy+Math.sin(rad)*cx*.78} textAnchor="middle" dominantBaseline="middle" fill={colorAlt} fontSize="7" fontWeight="bold" opacity="0.85">{l}</text>;
        })}
        <g style={{animation:"atlasSpin 7s ease-in-out infinite",transformOrigin:`${cx}px ${cy}px`}}>
          <polygon points={`${cx},${cy-cx*.46} ${cx+3},${cy+cx*.1} ${cx-3},${cy+cx*.1}`} fill={colorAlt} opacity="0.9"/>
          <polygon points={`${cx},${cy+cx*.46} ${cx+3},${cy-cx*.1} ${cx-3},${cy-cx*.1}`} fill={color} opacity="0.6"/>
        </g>
        <circle cx={cx} cy={cy} r={4} fill="white" opacity="0.9"/>
        <ellipse cx={cx-s*.09} cy={cy-s*.12} rx={s*.07} ry={s*.04} fill="white" opacity="0.3" transform={`rotate(-30 ${cx} ${cy})`}/>
      </>
    ),
    lyra: (
      <>
        <defs>
          <radialGradient id={`${uid}g`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={colorAlt}/><stop offset="55%" stopColor={color}/><stop offset="100%" stopColor="#110a26"/>
          </radialGradient>
          <filter id={`${uid}f`}><feGaussianBlur stdDeviation="4" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
          <clipPath id={`${uid}c`}><circle cx={cx} cy={cy} r={cx*.52}/></clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={cx*.54} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} style={{animation:"lyraBreath 3s ease-in-out infinite"}}/>
        {[{h:.28,d:"0s"},{h:.42,d:".1s"},{h:.22,d:".2s"},{h:.48,d:".05s"},{h:.35,d:".15s"}].map((bar,i)=>{
          const bw=s*.055, maxH=s*.36, bx=cx-s*.14+i*(bw+2.5), bh=maxH*bar.h, by=cy+s*.14-bh;
          return <rect key={i} x={bx} y={by} width={bw} height={bh} rx="1.5" fill="white" opacity="0.6" clipPath={`url(#${uid}c)`} style={{animation:`lyraBar ${1.5+i*.2}s ease-in-out ${bar.d} infinite`, transformOrigin:`${bx+bw/2}px ${cy+s*.14}px`}}/>;
        })}
        <polyline points={`${cx-s*.14},${cy+s*.04} ${cx-s*.07},${cy-s*.04} ${cx},${cy+s*.08} ${cx+s*.07},${cy-s*.08} ${cx+s*.14},${cy-s*.12}`} stroke={colorAlt} strokeWidth="1.5" fill="none" opacity="0.8" clipPath={`url(#${uid}c)`} style={{animation:"lyraLine 3s ease-in-out infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*.78} fill="none" stroke={colorAlt} strokeWidth="0.5" opacity="0.22" strokeDasharray="2 4" style={{animation:"lyraOrbit 10s linear infinite"}}/>
        <circle cx={cx} cy={cy} r={cx*.52} fill="none" stroke={colorAlt} strokeWidth="1" opacity="0.3" style={{animation:"lyraPulse 2.5s ease-out infinite"}}/>
        <ellipse cx={cx-s*.08} cy={cy-s*.1} rx={s*.06} ry={s*.03} fill="white" opacity="0.3"/>
      </>
    ),
  };

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" overflow="visible" style={{display:"block"}}>
      {content[id]}
    </svg>
  );
}

function AgentCard3D({ agent, index }: { agent: typeof AGENTS[0]; index: number }) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMouse({ x: (e.clientX - rect.left) / rect.width - 0.5, y: (e.clientY - rect.top) / rect.height - 0.5 });
  };

  const tiltX = hovered ? mouse.y * -18 : 0;
  const tiltY = hovered ? mouse.x * 18 : 0;
  const glowX = (mouse.x + 0.5) * 100;
  const glowY = (mouse.y + 0.5) * 100;

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : "translateY(55px) rotateX(-18deg)",
      transition: `opacity 0.85s ${index * 0.09}s cubic-bezier(0.23,1,0.32,1), transform 0.85s ${index * 0.09}s cubic-bezier(0.23,1,0.32,1)`,
      perspective: "1200px",
    }}>
      <div
        ref={cardRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setMouse({ x: 0, y: 0 }); }}
        onMouseMove={handleMouseMove}
        style={{
          transform: `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)${hovered ? " translateZ(22px) scale(1.025)" : ""}`,
          transition: hovered ? "transform 0.08s linear, box-shadow 0.3s, border-color 0.3s" : "transform 0.6s cubic-bezier(0.23,1,0.32,1), box-shadow 0.3s, border-color 0.3s",
          transformStyle: "preserve-3d",
          willChange: "transform",
          borderRadius: "20px",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(145deg, rgba(8,10,28,0.97) 0%, rgba(4,6,18,0.99) 100%)",
          border: `1px solid ${hovered ? agent.color + "55" : "rgba(255,255,255,0.055)"}`,
          boxShadow: hovered
            ? `0 0 0 1px ${agent.color}20, 0 0 80px ${agent.glow}, 0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)`
            : "0 4px 30px rgba(0,0,0,0.5)",
          cursor: "default",
          padding: "28px 24px 22px",
          minHeight: "290px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Mouse-follow holographic glow */}
        {hovered && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "20px",
            background: `radial-gradient(circle 200px at ${glowX}% ${glowY}%, ${agent.color}16, transparent 70%)`,
          }}/>
        )}

        {/* Holographic shimmer overlay */}
        {hovered && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "20px",
            background: `linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 60%, transparent 80%)`,
            animation: "holoShimmer 2s linear infinite",
          }}/>
        )}

        {/* Big number watermark */}
        <div style={{
          position: "absolute", top: -8, right: 14,
          fontSize: "88px", fontWeight: 900, color: agent.color,
          opacity: hovered ? 0.08 : 0.04, fontFamily: "monospace",
          lineHeight: 1, userSelect: "none", transition: "opacity 0.3s",
          letterSpacing: "-4px",
        }}>
          {agent.num}
        </div>

        {/* Corner radiance */}
        <div style={{
          position: "absolute", top: 0, right: 0, width: "100px", height: "100px",
          background: `radial-gradient(circle at top right, ${agent.color}20, transparent 70%)`,
          opacity: hovered ? 1 : 0.4, transition: "opacity 0.4s", pointerEvents: "none",
          borderRadius: "0 20px 0 0",
        }}/>

        {/* Top row: avatar + tag */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
          <div style={{
            filter: hovered ? `drop-shadow(0 0 16px ${agent.color})` : "none",
            transition: "filter 0.4s",
            transform: hovered ? "scale(1.08)" : "scale(1)",
          }}>
            <AgentAvatarSVG id={agent.id} color={agent.color} colorAlt={agent.colorAlt} hovered={hovered}/>
          </div>
          <span style={{
            fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
            color: agent.color, background: agent.color + "15",
            border: `1px solid ${agent.color}35`, borderRadius: "100px", padding: "4px 10px",
            marginTop: "4px",
          }}>
            {agent.tag}
          </span>
        </div>

        {/* Name + role */}
        <div style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "2px" }}>
            <span style={{
              fontSize: "28px", fontWeight: 900, color: "white",
              letterSpacing: "0.06em", lineHeight: 1,
              textShadow: hovered ? `0 0 30px ${agent.color}` : "none",
              transition: "text-shadow 0.4s",
            }}>
              {agent.nom}
            </span>
          </div>
          <span style={{ fontSize: "11px", color: agent.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {agent.role}
          </span>
        </div>

        {/* Tagline */}
        <p style={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.88)", marginBottom: "10px", lineHeight: 1.35 }}>
          {agent.tagline}
        </p>

        {/* Description */}
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.38)", lineHeight: 1.65, marginBottom: "16px", flexGrow: 1 }}>
          {agent.description}
        </p>

        {/* Stat pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "16px" }}>
          {agent.stats.map(s => (
            <span key={s} style={{
              fontSize: "11px", fontWeight: 600, color: agent.color,
              background: agent.color + "14", border: `1px solid ${agent.color}28`,
              borderRadius: "6px", padding: "3px 9px",
            }}>
              {s}
            </span>
          ))}
        </div>

        {/* Status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "agentLive 2s ease-in-out infinite" }}/>
          <span style={{ fontSize: "10px", color: "rgba(52,211,153,0.75)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Agent actif · disponible 24/7
          </span>
        </div>

        {/* Bottom glow bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", borderRadius: "0 0 20px 20px",
          background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)`,
          opacity: hovered ? 1 : 0, transition: "opacity 0.4s",
        }}/>

        {/* Left accent bar */}
        <div style={{
          position: "absolute", top: "20%", left: 0, width: "2px", height: "60%",
          background: `linear-gradient(to bottom, transparent, ${agent.color}, transparent)`,
          opacity: hovered ? 0.8 : 0, transition: "opacity 0.4s",
        }}/>
      </div>
    </div>
  );
}

// Floating particles in background
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  x: ((i * 37 + 11) % 100),
  y: ((i * 73 + 17) % 100),
  r: 0.8 + ((i * 19) % 8) * 0.25,
  dur: 3 + ((i * 23) % 12) * 0.5,
  delay: ((i * 31) % 20) * 0.2,
}));

export function AIAgentsSection() {
  const [titleVisible, setTitleVisible] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTitleVisible(true); obs.disconnect(); } }, { threshold: 0.15 });
    if (titleRef.current) obs.observe(titleRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="agents" className="relative py-28 overflow-hidden" style={{
      background: "linear-gradient(180deg, #ffffff 0%, #06080F 12%, #040610 50%, #050812 88%, #ffffff 100%)",
    }}>
      {/* Star field */}
      <div className="absolute inset-0 pointer-events-none">
        {PARTICLES.map((p, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: `${p.r*2}px`, height: `${p.r*2}px`,
            animation: `sectionStar ${p.dur}s ${p.delay}s ease-in-out infinite`,
          }}/>
        ))}
      </div>

      {/* Nebula glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{ position:"absolute", top:"20%", left:"5%", width:"500px", height:"400px", background:"radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 70%)", filter:"blur(60px)", animation:"sectionNebula 14s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", bottom:"15%", right:"5%", width:"450px", height:"350px", background:"radial-gradient(ellipse, rgba(27,79,216,0.06) 0%, transparent 70%)", filter:"blur(70px)", animation:"sectionNebula 18s ease-in-out 4s infinite reverse" }}/>
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"600px", height:"300px", background:"radial-gradient(ellipse, rgba(244,114,182,0.04) 0%, transparent 70%)", filter:"blur(80px)" }}/>
      </div>

      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 relative z-10">

        {/* Header */}
        <div ref={titleRef} className="text-center mb-20" style={{
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? "none" : "translateY(35px)",
          transition: "all 0.9s cubic-bezier(0.23,1,0.32,1)",
        }}>
          <span className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold mb-8 border" style={{
            background: "rgba(124,58,237,0.08)", borderColor: "rgba(124,58,237,0.25)", color: "#a78bfa",
          }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#a78bfa" }}/>
            Intelligence Artificielle Multi-Agents · 11 entités IA spécialisées
          </span>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight" style={{ color: "white", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
            Rencontrez votre équipe IA
            <br/>
            <span style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #1B4FD8 40%, #a78bfa 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              backgroundSize: "200% auto", animation: "shimmer 4s linear infinite",
            }}>
              disponible 24h/24
            </span>
          </h2>

          <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            7 agents IA spécialisés, chacun expert dans son domaine. Ensemble, ils gèrent votre boutique de A à Z — pendant que vous dormez.
          </p>
        </div>

        {/* Agents grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" style={{ perspective: "1400px" }}>
          {AGENTS.map((agent, i) => (
            <div key={agent.id} className={i === 6 ? "sm:col-span-2 lg:col-span-3 xl:col-span-4 xl:max-w-xs xl:mx-auto w-full" : ""}>
              <AgentCard3D agent={agent} index={i}/>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-20" style={{ opacity: titleVisible ? 1 : 0, transition: "opacity 1s 1s" }}>
          <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.3)" }}>
            Tous les 7 agents inclus dès le départ. Gratuit pour lancer — 3% par vente uniquement.
          </p>
          <a href="/inscription" className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-bold text-white text-lg transition-all hover:scale-105 active:scale-95" style={{
            background: "linear-gradient(135deg, #7c3aed, #1B4FD8)",
            boxShadow: "0 0 50px rgba(124,58,237,0.35), 0 8px 40px rgba(27,79,216,0.25)",
          }}>
            <span>Activer mes 7 agents IA</span>
            <span>→</span>
          </a>
        </div>
      </div>

      <style>{`
        /* ── Ambient ── */
        @keyframes sectionStar { 0%,100%{opacity:.15;transform:scale(1)} 50%{opacity:.7;transform:scale(1.6)} }
        @keyframes sectionNebula { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,-15px) scale(1.08)} }
        @keyframes agentLive { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.7)} }
        @keyframes holoShimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }

        /* ── ORION diamond ── */
        @keyframes orionFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-5px) scale(1.04)} }
        @keyframes orionPulse { 0%,100%{transform:scale(1);filter:brightness(1)} 50%{transform:scale(1.07);filter:brightness(1.4)} }
        @keyframes orionFlash { 0%,70%,100%{opacity:.5;transform:scale(1)} 12%{opacity:1;transform:scale(1.6)} }
        @keyframes orionOrb { from{transform:rotate(0deg) scale(1);opacity:.2} 50%{transform:rotate(180deg) scale(1.1);opacity:.4} to{transform:rotate(360deg) scale(1);opacity:.2} }

        /* ── AXIA neural ── */
        @keyframes axiaBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes axiaOrb { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes axiaNeuron { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes axiaSynapse { 0%,100%{r:2.5;opacity:.7} 50%{r:4.5;opacity:1} }

        /* ── NOVA supernova ── */
        @keyframes novaExpand { 0%{transform:scale(.7);opacity:.5} 100%{transform:scale(1.4);opacity:0} }
        @keyframes novaPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1);filter:brightness(1.3)} }
        @keyframes novaRay { 0%,100%{opacity:.85} 50%{opacity:1;stroke-width:3.5} }

        /* ── KIRA scanner ── */
        @keyframes kiraScan { 0%{transform:translateY(-38px);opacity:0} 8%{opacity:.9} 92%{opacity:.9} 100%{transform:translateY(38px);opacity:0} }
        @keyframes kiraRadar { 0%{transform:scale(.7);opacity:.4} 100%{transform:scale(1.4);opacity:0} }
        @keyframes kiraCorner { 0%,100%{r:2.5;opacity:.7} 50%{r:4;opacity:1} }

        /* ── ZETA molecular ── */
        @keyframes zetaCenter { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes zetaNode { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.4);opacity:1} }
        @keyframes zetaSignal { 0%,100%{opacity:.3} 50%{opacity:.7} }
        @keyframes zetaPulse { 0%{transform:scale(1);opacity:.4} 100%{transform:scale(2.2);opacity:0} }

        /* ── ATLAS compass ── */
        @keyframes atlasSpin { 0%{transform:rotate(0deg)} 15%{transform:rotate(220deg)} 30%{transform:rotate(160deg)} 50%{transform:rotate(185deg)} 65%{transform:rotate(170deg)} 80%{transform:rotate(180deg)} 100%{transform:rotate(180deg)} }

        /* ── LYRA data ── */
        @keyframes lyraBreath { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes lyraBar { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(1.35)} }
        @keyframes lyraLine { 0%,100%{opacity:.8} 50%{opacity:1;stroke-width:2} }
        @keyframes lyraOrbit { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes lyraPulse { 0%{transform:scale(1);opacity:.3} 100%{transform:scale(2);opacity:0} }
      `}</style>
    </section>
  );
}
