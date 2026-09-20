"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart, MessageCircle, Share2, Bookmark, BarChart2, Sparkles,
  Send, Zap, Globe2, Star, Users, Plus, ChevronDown,
  Play, X, Camera, Loader2, RefreshCw, Award, Flame, Eye,
  Maximize2, Minimize2, Search, ShoppingBag, Trophy, Video,
  Image, ArrowLeft, MoreHorizontal, Repeat2, TrendingUp,
  ChevronLeft, ChevronRight, Bell, Hash, AtSign, Smile,
  FileText, Music4, User, Globe, BarChart3,
} from "lucide-react";

// ─── Brand ────────────────────────────────────────────────────────────────────
const C = {
  orange:     "#F5A623",
  orangeDark: "#D4911A",
  orangeLight:"#FFD280",
  orangePale: "#FFF8EC",
  orangeSoft: "#FFF0D4",
  navy:       "#1B2A4A",
  gray900:    "#0F172A",
  gray800:    "#1E293B",
  gray700:    "#374151",
  gray600:    "#4B5563",
  gray500:    "#6B7280",
  gray400:    "#9CA3AF",
  gray300:    "#D1D5DB",
  gray200:    "#E5E7EB",
  gray100:    "#F3F4F6",
  gray50:     "#F9FAFB",
  white:      "#FFFFFF",
  green:      "#10B981",
  red:        "#EF4444",
  pink:       "#EC4899",
  blue:       "#3B82F6",
};

// ─── Types ───────────────────────────────────────────────────────────────────
type PostType = "post" | "story" | "video" | "produit" | "milestone" | "sondage";

interface Commentaire {
  id: string; auteur: string; contenu: string; createdAt: string; tenantId?: string;
}

interface PostSocial {
  id: string; tenantId: string; type: PostType;
  contenu: string | null; mediaUrls: string[];
  produitId: string | null; produitNom: string | null;
  produitPrix: number | null; produitImg: string | null;
  scoreValeur: number | null; scoreLabel: string | null;
  sondageOptions: string[]; sondageVotes: number[];
  vues: number; createdAt: string; expireAt: string | null;
  tenant: { id: string; nomBoutique: string; logoUrl: string | null; slug: string; pays: string | null; devise: string | null; _count: { commandes: number; produits: number } };
  reactions: { tenantId: string; emoji: string }[];
  commentaires: Commentaire[];
  _count: { reactions: number; commentaires: number };
}

interface LeaderEntry {
  id: string; nomBoutique: string; logoUrl: string | null; slug: string; pays: string | null;
  _count: { commandes: number; produits: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "maintenant";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function Avatar({ url, nom, size = 36, ring = false, online = false }: { url?: string | null; nom: string; size?: number; ring?: boolean; online?: boolean }) {
  const palette = [C.orange, C.green, C.blue, C.pink, "#8B5CF6", C.orangeDark, "#06B6D4"];
  const bg = palette[nom.charCodeAt(0) % palette.length];
  const base: React.CSSProperties = { width: size, height: size, borderRadius: "50%", flexShrink: 0, boxShadow: ring ? `0 0 0 2.5px ${C.orange}, 0 0 0 4.5px #fff` : undefined, position: "relative" as const };
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {url
        ? <img src={url} alt={nom} style={{ ...base, objectFit: "cover" as const }} />
        : <div style={{ ...base, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: Math.round(size * 0.36), fontWeight: 800, letterSpacing: "-0.5px" }}>{nom.slice(0, 2).toUpperCase()}</div>
      }
      {online && <div style={{ position: "absolute", bottom: 1, right: 1, width: Math.max(8, size * 0.22), height: Math.max(8, size * 0.22), borderRadius: "50%", background: C.green, border: "2px solid #fff" }} />}
    </div>
  );
}

// ─── Story Viewer Modal ───────────────────────────────────────────────────────
function StoryViewer({ stories, startIndex, onClose }: { stories: PostSocial[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 5000;

  useEffect(() => {
    setProgress(0);
    timerRef.current && clearInterval(timerRef.current);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const p = Math.min(((Date.now() - start) / DURATION) * 100, 100);
      setProgress(p);
      if (p >= 100) { if (idx < stories.length - 1) setIdx(i => i + 1); else onClose(); }
    }, 50);
    return () => { timerRef.current && clearInterval(timerRef.current); };
  }, [idx, stories.length]);

  const story = stories[idx];
  if (!story) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: 380, maxHeight: "90vh", borderRadius: 24, overflow: "hidden", background: C.gray900, position: "relative" }} onClick={e => e.stopPropagation()}>
        {/* Progress bars */}
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 4, zIndex: 10 }}>
          {stories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.3)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#fff", width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%", transition: i === idx ? "none" : undefined }} />
            </div>
          ))}
        </div>
        {/* Author */}
        <div style={{ position: "absolute", top: 24, left: 12, right: 12, display: "flex", alignItems: "center", gap: 10, zIndex: 10 }}>
          <Avatar url={story.tenant.logoUrl} nom={story.tenant.nomBoutique} size={36} ring />
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>{story.tenant.nomBoutique}</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{timeAgo(story.createdAt)}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#fff", opacity: 0.8 }}><X size={18} /></button>
        </div>
        {/* Media or text */}
        <div style={{ minHeight: 520, display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 20px 80px" }}>
          {story.mediaUrls[0]
            ? <img src={story.mediaUrls[0]} alt="" style={{ width: "100%", borderRadius: 16, objectFit: "cover", maxHeight: 400 }} />
            : <p style={{ color: "#fff", fontSize: 20, fontWeight: 700, textAlign: "center", lineHeight: 1.5 }}>{story.contenu}</p>
          }
        </div>
        {/* Nav arrows */}
        {idx > 0 && <button onClick={() => setIdx(i => i - 1)} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}><ChevronLeft size={18} /></button>}
        {idx < stories.length - 1 && <button onClick={() => setIdx(i => i + 1)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}><ChevronRight size={18} /></button>}
        {/* Footer */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", background: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "8px 14px", alignItems: "center", gap: 6 }}>
            <input placeholder="Répondre..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 13 }} />
          </div>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}><Heart size={22} /></button>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}><Share2 size={20} /></button>
        </div>
      </div>
    </div>
  );
}

