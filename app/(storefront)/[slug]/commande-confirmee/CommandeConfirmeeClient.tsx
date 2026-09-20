"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Truck, Package } from "lucide-react";
import { formatMontant } from "@/lib/utils";

interface Ligne {
  id: string;
  nom: string;
  quantite: number;
  prix: number;
  imageUrl: string | null;
  variante: string | null;
}

interface Props {
  commande: {
    id: string;
    numero: string;
    montantTotal: number;
    devise: string;
    clientNom: string;
    clientEmail: string;
    lignes: Ligne[];
  };
  theme: {
    fond: string;
    texte: string;
    accent: string;
    surface: string;
  };
  slug: string;
  nomBoutique: string;
  tenantDevise: string;
}

export function CommandeConfirmeeClient({ commande, theme, slug, nomBoutique, tenantDevise }: Props) {
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const devise = commande.devise || tenantDevise;

  async function ouvrirWhatsApp() {
    setChargement(true);
    setErreur("");
    try {
      const res = await fetch("/api/commandes/whatsapp-redirect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandeId: commande.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.message || "Erreur lors de la génération du lien WhatsApp.");
        return;
      }
      // Ouvrir WhatsApp dans un nouvel onglet
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setErreur("Impossible de générer le lien WhatsApp. Veuillez réessayer.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header — checkmark animé */}
      <div className="text-center py-6">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse"
          style={{
            backgroundColor: `${theme.accent}18`,
            border: `3px solid ${theme.accent}`,
            animationDuration: "2s",
          }}
        >
          <CheckCircle size={44} style={{ color: theme.accent }} />
        </div>
        <h1 className="text-3xl font-bold font-playfair mb-2" style={{ color: theme.accent }}>
          Commande reçue !
        </h1>
        <p className="opacity-70 text-lg">
          Merci {commande.clientNom}
        </p>
        <p className="opacity-40 text-sm mt-1">
          Votre commande #{commande.numero} a bien été enregistrée.
        </p>
      </div>

      {/* Résumé commande */}
      <div
        className="rounded-2xl border p-6 space-y-3"
        style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}
      >
        <h3 className="font-semibold text-sm opacity-70 mb-3">Récapitulatif</h3>
        <div className="flex justify-between text-sm">
          <span className="opacity-60">N° commande</span>
          <span className="font-mono font-bold" style={{ color: theme.accent }}>
            {commande.numero}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-60 text-sm">Total</span>
          <span className="font-bold text-lg" style={{ color: theme.accent }}>
            {formatMontant(commande.montantTotal, devise)}
          </span>
        </div>

        {/* Lignes commande */}
        <div
          className="border-t pt-4 mt-2 space-y-2"
          style={{ borderColor: `${theme.accent}15` }}
        >
          {commande.lignes.map((ligne) => (
            <div key={ligne.id} className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: `${theme.accent}10` }}
              >
                {ligne.imageUrl ? (
                  <img
                    src={ligne.imageUrl}
                    alt={ligne.nom}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package size={20} className="opacity-40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ligne.nom}</p>
                {ligne.variante && (
                  <p className="text-xs opacity-50">{ligne.variante}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold" style={{ color: theme.accent }}>
                  x{ligne.quantite}
                </p>
                <p className="text-xs opacity-50">
                  {formatMontant(ligne.prix * ligne.quantite, devise)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section paiement à la livraison */}
      <div
        className="rounded-2xl border p-6 space-y-4"
        style={{
          backgroundColor: `#25D36618`,
          borderColor: `#25D36640`,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-500/15 border border-green-500/30">
            <Truck size={20} className="text-green-500" />
          </div>
          <div>
            <p className="font-bold text-green-600 text-base">Paiement à la livraison</p>
            <p className="text-sm opacity-60">Vous payez à la réception de votre colis</p>
          </div>
        </div>

        <p className="text-sm opacity-70 leading-relaxed">
          Votre marchand{" "}
          <span className="font-semibold opacity-100">{nomBoutique}</span>{" "}
          vous contactera pour organiser la livraison et confirmer les détails.
        </p>

        {/* Erreur éventuelle */}
        {erreur && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
            <p className="text-red-500 text-sm">{erreur}</p>
          </div>
        )}

        {/* Bouton WhatsApp */}
        <button
          onClick={ouvrirWhatsApp}
          disabled={chargement}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: "#25D366", color: "#ffffff" }}
        >
          {chargement ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          )}
          {chargement ? "Génération du lien..." : "Confirmer sur WhatsApp"}
        </button>

        <p className="text-xs opacity-40 text-center">
          Appuyez sur le bouton pour envoyer les détails de votre commande au marchand via WhatsApp
        </p>
      </div>

      {/* Lien retour boutique */}
      <div className="text-center pt-2">
        <Link
          href={`/${slug}`}
          className="text-sm transition-opacity hover:opacity-80"
          style={{ color: theme.accent, opacity: 0.6 }}
        >
          ← Retour à la boutique
        </Link>
      </div>
    </div>
  );
}
