"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

interface Props {
  slug: string;
  accent: string;
  texte: string;
  fond: string;
}

export function ContactForm({ slug, accent, texte, fond }: Props) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [siteWeb, setSiteWeb] = useState(""); // honeypot — jamais rempli par un humain
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim() || !email.trim() || !message.trim()) { toast.error("Merci de remplir tous les champs"); return; }
    setEnvoi(true);
    try {
      const res = await fetch(`/api/storefront/${slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, email, message, site_web: siteWeb }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");
      toast.success("Message envoyé — vous recevrez une réponse bientôt !");
      setNom(""); setEmail(""); setMessage("");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi du message");
    } finally {
      setEnvoi(false);
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors";
  const inputStyle = { backgroundColor: `${accent}0a`, color: texte, border: `1px solid ${accent}20` };

  return (
    <form onSubmit={envoyer} className="space-y-4 max-w-lg">
      <input
        type="text" name="site_web" value={siteWeb} onChange={e => setSiteWeb(e.target.value)}
        className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true"
      />
      <div>
        <label className="text-xs font-semibold mb-1.5 block" style={{ color: texte, opacity: 0.7 }}>Nom</label>
        <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Votre nom" className={inputCls} style={inputStyle} />
      </div>
      <div>
        <label className="text-xs font-semibold mb-1.5 block" style={{ color: texte, opacity: 0.7 }}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@example.com" className={inputCls} style={inputStyle} />
      </div>
      <div>
        <label className="text-xs font-semibold mb-1.5 block" style={{ color: texte, opacity: 0.7 }}>Message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Votre message..." rows={5} className={`${inputCls} resize-none`} style={inputStyle} />
      </div>
      <button
        type="submit" disabled={envoi}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: accent, color: fond }}
      >
        {envoi ? <><Loader2 size={15} className="animate-spin" /> Envoi...</> : <><Send size={15} /> Envoyer le message</>}
      </button>
    </form>
  );
}