// ─── Emoji Picker ─────────────────────────────────────────────────────────────
const EMOJIS = ["❤️", "🔥", "👏", "😍", "🚀", "💯", "🤩", "💪"];
function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div style={{ position: "absolute", bottom: "100%", left: 0, background: C.white, borderRadius: 16, padding: "8px 10px", display: "flex", gap: 6, boxShadow: "0 4px 24px rgba(0,0,0,0.14)", border: `1px solid ${C.gray200}`, zIndex: 50, marginBottom: 6 }}>
      {EMOJIS.map(e => (
        <button key={e} onClick={() => onPick(e)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", borderRadius: 8, padding: "4px 6px", transition: "background .1s" }}
          onMouseEnter={ev => (ev.currentTarget.style.background = C.gray100)} onMouseLeave={ev => (ev.currentTarget.style.background = "none")}>
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({ post, onClose }: { post: PostSocial; onClose: () => void }) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, background: C.white, borderRadius: "24px 24px 0 0", padding: "24px 20px 32px" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: C.gray200, borderRadius: 99, margin: "0 auto 20px" }} />
        <p style={{ fontWeight: 800, fontSize: 16, margin: "0 0 16px", color: C.gray900 }}>Partager ce post</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "WhatsApp",  color: "#25D366", Icon: MessageCircle },
            { label: "Instagram", color: "#E1306C", Icon: Camera },
            { label: "Facebook",  color: "#1877F2", Icon: User },
            { label: "TikTok",    color: "#000",    Icon: Music4 },
          ].map(s => (
            <button key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", minWidth: 64 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}><s.Icon size={22} color="#fff" /></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.gray600 }}>{s.label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, background: C.gray50, borderRadius: 14, padding: "10px 14px", alignItems: "center" }}>
          <span style={{ flex: 1, fontSize: 12, color: C.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
          <button onClick={copy} style={{ background: copied ? C.green : C.orange, color: "#fff", border: "none", borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Comment thread ───────────────────────────────────────────────────────────
function CommentThread({ postId, initial, myNom, myLogo, count }: { postId: string; initial: Commentaire[]; myNom: string; myLogo?: string | null; count: number }) {
  const [comments, setComments] = useState<Commentaire[]>(initial);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(count);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    const res = await fetch(`/api/reseau/posts/${postId}/comment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contenu: text }) });
    if (res.ok) {
      const c: Commentaire = await res.json();
      setComments(prev => [...prev, c]);
      setTotal(t => t + 1);
      setText("");
    }
    setLoading(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const lastId = comments[comments.length - 1]?.id;
    const res = await fetch(`/api/reseau/posts/${postId}/comment${lastId ? `?cursor=${lastId}` : ""}`);
    if (res.ok) {
      const d = await res.json();
      setComments(prev => [...prev, ...d.comments]);
      setCursor(d.nextCursor);
    }
    setLoadingMore(false);
  };

  return (
    <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.gray100}` }}>
      {/* Comment list */}
      <div style={{ maxHeight: 280, overflowY: "auto", paddingTop: 8 }}>
        {comments.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
            <Avatar nom={c.auteur} size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ background: C.gray50, borderRadius: "4px 14px 14px 14px", padding: "8px 12px" }}>
                <span style={{ fontWeight: 800, fontSize: 11.5, color: C.gray900 }}>{c.auteur}</span>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: C.gray700, lineHeight: 1.5 }}>{c.contenu}</p>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 3, paddingLeft: 4 }}>
                <span style={{ fontSize: 10, color: C.gray400 }}>{timeAgo(c.createdAt)}</span>
                <button style={{ fontSize: 10, fontWeight: 700, color: C.gray400, background: "none", border: "none", cursor: "pointer" }}>J'aime</button>
                <button style={{ fontSize: 10, fontWeight: 700, color: C.gray400, background: "none", border: "none", cursor: "pointer" }}>Répondre</button>
              </div>
            </div>
          </div>
        ))}
        {comments.length < total && (
          <button onClick={loadMore} disabled={loadingMore} style={{ fontSize: 12, fontWeight: 700, color: C.orange, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
            {loadingMore ? "..." : `Voir les ${total - comments.length} autres commentaires`}
          </button>
        )}
      </div>
      {/* Input */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <Avatar url={myLogo} nom={myNom} size={30} />
        <div style={{ flex: 1, display: "flex", background: C.gray50, borderRadius: 999, border: `1.5px solid ${C.gray200}`, padding: "8px 14px", alignItems: "center", gap: 8, transition: "border-color .15s" }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = C.orange)} onBlurCapture={e => (e.currentTarget.style.borderColor = C.gray200)}>
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && submit()}
            placeholder="Écrire un commentaire..." style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: C.gray700 }} />
          <button onClick={submit} disabled={loading || !text.trim()} style={{ background: "none", border: "none", cursor: "pointer", color: text.trim() ? C.orange : C.gray300, transition: "color .15s" }}>
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
const TYPE_META: Record<PostType, { label: string; color: string; bg: string }> = {
  post:      { label: "Post",      color: C.navy,       bg: "#E8EDF6" },
  story:     { label: "Story",     color: C.orange,     bg: C.orangeSoft },
  video:     { label: "Vidéo",     color: "#7C3AED",    bg: "#EDE9FE" },
  produit:   { label: "Produit",   color: C.green,      bg: "#D1FAE5" },
  milestone: { label: "Milestone", color: C.orangeDark, bg: C.orangeSoft },
  sondage:   { label: "Sondage",   color: C.blue,       bg: "#DBEAFE" },
};

