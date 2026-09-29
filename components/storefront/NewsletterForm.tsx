"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";

interface Props {
  slug: string;
  placeholder: string;
  cta: string;
  inputStyle: React.CSSProperties;
  buttonStyle: React.CSSProperties;
}

export function NewsletterForm({ slug, placeholder, cta, inputStyle, buttonStyle }: Props) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [siteWeb, setSiteWeb] = useState(""); // honeypot
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    try {
      const res = await fetch(`/api/storefront/${slug}/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, site_web: siteWeb }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Inscription impossible");
      toast.success(t("Merci, vous êtes inscrit !"));
      setEmail("");
    } catch (err: any) {
      toast.error(t(err.message));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col sm:flex-row gap-3 justify-center">
      <input type="text" name="site_web" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} autoComplete="email"
        className="flex-1 px-5 py-3.5 text-sm border focus:outline-none max-w-sm" style={inputStyle} />
      <button type="submit" disabled={envoi} className="px-7 py-3.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50" style={buttonStyle}>
        {cta}
      </button>
    </form>
  );
}
