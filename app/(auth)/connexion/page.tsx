"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaConnexion } from "@/lib/validations";
import type { z } from "zod";
import { Eye, EyeOff, Loader2, ShieldCheck, Zap, Globe } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { estRoleAdmin } from "@/lib/command-center/rbac";
import { demanderCodeConnexion } from "@/components/auth/BoutonRenvoyerCode";
import { EcranCode } from "@/components/auth/EcranCode";

type FormConnexion = z.infer<typeof schemaConnexion>;

const FEATURES = [
  { icon: Zap,        text: "Lancez votre boutique en 3 minutes" },
  { icon: Globe,      text: "Acceptez Orange Money, MTN MoMo et la livraison" },
  { icon: ShieldCheck, text: "Gestion complète de votre activité" },
];

const ACCENT = "#F5A623";
const ACCENT_DARK = "#d4880d";

function ConnexionForm() {
  const t = useT();
  const router       = useRouter();
  const searchParams = useSearchParams();
  // Uniquement un chemin interne : empêche une redirection vers un site externe via ?callbackUrl=
  const cb           = searchParams.get("callbackUrl");
  const callbackUrl  = cb?.startsWith("/") && !cb.startsWith("//") ? cb : "/dashboard";
  const inscriptionReussie = searchParams.get("inscription") === "success";

  const [showPass, setShowPass] = useState(false);
  const [erreur,   setErreur]   = useState("");
  const [etape, setEtape] = useState<"identifiants" | "code">("identifiants");
  const [identifiants, setIdentifiants] = useState<{ email: string; password: string } | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormConnexion>({
    resolver: zodResolver(schemaConnexion),
  });

  // Renvoie un message d'erreur, ou null une fois connecté.
  async function finaliserConnexion(email: string, password: string, code?: string): Promise<string | null> {
    const result = await signIn("credentials", { email, password, code, redirect: false });
    if (result?.error) return code ? "Code invalide ou expiré" : "Email ou mot de passe incorrect";
    const sessionRes = await fetch("/api/auth/session");
    const session    = await sessionRes.json();
    if (session?.user?.role === "livreur") router.push("/livreur");
    else if (estRoleAdmin(session?.user?.role)) router.push("/admin");
    else router.push(callbackUrl);
    router.refresh();
    return null;
  }

  const onSubmit = async (data: FormConnexion) => {
    setErreur("");
    try {
      let skip2fa: boolean;
      try { skip2fa = await demanderCodeConnexion(data.email, data.password); }
      catch (e: any) { setErreur(e.message); return; }

      if (skip2fa) {
        const err = await finaliserConnexion(data.email, data.password);
        if (err) setErreur(err);
      } else {
        setIdentifiants({ email: data.email, password: data.password });
        setEtape("code");
      }
    } catch {
      setErreur("Erreur de connexion, réessaie");
    }
  };

  const inputCls =
    "w-full bg-white border border-[#E5E5E5] rounded-xl px-4 py-3.5 text-[#111111] text-base sm:text-sm " +
    "placeholder:text-[#999999] focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/15 focus:outline-none transition-all";

  if (etape === "code" && identifiants) {
    return (
      <EcranCode
        email={identifiants.email}
        onValider={(code) => finaliserConnexion(identifiants.email, identifiants.password, code)}
        onRenvoyer={async () => { await demanderCodeConnexion(identifiants.email, identifiants.password); }}
        onRetour={() => { setEtape("identifiants"); setErreur(""); }}
      />
    );
  }

  return (
    <div
      className="rounded-3xl p-8 border"
      style={{
        background: "#ffffff",
        borderColor: "rgba(245,166,35,0.2)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(245,166,35,0.06)",
      }}
    >
      <h2 className="text-2xl font-bold text-[#111111] mb-1">{t("Bon retour")}</h2>
      <p className="text-[#808080] text-sm mb-7">{t("Connectez-vous à votre espace marchand")}</p>

      {inscriptionReussie && (
        <div className="rounded-xl p-3 text-sm text-center mb-5 flex items-center justify-center gap-2"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}>
          <ShieldCheck size={15} />{" "}{t("Boutique créée avec succès !")}
        </div>
      )}

      {erreur && (
        <div className="rounded-xl p-3 text-sm text-center mb-5"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          {t(erreur)}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="connexion-email" className="block text-[#595959] text-sm font-medium mb-1.5">{t("Email")}</label>
          <input id="connexion-email" type="email" autoComplete="email" {...register("email")} placeholder="aminata@example.com" className={inputCls} />
          {errors.email && <p className="text-red-400 text-xs mt-1">{t(errors.email.message)}</p>}
        </div>

        <div>
          <label htmlFor="connexion-password" className="block text-[#595959] text-sm font-medium mb-1.5">{t("Mot de passe")}</label>
          <div className="relative">
            <input id="connexion-password" type={showPass ? "text" : "password"} autoComplete="current-password" {...register("password")}
              placeholder="••••••••" className={inputCls + " pr-10"} />
            <button type="button" onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#444444] transition-colors">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-red-400 text-xs mt-1">{t(errors.password.message)}</p>}
        </div>

        <div className="flex justify-end">
          <Link href="/mot-de-passe-oublie" className="text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: ACCENT }}>
            {t("Mot de passe oublié ?")}
          </Link>
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
            color: "#080808",
            boxShadow: `0 8px 30px rgba(245,166,35,0.35)`,
          }}>
          {isSubmitting
            ? <><Loader2 size={16} className="animate-spin" />{" "}{t("Connexion...")}</>
            : t("Se connecter →")}
        </button>
      </form>

      <p className="text-center text-[#808080] text-sm mt-6">
        {t("Pas encore de boutique ?")}{" "}
        <Link href="/inscription" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: ACCENT }}>
          {t("Créer gratuitement")}
        </Link>
      </p>
    </div>
  );
}

export default function ConnexionPage() {
  const t = useT();
  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#ffffff", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      {/* Ambient gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.08) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.018]"
          style={{ backgroundImage: "linear-gradient(rgba(245,166,35,1) 1px,transparent 1px),linear-gradient(90deg,rgba(245,166,35,1) 1px,transparent 1px)", backgroundSize: "52px 52px" }} />
      </div>

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] px-16 py-12 relative">
        <Link href="/">
          <img src="/logo.png" alt="axso"
            style={{ height: "56px", width: "auto", objectFit: "contain" }} />
        </Link>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold text-[#111111] leading-tight mb-4">
            {t("Gérez votre boutique")}<br />
            <span style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              {t("comme un empire")}
            </span>
          </h1>

          <p className="text-[#666666] text-base leading-relaxed mb-8">
            {t("La plateforme e-commerce pensée pour les entrepreneurs africains. Simple, puissante, et adaptée à vos besoins.")}
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.2)" }}>
                  <Icon size={15} style={{ color: ACCENT }} />
                </div>
                <span className="text-[#4D4D4D] text-sm">{t(text)}</span>
              </div>
            ))}
          </div>

        </div>

        <p className="text-[#B3B3B3] text-xs">© {new Date().getFullYear()} Axso · Made for Africa</p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden flex justify-center mb-8">
            <img src="/logo.png" alt="axso"
              style={{ height: "72px", width: "auto", objectFit: "contain" }} />
          </Link>
          <Suspense fallback={
            <div className="rounded-3xl p-8 text-center text-[#999999] text-sm"
              style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.15)", boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
              {t("Chargement...")}
            </div>
          }>
            <ConnexionForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