function PostCard({ post, myTenantId, myNom, myLogo, onDelete, onRepost }: {
  post: PostSocial; myTenantId: string; myNom: string; myLogo?: string | null;
  onDelete: (id: string) => void; onRepost: (p: PostSocial) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked]               = useState(post.reactions.some(r => r.tenantId === myTenantId));
  const [likeCount, setLikeCount]       = useState(post._count.reactions);
  const [activeEmoji, setActiveEmoji]   = useState<string | null>(null);
  const [saved, setSaved]               = useState(false);
  const [showEmoji, setShowEmoji]       = useState(false);
  const [showShare, setShowShare]       = useState(false);
  const [reposted, setReposted]         = useState(false);
  const [votes, setVotes]               = useState(post.sondageVotes);
  const [votedIdx, setVotedIdx]         = useState<number | null>(null);
  const [commentCount, setCommentCount] = useState(post._count.commentaires);
  const [showMenu, setShowMenu]         = useState(false);
  const isMe = post.tenantId === myTenantId;
  const meta = TYPE_META[post.type];

  const handleLike = async (emoji = "❤️") => {
    setShowEmoji(false);
    const wasLiked = liked && activeEmoji === emoji;
    setLiked(!wasLiked); setActiveEmoji(wasLiked ? null : emoji);
    setLikeCount(c => wasLiked ? c - 1 : liked ? c : c + 1);
    await fetch(`/api/reseau/posts/${post.id}/reaction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) });
  };

  const handleVote = async (i: number) => {
    if (votedIdx !== null) return;
    setVotedIdx(i);
    const newVotes = [...votes]; newVotes[i] = (newVotes[i] || 0) + 1; setVotes(newVotes);
    await fetch(`/api/reseau/posts/${post.id}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionIndex: i }) });
  };

  const totalVotes = votes.reduce((a, b) => a + b, 0);

  return (
    <>
      {showShare && <ShareModal post={post} onClose={() => setShowShare(false)} />}
      <article style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray100}`, overflow: "visible", marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Avatar url={post.tenant.logoUrl} nom={post.tenant.nomBoutique} size={42} ring={post.type === "story"} online={Math.random() > 0.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 900, fontSize: 13.5, color: C.gray900 }}>{post.tenant.nomBoutique}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.gray400 }}>·</span>
              <span style={{ fontSize: 11, color: C.gray400 }}>{timeAgo(post.createdAt)}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700, color: meta.color, background: meta.bg, borderRadius: 999, padding: "2px 8px", marginLeft: 2, textTransform: "uppercase" as const, letterSpacing: "0.4px" }}>
                {meta.label}
              </span>
            </div>
            {post.tenant.pays && <div style={{ fontSize: 10, color: C.gray400, marginTop: 1 }}>📍 {post.tenant.pays} · {post.tenant._count.commandes} commandes</div>}
          </div>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowMenu(m => !m)} style={{ background: "none", border: "none", cursor: "pointer", color: C.gray400, padding: 6, borderRadius: 8 }}>
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <div style={{ position: "absolute", top: "100%", right: 0, background: C.white, borderRadius: 14, boxShadow: "0 4px 24px rgba(0,0,0,0.12)", border: `1px solid ${C.gray100}`, minWidth: 160, zIndex: 100, overflow: "hidden" }}>
                {isMe && <button onClick={() => { onDelete(post.id); setShowMenu(false); }} style={{ display: "flex", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.red, gap: 8, alignItems: "center" }}><X size={13} />Supprimer</button>}
                <button onClick={() => { setShowShare(true); setShowMenu(false); }} style={{ display: "flex", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.gray700, gap: 8, alignItems: "center" }}><Share2 size={13} />Partager</button>
                <button style={{ display: "flex", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.gray700, gap: 8, alignItems: "center" }}><Bookmark size={13} />Sauvegarder</button>
                <button onClick={() => { onRepost(post); setShowMenu(false); }} style={{ display: "flex", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.gray700, gap: 8, alignItems: "center" }}><Repeat2 size={13} />Reposter</button>
              </div>
            )}
          </div>
        </div>

        {/* Text */}
        {post.contenu && <div style={{ padding: "0 16px 12px", fontSize: 14.5, color: C.gray800, lineHeight: 1.65, fontWeight: 400 }}>{post.contenu}</div>}

        {/* Milestone */}
        {post.type === "milestone" && post.scoreLabel && (
          <div style={{ margin: "0 16px 14px", background: `linear-gradient(135deg, ${C.orangePale}, ${C.orangeSoft})`, borderRadius: 18, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, border: `1px solid ${C.orangeLight}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><Trophy size={36} color={C.orangeDark} /></div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 28, color: C.orangeDark, letterSpacing: "-1.5px" }}>{post.scoreValeur?.toLocaleString("fr-FR")}</div>
              <div style={{ fontSize: 13, color: C.orangeDark, fontWeight: 700, opacity: 0.85 }}>{post.scoreLabel}</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 10, color: C.orangeDark, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.7 }}>Axsocial</div>
              <div style={{ fontSize: 10, color: C.orangeDark, opacity: 0.6 }}>Milestone</div>
            </div>
          </div>
        )}

        {/* Product */}
        {post.type === "produit" && post.produitNom && (
          <div style={{ margin: "0 16px 14px", border: `1px solid ${C.gray100}`, borderRadius: 18, overflow: "hidden", display: "flex", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 96, background: C.gray50, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {post.produitImg ? <img src={post.produitImg} alt={post.produitNom} style={{ width: "100%", height: 96, objectFit: "cover" }} /> : <ShoppingBag size={28} color={C.gray300} />}
            </div>
            <div style={{ padding: "14px 16px", flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.gray900 }}>{post.produitNom}</div>
              {post.produitPrix && <div style={{ fontWeight: 900, fontSize: 18, color: C.orange, marginTop: 4, letterSpacing: "-0.5px" }}>{post.produitPrix.toLocaleString("fr-FR")} FCFA</div>}
              <button style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: C.white, background: C.orange, border: "none", borderRadius: 999, padding: "6px 18px", cursor: "pointer", boxShadow: `0 2px 8px rgba(245,166,35,0.35)` }}>Voir le produit →</button>
            </div>
          </div>
        )}

        {/* Poll */}
        {post.type === "sondage" && post.sondageOptions.length > 0 && (
          <div style={{ margin: "0 16px 14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {post.sondageOptions.map((opt, i) => {
                const pct = totalVotes > 0 ? Math.round((votes[i] / totalVotes) * 100) : 0;
                const isWinner = pct === Math.max(...post.sondageOptions.map((_, j) => totalVotes > 0 ? Math.round((votes[j] / totalVotes) * 100) : 0));
                return (
                  <button key={i} onClick={() => handleVote(i)} disabled={votedIdx !== null} style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `1.5px solid ${votedIdx === i ? C.orange : C.gray200}`, cursor: votedIdx !== null ? "default" : "pointer", textAlign: "left", background: "none", transition: "border-color .2s" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: votedIdx === i ? C.orangeSoft : C.gray50, transition: "width .6s cubic-bezier(.4,0,.2,1)" }} />
                    <div style={{ position: "relative", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: votedIdx === i ? 800 : 600, color: C.gray800 }}>{opt}</span>
                      {votedIdx !== null && <span style={{ fontSize: 12, fontWeight: 800, color: votedIdx === i ? C.orange : C.gray500 }}>{pct}%</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.gray400, marginTop: 6, fontWeight: 600 }}>{totalVotes} votes</div>
          </div>
        )}

        {/* Media */}
        {post.mediaUrls.length > 0 && (
          <div style={{ position: "relative", background: "#000", borderRadius: post.mediaUrls.length === 1 ? 0 : 16, overflow: "hidden", margin: post.mediaUrls.length > 1 ? "0 16px 14px" : 0 }}>
            {post.mediaUrls.length === 1 ? (
              <>
                <img src={post.mediaUrls[0]} alt="" style={{ width: "100%", maxHeight: 440, objectFit: "cover", display: "block", opacity: post.type === "video" ? 0.85 : 1 }} />
                {post.type === "video" && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: `rgba(245,166,35,0.92)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px rgba(245,166,35,0.5)` }}>
                      <Play size={24} color="#fff" />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {post.mediaUrls.slice(0, 4).map((url, i) => <img key={i} src={url} alt="" style={{ width: "100%", height: 160, objectFit: "cover" }} />)}
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div style={{ padding: "8px 16px 2px", display: "flex", gap: 16, fontSize: 11, color: C.gray400, borderTop: post.mediaUrls.length > 0 ? `1px solid ${C.gray100}` : undefined }}>
          {likeCount > 0 && <span>{likeCount} réaction{likeCount > 1 ? "s" : ""}</span>}
          {commentCount > 0 && <span>{commentCount} commentaire{commentCount > 1 ? "s" : ""}</span>}
          {post.vues > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Eye size={10} />{post.vues}</span>}
        </div>

        {/* Action bar */}
        <div style={{ padding: "6px 10px 10px", display: "flex", alignItems: "center", gap: 0, borderTop: `1px solid ${C.gray100}`, marginTop: 6 }}>
          {/* Like with emoji */}
          <div style={{ position: "relative" }}>
            {showEmoji && <EmojiPicker onPick={emoji => handleLike(emoji)} />}
            <button
              onClick={() => handleLike()}
              onContextMenu={e => { e.preventDefault(); setShowEmoji(s => !s); }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, color: liked ? C.red : C.gray500, transition: "all .15s" }}
              title="Clic droit pour choisir un emoji">
              <span style={{ fontSize: activeEmoji ? 16 : undefined }}>{activeEmoji || <Heart size={18} fill={liked ? C.red : "none"} color={liked ? C.red : undefined} />}</span>
            </button>
          </div>

          <button onClick={() => setShowComments(c => !c)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, color: showComments ? C.orange : C.gray500 }}>
            <MessageCircle size={18} />
            {commentCount > 0 && <span style={{ fontSize: 12 }}>{commentCount}</span>}
          </button>

          <button onClick={() => { setReposted(r => !r); if (!reposted) onRepost(post); }} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 12, fontSize: 13, fontWeight: 700, color: reposted ? C.green : C.gray500 }}>
            <Repeat2 size={18} />
          </button>

          <button onClick={() => setShowShare(true)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 12, fontSize: 13, color: C.gray500 }}>
            <Share2 size={18} />
          </button>

          <div style={{ flex: 1 }} />

          <button onClick={() => setSaved(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 12, color: saved ? C.orange : C.gray300, transition: "color .15s" }}>
            <Bookmark size={18} fill={saved ? C.orange : "none"} />
          </button>
        </div>

        {/* Comments */}
        {showComments && (
          <CommentThread postId={post.id} initial={post.commentaires} myNom={myNom} myLogo={myLogo} count={commentCount} />
        )}
      </article>
    </>
  );
}

// ─── Post Creator ─────────────────────────────────────────────────────────────
const TABS: { key: PostType; label: string; Icon: any }[] = [
  { key: "post",      label: "Post",      Icon: FileText },
  { key: "story",     label: "Story 24h", Icon: Zap },
  { key: "video",     label: "Vidéo",     Icon: Video },
  { key: "produit",   label: "Produit",   Icon: ShoppingBag },
  { key: "milestone", label: "Score",     Icon: Trophy },
  { key: "sondage",   label: "Sondage",   Icon: BarChart3 },
];

function PostCreator({ myNom, myLogo, onPost }: { myNom: string; myLogo?: string | null; onPost: (p: PostSocial) => void }) {
  const [tab, setTab]             = useState<PostType>("post");
  const [contenu, setContenu]     = useState("");
  const [scoreValeur, setScoreValeur] = useState("");
  const [scoreLabel, setScoreLabel] = useState("");
  const [sondageOptions, setSondageOptions] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [axiaLoading, setAxiaLoading] = useState(false);
  const [focused, setFocused]     = useState(false);
  const [charCount, setCharCount] = useState(0);
  const MAX = 500;

  const handleAxia = async () => {
    if (!contenu.trim()) return;
    setAxiaLoading(true);
    try {
      const res = await fetch("/api/ai/copilote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `Améliore ce post pour Axsocial (réseau social e-commerce), rends-le viral, accrocheur et vendeur. Garde un ton authentique et percutant: "${contenu}". Réponds uniquement avec le texte amélioré, max 280 caractères.` }) });
      const data = await res.json();
      if (data.message) { setContenu(data.message); setCharCount(data.message.length); }
    } finally { setAxiaLoading(false); }
  };

  const handleSubmit = async () => {
    if (!contenu.trim() && tab !== "milestone" && tab !== "sondage") return;
    setSubmitting(true);
    try {
      const body: any = { type: tab, contenu };
      if (tab === "milestone") { body.scoreValeur = Number(scoreValeur) || 0; body.scoreLabel = scoreLabel; body.contenu = contenu || `🏆 ${scoreLabel}`; }
      if (tab === "sondage") { body.sondageOptions = sondageOptions.filter(Boolean); body.sondageVotes = sondageOptions.filter(Boolean).map(() => 0); }
      const res = await fetch("/api/reseau/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const p = await res.json();
      if (res.ok) { onPost(p); setContenu(""); setCharCount(0); setScoreValeur(""); setScoreLabel(""); setSondageOptions(["", ""]); }
    } finally { setSubmitting(false); }
  };

  const pct = Math.min((charCount / MAX) * 100, 100);
  const dashArray = 2 * Math.PI * 10;
  const dashOffset = dashArray * (1 - pct / 100);

  return (
    <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${focused ? C.orange : C.gray100}`, padding: "16px", marginBottom: 10, boxShadow: focused ? `0 0 0 3px ${C.orangeSoft}` : "0 1px 3px rgba(0,0,0,0.05)", transition: "all .2s" }}>
      {/* Type tabs */}
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 999, padding: "5px 13px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", flexShrink: 0, transition: "all .15s", background: tab === t.key ? C.orange : C.gray50, color: tab === t.key ? "#fff" : C.gray500, boxShadow: tab === t.key ? `0 2px 10px rgba(245,166,35,0.38)` : "none" }}>
            <t.Icon size={13} />{t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Avatar url={myLogo} nom={myNom} size={40} ring />
        <div style={{ flex: 1 }}>
          <textarea value={contenu}
            onChange={e => { setContenu(e.target.value); setCharCount(e.target.value.length); }}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder={
              tab === "milestone" ? "Décris ton milestone (ex: J'ai atteint 100 commandes ce mois! 🚀)..."
              : tab === "sondage" ? "Pose ta question à la communauté..."
              : tab === "story" ? "Ta story disparaîtra dans 24h ⚡..."
              : tab === "produit" ? "Présente ton produit à la communauté..."
              : `Partage avec la communauté Axsocial...`
            }
            style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 15, color: C.gray800, lineHeight: 1.65, minHeight: 80, background: "transparent", fontFamily: "inherit" }}
          />

          {tab === "milestone" && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={scoreValeur} onChange={e => setScoreValeur(e.target.value)} placeholder="Valeur" type="number" style={{ flex: 1, border: `1.5px solid ${C.gray200}`, borderRadius: 12, padding: "9px 13px", fontSize: 13, outline: "none", color: C.gray700, fontFamily: "inherit" }} />
              <input value={scoreLabel} onChange={e => setScoreLabel(e.target.value)} placeholder="Label (ex: commandes ce mois)" style={{ flex: 3, border: `1.5px solid ${C.gray200}`, borderRadius: 12, padding: "9px 13px", fontSize: 13, outline: "none", color: C.gray700, fontFamily: "inherit" }} />
            </div>
          )}

          {tab === "sondage" && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {sondageOptions.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 6 }}>
                  <input value={opt} onChange={e => { const o = [...sondageOptions]; o[i] = e.target.value; setSondageOptions(o); }}
                    placeholder={`Option ${i + 1}`} style={{ flex: 1, border: `1.5px solid ${C.gray200}`, borderRadius: 12, padding: "9px 13px", fontSize: 13, outline: "none", color: C.gray700, fontFamily: "inherit" }} />
                  {sondageOptions.length > 2 && <button onClick={() => setSondageOptions(sondageOptions.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: C.gray300, padding: 6 }}><X size={14} /></button>}
                </div>
              ))}
              {sondageOptions.length < 4 && (
                <button onClick={() => setSondageOptions([...sondageOptions, ""])} style={{ fontSize: 12, color: C.orange, background: C.orangePale, border: `1.5px dashed ${C.orangeLight}`, borderRadius: 12, padding: "9px", cursor: "pointer", fontWeight: 700 }}>+ Ajouter une option</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.gray100}` }}>
        {[<Image key="img" size={17} />, <Video key="vid" size={17} />, <AtSign key="at" size={17} />, <Hash key="hash" size={17} />, <Smile key="smile" size={17} />].map((Icon, i) => (
          <button key={i} style={{ background: "none", border: "none", cursor: "pointer", color: C.gray300, padding: "6px", borderRadius: 8, transition: "color .15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = C.orange)} onMouseLeave={e => (e.currentTarget.style.color = C.gray300)}>
            {Icon}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Char count ring */}
        {charCount > 0 && (
          <svg width="24" height="24" style={{ transform: "rotate(-90deg)", marginRight: 4 }}>
            <circle cx="12" cy="12" r="10" fill="none" stroke={C.gray100} strokeWidth="2.5" />
            <circle cx="12" cy="12" r="10" fill="none" stroke={charCount > MAX ? C.red : charCount > MAX * 0.8 ? C.orange : C.orange} strokeWidth="2.5" strokeDasharray={dashArray} strokeDashoffset={dashOffset} strokeLinecap="round" />
          </svg>
        )}
        <button onClick={handleAxia} disabled={axiaLoading || !contenu.trim()} style={{ display: "flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "8px 15px", fontSize: 12, fontWeight: 800, border: `1.5px solid ${C.orangeLight}`, background: axiaLoading ? C.gray50 : C.orangeSoft, color: C.orangeDark, cursor: "pointer", letterSpacing: "0.3px" }}>
          {axiaLoading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={12} />} AXIA
        </button>
        <button onClick={handleSubmit} disabled={submitting || charCount > MAX} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "8px 22px", fontSize: 13, fontWeight: 900, border: "none", background: C.orange, color: C.white, cursor: "pointer", boxShadow: `0 3px 12px rgba(245,166,35,0.42)`, letterSpacing: "0.2px" }}>
          {submitting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />} Publier
        </button>
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
function Leaderboard({ entries }: { entries: LeaderEntry[] }) {
  const medals = ["1st", "2nd", "3rd"];
  return (
    <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray100}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.gray50}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 10, background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Flame size={14} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 13, color: C.gray900 }}>Top Vendeurs</div>
          <div style={{ fontSize: 10, color: C.gray400 }}>Classement Axsocial</div>
        </div>
      </div>
      <div>
        {entries.map((e, i) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", cursor: "pointer", transition: "background .12s" }}
            onMouseEnter={ev => (ev.currentTarget.style.background = C.gray50)} onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}>
            <span style={{ fontSize: i < 3 ? 9 : 11, minWidth: 24, textAlign: "center", fontWeight: 800, color: i >= 3 ? C.gray300 : C.orange, background: i < 3 ? C.orangeSoft : undefined, borderRadius: i < 3 ? 999 : undefined, padding: i < 3 ? "1px 4px" : undefined }}>{i < 3 ? medals[i] : i + 1}</span>
            <Avatar url={e.logoUrl} nom={e.nomBoutique} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: C.gray900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nomBoutique}</div>
              <div style={{ fontSize: 10, color: C.gray400 }}>{e._count.commandes} commandes · {e._count.produits} produits</div>
            </div>
            {i < 3 && <div style={{ fontSize: 10, fontWeight: 800, color: C.orange, background: C.orangeSoft, borderRadius: 999, padding: "2px 8px" }}>#{i + 1}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Trending widget ──────────────────────────────────────────────────────────
function TrendingWidget() {
  const trends = [
    { tag: "#Dropshipping", posts: "2.4k posts" },
    { tag: "#ProduitsMCI",  posts: "1.8k posts" },
    { tag: "#EcomAfrique",  posts: "3.1k posts" },
    { tag: "#FlashPromo",   posts: "945 posts"  },
    { tag: "#Milestone100", posts: "612 posts"  },
  ];
  return (
    <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray100}`, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <TrendingUp size={14} color={C.orange} />
        <span style={{ fontWeight: 900, fontSize: 13, color: C.gray900 }}>Tendances</span>
      </div>
      {trends.map((t, i) => (
        <div key={i} style={{ padding: "8px 16px", cursor: "pointer", transition: "background .12s" }}
          onMouseEnter={ev => (ev.currentTarget.style.background = C.gray50)} onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, color: C.gray400, fontWeight: 600 }}>Tendance</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.orange, marginTop: 1 }}>{t.tag}</div>
              <div style={{ fontSize: 10, color: C.gray400, marginTop: 1 }}>{t.posts}</div>
            </div>
            <MoreHorizontal size={14} color={C.gray300} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── AXIA Boost ───────────────────────────────────────────────────────────────
function AxiaPanel({ myNom }: { myNom: string }) {
  const tips = [
    { text: "Coulisses de ta boutique" },
    { text: "Partage ton meilleur score" },
    { text: "Sondage prochain produit" },
    { text: "Promo flash 48h" },
  ];
  return (
    <div style={{ background: `linear-gradient(145deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, borderRadius: 20, padding: 16, boxShadow: `0 4px 20px rgba(245,166,35,0.22)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={13} color="#fff" />
        </div>
        <span style={{ fontWeight: 900, fontSize: 13, color: "#fff" }}>AXIA Boost</span>
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginBottom: 10, lineHeight: 1.5 }}>Idées pour {myNom}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {tips.map((t, i) => (
          <button key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.14)", border: "none", borderRadius: 12, padding: "9px 11px", cursor: "pointer", textAlign: "left", transition: "background .15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}>
            <span style={{ fontSize: 11.5, color: "#fff", fontWeight: 600 }}>{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
function SearchBar({ onResults }: { onResults: (r: any) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>({ posts: [], boutiques: [] });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim() || q.length < 2) { setResults({ posts: [], boutiques: [] }); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/reseau/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.white, border: `1.5px solid ${open ? C.orange : C.gray200}`, borderRadius: 999, padding: "9px 16px", boxShadow: open ? `0 0 0 3px ${C.orangeSoft}` : "0 1px 3px rgba(0,0,0,0.04)", transition: "all .2s" }}>
        {loading ? <Loader2 size={15} color={C.orange} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={15} color={open ? C.orange : C.gray400} />}
        <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Rechercher sur Axsocial..." style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: C.gray700, background: "transparent" }} />
        {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.gray300 }}><X size={13} /></button>}
      </div>
      {open && (results.posts.length > 0 || results.boutiques.length > 0) && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: C.white, borderRadius: 18, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: `1px solid ${C.gray100}`, zIndex: 200, overflow: "hidden", maxHeight: 360, overflowY: "auto" }}>
          {results.boutiques.length > 0 && (
            <div>
              <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 800, color: C.gray400, textTransform: "uppercase", letterSpacing: "0.5px" }}>Boutiques</div>
              {results.boutiques.map((b: any) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer" }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = C.gray50)} onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}>
                  <Avatar url={b.logoUrl} nom={b.nomBoutique} size={30} />
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{b.nomBoutique}</div><div style={{ fontSize: 10, color: C.gray400 }}>{b._count.commandes} commandes</div></div>
                </div>
              ))}
            </div>
          )}
          {results.posts.length > 0 && (
            <div>
              <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 800, color: C.gray400, textTransform: "uppercase", letterSpacing: "0.5px" }}>Posts</div>
              {results.posts.map((p: any) => (
                <div key={p.id} style={{ display: "flex", gap: 10, padding: "8px 14px", cursor: "pointer", alignItems: "flex-start" }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = C.gray50)} onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}>
                  <Avatar url={p.tenant?.logoUrl} nom={p.tenant?.nomBoutique || "?"} size={28} />
                  <div><div style={{ fontWeight: 700, fontSize: 12 }}>{p.tenant?.nomBoutique}</div><div style={{ fontSize: 12, color: C.gray600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{p.contenu}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AxsocialPage() {
  const [posts, setPosts]               = useState<PostSocial[]>([]);
  const [stories, setStories]           = useState<PostSocial[]>([]);
  const [leaderboard, setLeaderboard]   = useState<LeaderEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState("tous");
  const [myTenantId, setMyTenantId]     = useState("");
  const [myNom, setMyNom]               = useState("Ma Boutique");
  const [myLogo, setMyLogo]             = useState<string | null>(null);
  const [myStats, setMyStats]           = useState({ commandes: 0, produits: 0, posts: 0 });
  const [nextCursor, setNextCursor]     = useState<string | null>(null);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [fullscreen, setFullscreen]     = useState(false);
  const [storyViewer, setStoryViewer]   = useState<number | null>(null);
  const [repostTarget, setRepostTarget] = useState<PostSocial | null>(null);

  const FILTERS = [
    { key: "tous",      Icon: Sparkles,    label: "Tous" },
    { key: "post",      Icon: FileText,    label: "Posts" },
    { key: "story",     Icon: Zap,         label: "Stories" },
    { key: "video",     Icon: Video,       label: "Vidéos" },
    { key: "produit",   Icon: ShoppingBag, label: "Produits" },
    { key: "milestone", Icon: Trophy,      label: "Scores" },
    { key: "sondage",   Icon: BarChart3,   label: "Sondages" },
  ];

  const loadFeed = useCallback(async (cursor?: string) => {
    const qs: string[] = [];
    if (filter !== "tous") qs.push(`type=${filter}`);
    if (cursor) qs.push(`cursor=${cursor}`);
    const res = await fetch(`/api/reseau/feed${qs.length ? "?" + qs.join("&") : ""}`);
    if (!res.ok) return;
    const data = await res.json();
    const all: PostSocial[] = data.posts;
    if (cursor) {
      setPosts(p => [...p, ...all.filter(x => x.type !== "story")]);
    } else {
      setStories(all.filter(p => p.type === "story"));
      setPosts(all.filter(p => p.type !== "story"));
    }
    setNextCursor(data.nextCursor);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadFeed(),
      fetch("/api/reseau/leaderboard").then(r => r.json()).then(d => setLeaderboard(d.leaderboard || [])),
      fetch("/api/tenants/moi").then(r => r.json()).then(d => {
        const t = d.tenant;
        if (t?.id) { setMyTenantId(t.id); setMyNom(t.nomBoutique || "Ma Boutique"); setMyLogo(t.logoUrl || null); setMyStats({ commandes: t._count?.commandes || 0, produits: t._count?.produits || 0, posts: 0 }); }
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [loadFeed]);

  const handleNewPost = (p: PostSocial) => {
    if (p.type === "story") setStories(s => [p, ...s]);
    else setPosts(all => [p, ...all]);
    setMyStats(s => ({ ...s, posts: s.posts + 1 }));
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/reseau/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setPosts(p => p.filter(x => x.id !== id));
    setStories(s => s.filter(x => x.id !== id));
  };

  const handleRepost = (p: PostSocial) => setRepostTarget(p);

  const wrapStyle: React.CSSProperties = fullscreen
    ? { position: "fixed", inset: 0, zIndex: 9999, background: C.gray50, overflowY: "auto", padding: "0 24px 40px" }
    : {};

  return (
    <div style={wrapStyle}>
      {storyViewer !== null && (
        <StoryViewer stories={stories} startIndex={storyViewer} onClose={() => setStoryViewer(null)} />
      )}

      {/* Header */}
      <div style={{ padding: `${fullscreen ? 18 : 22}px 0 14px`, display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.gray900, letterSpacing: "-0.8px" }}>
            <span style={{ color: C.orange }}>Ax</span>social
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: C.gray400, fontWeight: 600 }}>Le réseau des vendeurs · {leaderboard.length} boutiques actives</p>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: C.gray500, padding: 8 }}>
          <Bell size={18} />
          <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: C.orange, border: "2px solid #fff" }} />
        </button>
        <button onClick={() => loadFeed()} style={{ display: "flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "8px", border: `1px solid ${C.gray200}`, background: C.white, color: C.gray500, cursor: "pointer" }}>
          <RefreshCw size={14} />
        </button>
        <button onClick={() => setFullscreen(f => !f)} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "8px 14px", fontSize: 12, fontWeight: 700, border: `1px solid ${C.gray200}`, background: fullscreen ? C.gray900 : C.white, color: fullscreen ? C.white : C.gray700, cursor: "pointer" }}>
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          {fullscreen ? "Réduire" : "Plein écran"}
        </button>
      </div>

      {/* 3-col layout */}
      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr 258px", gap: 18, alignItems: "flex-start" }}>

        {/* ── LEFT ── */}
        <div style={{ position: "sticky", top: fullscreen ? 18 : 76 }}>
          {/* Profile */}
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray100}`, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ height: 60, background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }} />
            <div style={{ padding: "0 16px 16px", marginTop: -28 }}>
              <Avatar url={myLogo} nom={myNom} size={56} ring />
              <div style={{ marginTop: 8, fontWeight: 900, fontSize: 14, color: C.gray900 }}>{myNom}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: C.orange, background: C.orangeSoft, borderRadius: 999, padding: "3px 9px", marginTop: 4 }}>
                <Star size={8} fill={C.orange} color={C.orange} /> Vendeur Axsocial
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 900, color: C.gray900, fontSize: 15 }}>{myStats.posts}</div>
                  <div style={{ color: C.gray400, fontSize: 10, fontWeight: 600 }}>Posts</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 900, color: C.gray900, fontSize: 15 }}>{myStats.commandes}</div>
                  <div style={{ color: C.gray400, fontSize: 10, fontWeight: 600 }}>Commandes</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 900, color: C.gray900, fontSize: 15 }}>{myStats.produits}</div>
                  <div style={{ color: C.gray400, fontSize: 10, fontWeight: 600 }}>Produits</div>
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray100}`, overflow: "hidden", marginBottom: 10 }}>
            {[
              { icon: <Flame size={14} />,      label: "Trending",    color: "#F59E0B" },
              { icon: <Globe2 size={14} />,      label: "Explorer",    color: C.navy },
              { icon: <ShoppingBag size={14} />, label: "Marketplace", color: C.green },
              { icon: <Award size={14} />,       label: "Classement",  color: C.orange },
              { icon: <BarChart2 size={14} />,   label: "Analytics",   color: C.blue },
              { icon: <Bookmark size={14} />,    label: "Sauvegardés", color: C.gray500 },
            ].map((item, i) => (
              <button key={i} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: C.gray700, textAlign: "left", transition: "all .12s" }}
                onMouseEnter={e => { e.currentTarget.style.background = C.orangePale; e.currentTarget.style.color = C.orange; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.gray700; }}>
                <span style={{ color: item.color }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CENTER ── */}
        <div>
          {/* Stories */}
          {stories.length > 0 && (
            <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray100}`, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.gray400, textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 12 }}>Stories actives · {stories.length}</div>
              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                <div onClick={() => {}} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0, width: 64 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", border: `2.5px dashed ${C.orangeLight}`, display: "flex", alignItems: "center", justifyContent: "center", background: C.orangePale }}>
                    <Plus size={20} color={C.orange} />
                  </div>
                  <span style={{ fontSize: 10, color: C.orange, fontWeight: 700 }}>Ajouter</span>
                </div>
                {stories.map((s, i) => (
                  <div key={s.id} onClick={() => setStoryViewer(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0, width: 64 }}>
                    <div style={{ padding: 2.5, borderRadius: "50%", background: `linear-gradient(135deg, ${C.orange}, ${C.orangeLight})` }}>
                      <div style={{ padding: 2, background: C.white, borderRadius: "50%" }}>
                        <Avatar url={s.tenant.logoUrl} nom={s.tenant.nomBoutique} size={50} />
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: C.gray500, width: "100%", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{s.tenantId === myTenantId ? "Ma story" : s.tenant.nomBoutique}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <SearchBar onResults={() => {}} />

          {/* Filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", scrollbarWidth: "none" }}>
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 700, flexShrink: 0, border: "none", cursor: "pointer", transition: "all .2s", background: filter === f.key ? C.gray900 : C.white, color: filter === f.key ? C.white : C.gray500, boxShadow: filter === f.key ? "0 2px 10px rgba(0,0,0,0.14)" : "0 1px 3px rgba(0,0,0,0.05)" }}>
                <f.Icon size={11} />{f.label}
              </button>
            ))}
          </div>

          {/* Repost banner */}
          {repostTarget && (
            <div style={{ background: C.orange, borderRadius: 16, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <Repeat2 size={15} color="#fff" />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#fff" }}>Reposter le post de {repostTarget.tenant.nomBoutique}</span>
              <button onClick={() => setRepostTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.8)" }}><X size={14} /></button>
            </div>
          )}

          {/* Creator */}
          <PostCreator myNom={myNom} myLogo={myLogo} onPost={handleNewPost} />

          {/* Feed */}
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "64px 0" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${C.orange}, ${C.orangeLight})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Loader2 size={22} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
              </div>
              <span style={{ fontSize: 13, color: C.gray400, fontWeight: 700 }}>Chargement du feed Axsocial...</span>
            </div>
          ) : posts.length === 0 ? (
            <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray100}`, padding: "64px 24px", textAlign: "center" }}>
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><Globe size={52} color={C.gray300} /></div>
              <p style={{ fontWeight: 900, color: C.gray700, margin: 0, fontSize: 18 }}>Sois le premier !</p>
              <p style={{ fontSize: 13, color: C.gray400, marginTop: 8, lineHeight: 1.6 }}>Aucun post pour l'instant.<br />Lance la conversation sur Axsocial.</p>
            </div>
          ) : (
            <>
              {posts.map(p => (
                <PostCard key={p.id} post={p} myTenantId={myTenantId} myNom={myNom} myLogo={myLogo} onDelete={handleDelete} onRepost={handleRepost} />
              ))}
              {nextCursor && (
                <button onClick={async () => { setLoadingMore(true); await loadFeed(nextCursor!); setLoadingMore(false); }} disabled={loadingMore} style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px auto 24px", borderRadius: 999, padding: "10px 28px", fontSize: 13, fontWeight: 700, border: `1px solid ${C.gray200}`, background: C.white, color: C.gray500, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  {loadingMore ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronDown size={13} />} Voir plus
                </button>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div style={{ position: "sticky", top: fullscreen ? 18 : 76 }}>
          {/* Live badge */}
          <div style={{ background: C.navy, borderRadius: 20, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.green, boxShadow: `0 0 0 3px rgba(16,185,129,0.25), 0 0 0 6px rgba(16,185,129,0.1)` }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.white }}>Axsocial Live</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{leaderboard.length} boutiques connectées</div>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.orange, fontWeight: 900 }}>EN DIRECT</span>
          </div>

          <TrendingWidget />
          <Leaderboard entries={leaderboard} />
          <div style={{ marginTop: 12 }}><AxiaPanel myNom={myNom} /></div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
