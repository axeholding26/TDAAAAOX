// Module « commerce » — commandes et clients : fiche complète avec `version`, commande saisie
// pour un client (paiement à la livraison), correction d'une commande, annulation avec
// remboursement, fiche et segments de clients. Le cycle de livraison (confirmer, expédier,
// livrer, assigner un livreur) reste dans lib/axia/tools.ts.
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { PAIEMENT } from "@/lib/commandes";
import { changerStatutCommande } from "@/lib/cycle-livraison";
import { RuptureStock, sortirStock } from "@/lib/stock";
import { prixClient } from "@/lib/pricing";
import { fraisLivraisonServeur, poidsPanier } from "@/lib/livraison";
import { villeCommande } from "@/lib/livraison-reglages";
import { codePays } from "@/lib/devise-convert";
import { notifierMarchand } from "@/lib/notifications-marchand";
import { formatMontant, genererNumeroCommande } from "@/lib/utils";
import { LIBELLES_SEGMENT, SEGMENTS, segmenter, seuilVip, versionAJour, versionClient, type Achats, type Segment } from "./analyse";
import { VERSION, decalage, limite, liste, lu, nombre, objet, ok, parmi, refuser, requis, texte, type Args, type Outil } from "./commun";

const REF_COMMANDE = { type: "string", description: "Numéro de la commande (AX-…) ou son identifiant" };
const jeton = () => randomBytes(20).toString("hex");

async function commandeDe(tenantId: string, a: Args) {
  const ref = requis(a, "order_id", 64).replace(/^#/, "");
  return (await prisma.commande.findFirst({ where: { tenantId, OR: [{ id: ref }, { numero: ref }] }, include: { lignes: { take: 100 } } }))
    ?? refuser("NOT_FOUND", `Commande « ${ref} » introuvable dans cette boutique (lister_commandes donne les numéros).`);
}

// Verrou optimiste des commandes et des clients, vérifié ici : lib/controle-ia/recus.ts ne suit ni Commande
// ni Client (Client n'a pas de colonne updatedAt). Pour les produits, c'est lui qui s'en charge.
const exigerVersion = (a: Args, aJour: (version: unknown) => boolean, actuelle: string) => {
  if (a.version != null && a.version !== "" && !aJour(a.version)) refuser("CONFLICT", `L'élément a été modifié depuis ta lecture (version actuelle : ${actuelle}). Rien n'a été modifié : relis-le puis réessaie.`);
};

// ─── Achats par client ───────────────────────────────────────────────────────
const MAX_ACHETEURS = 5000;

/**
 * Achats payés de chaque client et son segment. Calculé sur les commandes (Client.totalCommandes
 * n'est tenu que par la caisse).
 * ponytail: les 5 000 clients qui ont le plus dépensé ; au-delà, `tronque` le signale — passer
 * à une table d'agrégats tenue à chaque paiement si une boutique dépasse ce nombre.
 */
export async function achatsParClient(tenantId: string) {
  const lignes = await prisma.commande.groupBy({
    by: ["clientId"],
    // L'ancien client fictif de la caisse (« pos@local ») n'est pas un client.
    where: { tenantId, clientId: { not: null }, paiementStatut: PAIEMENT.PAYE, OR: [{ clientEmail: null }, { clientEmail: { not: "pos@local" } }] },
    _count: { _all: true }, _sum: { montantTotal: true }, _min: { createdAt: true }, _max: { createdAt: true },
    orderBy: { _sum: { montantTotal: "desc" } }, take: MAX_ACHETEURS,
  });
  const vip = seuilVip(lignes.map((l) => l._sum.montantTotal ?? 0));
  const maintenant = new Date();
  const clients = lignes.map((l) => {
    const achats: Achats = { commandes: l._count._all, depense: l._sum.montantTotal ?? 0, premiere: l._min.createdAt, derniere: l._max.createdAt };
    return { id: l.clientId!, achats, segment: segmenter(achats, vip, maintenant) };
  });
  return { clients, vip, tronque: lignes.length === MAX_ACHETEURS };
}

const ficheClient = (c: { id: string; nom: string; email: string | null; telephone: string | null; ville: string | null }, x?: { achats: Achats; segment: Segment }) => ({
  customer_id: c.id, name: c.nom, phone: c.telephone, email: c.email, city: c.ville, segment: x?.segment ?? "prospect",
  orders: x?.achats.commandes ?? 0, spent: Math.round(x?.achats.depense ?? 0), last_order_at: x?.achats.derniere?.toISOString() ?? null,
});

export const OUTILS_VENTES: Outil[] = [
  // ─── Commandes ─────────────────────────────────────────────────────────────
  {
    name: "get_order", module: "commandes", niveau: "lecture", capacite: "commandes",
    description: "Fiche complète d'UNE commande : articles, montants, client, adresse, paiement, livraison, et sa `version`. À appeler avant update_order ou cancel_order ; `refund_on_cancel` dit si l'annuler déclencherait un remboursement. Pour le suivi du livreur et le lien de suivi client : statut_commande.",
    parameters: objet({ order_id: REF_COMMANDE }, ["order_id"]),
    sortie: "{ order: { id, number, status, payment_status, total, lines[], customer, shipping, refund_on_cancel }, version }",
    exemple: { order_id: "AX-20261013-K3P9QX" },
    run: async (a, ctx) => {
      const c = await commandeDe(ctx.tenantId, a);
      // Ni jetons (suivi, livreur) ni code de livraison : ce sont des preuves ou des accès, pas des données de travail.
      const order = {
        id: c.id, number: c.numero, status: c.statut, channel: c.canal, created_at: c.createdAt.toISOString(),
        payment_status: c.paiementStatut, payment_method: c.methodePaiement, refund_on_cancel: c.paiementStatut === PAIEMENT.PAYE,
        subtotal: c.montantSousTotal, shipping_fee: c.montantLivraison, discount: c.montantReduction, total: c.montantTotal, currency: c.devise,
        customer: { customer_id: c.clientId, name: c.clientNom, phone: c.clientTelephone, email: c.clientEmail },
        shipping: { address: c.adresseLivraison, city: c.ville, country: c.pays, status: c.livraisonStatut, carrier: c.transporteur, tracking_number: c.numeroSuivi, courier: c.livreurNom, failed_attempts: c.echecCount },
        note: c.noteClient,
        lines: c.lignes.map((l) => ({ product_id: l.produitId, name: l.nom, variant: l.variante, quantity: l.quantite, unit_price: l.prix, discount: l.remise, returned: l.quantiteRetournee })),
      };
      return lu(`Commande #${c.numero} — ${c.statut}, ${formatMontant(c.montantTotal, c.devise)}.`, { order, version: c.updatedAt.toISOString() });
    },
  },
  {
    // Même calcul que la vitrine (app/api/commandes/whatsapp-creer) : prix et frais relus en base, stock sorti dans la transaction.
    name: "create_order", module: "commandes", niveau: "ecriture", risque: "moyen", capacite: "commandes",
    description: "Enregistre une commande pour un client qui a commandé hors de la boutique (téléphone, WhatsApp, sur place) : produits PHYSIQUES, paiement à la livraison. Les prix et les frais de livraison sont ceux de la boutique (jamais saisis) ; le stock est réservé tout de suite et la commande est refusée en cas de rupture. Elle naît « en_attente » : confirme-la puis expédie-la avec changer_statut_commande. Aucun message n'est envoyé au client.",
    parameters: objet({
      customer_id: { type: "string", description: "Client existant (sinon renseigne « customer »)" },
      customer: { type: "object", description: "Nouveau client ou client retrouvé par son téléphone", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" }, city: { type: "string" }, country: { type: "string" } }, required: ["name", "phone"] },
      items: { type: "array", description: "1 à 50 articles", items: { type: "object", properties: { product_id: { type: "string" }, variant_id: { type: "string" }, quantity: { type: "number" } }, required: ["product_id", "quantity"] } },
      address: { type: "string", description: "Adresse de livraison (défaut : celle du client)" }, city: { type: "string" },
      delivery_zone: { type: "string", description: "Quartier ou ville, pour trouver le tarif de livraison (lister_regles_livraison)" },
      note: { type: "string" },
    }, ["items"]),
    sortie: "{ order_id, number, total, shipping_fee, currency, status, version }",
    exemple: { customer: { name: "Awa Diallo", phone: "+237690000000", city: "Douala" }, items: [{ product_id: "cmf0abc123", quantity: 2 }], delivery_zone: "Akwa" },
    run: async (a, ctx) => {
      const tenantId = ctx.tenantId;
      const demandes = (liste(a, "items", 50) ?? []).map((i: Args) => ({
        produitId: requis(i, "product_id", 64), varianteId: texte(i, "variant_id", { max: 64 }) ?? null, quantite: nombre(i, "quantity", { requis: true, entier: true, min: 1, max: 999 })!,
      }));
      if (!demandes.length) return refuser("INVALID_INPUT", "« items » doit contenir au moins un article.");
      const saisi: Args = a.customer && typeof a.customer === "object" ? a.customer : {};
      const clientId = texte(a, "customer_id", { max: 64 });
      if (!clientId && !(texte(saisi, "name") && texte(saisi, "phone"))) return refuser("INVALID_INPUT", "Indique « customer_id », ou « customer » avec name et phone.");

      const [tenant, produits] = await Promise.all([
        prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { devise: true, pays: true, commissionRate: true } }),
        prisma.produit.findMany({
          where: { tenantId, id: { in: demandes.map((d) => d.produitId) } },
          select: { id: true, nom: true, type: true, prix: true, images: true, actif: true, variantes: { where: { actif: true }, select: { id: true, nom: true, valeur: true, prix: true } } },
        }),
      ]);
      const lignes = demandes.map((d) => {
        const p = produits.find((x) => x.id === d.produitId);
        if (!p) return refuser("NOT_FOUND", `Produit ${d.produitId} introuvable dans cette boutique.`);
        if (p.type !== "physique") return refuser("INVALID_INPUT", `« ${p.nom} » est un produit ${p.type} : il se paie en ligne, pas à la livraison.`);
        const v = d.varianteId ? p.variantes.find((x) => x.id === d.varianteId) : null;
        if (d.varianteId && !v) return refuser("NOT_FOUND", `Variante introuvable pour « ${p.nom} » (get_product les liste).`);
        if (!v && p.variantes.length) return refuser("INVALID_INPUT", `« ${p.nom} » a des variantes : précise « variant_id ».`);
        return {
          produitId: p.id, nom: p.nom, prix: prixClient(v?.prix ?? p.prix, tenant.commissionRate ?? 0.1, p.type), quantite: d.quantite,
          imageUrl: p.images[0] ?? null, variante: v ? `${v.nom}: ${v.valeur}` : null, varianteId: v?.id ?? null,
        };
      });

      const telephone = texte(saisi, "phone", { max: 30 });
      let client = clientId
        ? await prisma.client.findFirst({ where: { id: clientId, tenantId } })
        : await prisma.client.findFirst({ where: { tenantId, telephone } });
      if (clientId && !client) return refuser("NOT_FOUND", "Client introuvable dans cette boutique.");
      client ??= await prisma.client.create({
        data: { tenantId, nom: requis(saisi, "name", 100), telephone, email: texte(saisi, "email", { max: 150 }) ?? null, adresse: texte(saisi, "address", { max: 300 }) ?? null, ville: texte(saisi, "city", { max: 80 }) ?? null, pays: texte(saisi, "country", { max: 60 }) ?? null },
      });
      if (!client.telephone) return refuser("INVALID_INPUT", "Ce client n'a pas de téléphone : une commande livrée en demande un (update_customer).");

      const zone = texte(a, "delivery_zone", { max: 80 });
      const adresse = texte(a, "address", { max: 300 }) ?? texte(saisi, "address", { max: 300 }) ?? client.adresse;
      const ville = texte(a, "city", { max: 80 }) ?? texte(saisi, "city", { max: 80 }) ?? client.ville;
      const pays = client.pays ?? tenant.pays;
      const sousTotal = lignes.reduce((s, l) => s + l.prix * l.quantite, 0);
      const livraison = await fraisLivraisonServeur({ tenantId, pays: codePays(pays), zone, poids: await poidsPanier(tenantId, lignes), montantCommande: sousTotal });

      try {
        // Création et sortie du stock dans la même transaction : une rupture annule tout.
        const c = await prisma.$transaction(async (tx) => {
          const cree = await tx.commande.create({
            data: {
              tenantId, numero: genererNumeroCommande(), clientId: client.id, clientNom: client.nom, clientEmail: client.email?.includes("@") ? client.email : null, clientTelephone: client.telephone!,
              adresseLivraison: adresse || "À préciser", adresseExacte: adresse || null, ville: villeCommande(zone, ville) || "—", pays: pays || "—",
              montantSousTotal: sousTotal, montantLivraison: livraison, montantTotal: sousTotal + livraison, devise: tenant.devise,
              statut: "en_attente", paiementStatut: PAIEMENT.ATTENTE, methodePaiement: "direct_cod",
              trackingToken: jeton(), livreurToken: jeton(), noteClient: texte(a, "note", { max: 500 }) ?? null,
              lignes: { create: lignes },
            },
            select: { id: true, numero: true, updatedAt: true },
          });
          await sortirStock(tx, { tenantId, commandeId: cree.id, motif: `Commande #${cree.numero}`, creePar: ctx.userId });
          return cree;
        }, { timeout: 20_000 });
        await notifierMarchand({
          tenantId, type: "nouvelle_commande", titre: `Nouvelle commande #${c.numero}`,
          message: `Saisie par l'IA ${ctx.client} · ${client.nom} · ${lignes.length} article(s) · ${formatMontant(sousTotal + livraison, tenant.devise)}`,
          lien: `/dashboard/commandes/${c.id}`, commandeId: c.id,
        });
        return ok(`Commande #${c.numero} créée pour ${client.nom} : ${formatMontant(sousTotal + livraison, tenant.devise)}${livraison ? ` dont ${formatMontant(livraison, tenant.devise)} de livraison` : ""}, à payer à la livraison. Le stock est réservé ; aucun message n'a été envoyé au client.`,
          { order_id: c.id, number: c.numero, total: sousTotal + livraison, shipping_fee: livraison, currency: tenant.devise, status: "en_attente", customer_id: client.id, version: c.updatedAt.toISOString() });
      } catch (e) {
        if (e instanceof RuptureStock) return refuser("CONFLICT", `${e.message}. La commande n'a pas été créée.`);
        throw e;
      }
    },
  },
  {
    name: "update_order", module: "commandes", niveau: "ecriture", risque: "faible", capacite: "commandes",
    description: "Corrige les informations d'une commande : nom ou téléphone du client, adresse et ville de livraison, note, transporteur et numéro de suivi. Ne change NI les articles, NI les montants, NI le statut (changer_statut_commande, cancel_order). Refusé sur une commande annulée ; l'adresse ne se change plus une fois livrée.",
    parameters: objet({
      order_id: REF_COMMANDE, version: VERSION,
      customer_name: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, city: { type: "string" }, note: { type: "string" },
      carrier: { type: "string", description: "Transporteur" }, tracking_number: { type: "string", description: "Numéro de suivi du colis" },
    }, ["order_id"]),
    sortie: "{ order_id, number, changed: [champs], version }",
    exemple: { order_id: "AX-20261013-K3P9QX", address: "Rue Joss, immeuble Kassap, 2e étage", city: "Douala" },
    run: async (a, ctx) => {
      const c = await commandeDe(ctx.tenantId, a);
      exigerVersion(a, (v) => versionAJour(v, c.updatedAt), c.updatedAt.toISOString());
      if (c.statut === "annulee") return refuser("CONFLICT", `La commande #${c.numero} est annulée : elle ne se modifie plus.`);
      const adresse = texte(a, "address", { max: 300 }), ville = texte(a, "city", { max: 80 });
      if ((adresse || ville) && c.statut === "livree") return refuser("CONFLICT", `La commande #${c.numero} est déjà livrée : son adresse ne se change plus.`);
      const data = {
        ...(texte(a, "customer_name", { max: 100 }) && { clientNom: texte(a, "customer_name", { max: 100 }) }),
        ...(texte(a, "phone", { max: 30 }) && { clientTelephone: texte(a, "phone", { max: 30 }) }),
        // La position GPS partagée par le client ne vaut plus pour une nouvelle adresse.
        ...(adresse && { adresseLivraison: adresse, adresseExacte: adresse, latitudeClient: null, longitudeClient: null, mapsLienClient: null }),
        ...(ville && { ville }),
        ...(texte(a, "note", { max: 500 }) && { noteClient: texte(a, "note", { max: 500 }) }),
        ...(texte(a, "carrier", { max: 80 }) && { transporteur: texte(a, "carrier", { max: 80 }) }),
        ...(texte(a, "tracking_number", { max: 80 }) && { numeroSuivi: texte(a, "tracking_number", { max: 80 }) }),
      };
      const champs = Object.keys(data).filter((k) => !["adresseExacte", "latitudeClient", "longitudeClient", "mapsLienClient"].includes(k));
      if (!champs.length) return refuser("INVALID_INPUT", "Aucun champ à modifier.");
      const maj = await prisma.commande.update({ where: { id: c.id }, data, select: { updatedAt: true } });
      return ok(`Commande #${c.numero} mise à jour (${champs.join(", ")}).`, { order_id: c.id, number: c.numero, changed: champs, version: maj.updatedAt.toISOString() });
    },
  },
  {
    // Effet réel (lib/cycle-livraison.ts) : une commande déjà PAYÉE est d'abord REMBOURSÉE — via NotchPay si elle a été
    // payée en ligne (l'argent sort du portefeuille du marchand) — puis annulée, stock rendu. D'où risque élevé + droit remboursements (regles.ts).
    name: "cancel_order", module: "commandes", niveau: "ecriture", risque: "eleve", capacite: "commandes",
    description: "Annule une commande pas encore livrée ET rembourse le client si elle était payée : paiement en ligne → remboursement NotchPay repris sur le portefeuille du marchand ; paiement reçu en espèces → le marchand rend l'argent lui-même. Le stock revient en rayon, le code promo et les commissions d'affiliation sont libérés, le client est prévenu par WhatsApp. Irréversible. Vérifie d'abord avec get_order (refund_on_cancel).",
    parameters: objet({ order_id: REF_COMMANDE, reason: { type: "string", description: "Motif, gardé dans le journal des actions" }, version: VERSION }, ["order_id", "reason"]),
    sortie: "{ order_id, number, status: \"annulee\", refunded, refund_amount, refund_channel }",
    exemple: { order_id: "AX-20261013-K3P9QX", reason: "Client injoignable depuis 5 jours" },
    run: async (a, ctx) => {
      const c = await commandeDe(ctx.tenantId, a);
      requis(a, "reason", 300);
      exigerVersion(a, (v) => versionAJour(v, c.updatedAt), c.updatedAt.toISOString());
      const payee = c.paiementStatut === PAIEMENT.PAYE, enLigne = c.methodePaiement === "notchpay";
      const r = await changerStatutCommande({ commandeId: c.id, statut: "annulee", acteur: { type: "marchand", tenantId: ctx.tenantId, source: "axia" } });
      if (!r.ok) return refuser(r.status >= 500 ? "UNAVAILABLE" : r.status === 404 ? "NOT_FOUND" : r.status === 403 ? "PLAN_REQUIRED" : "CONFLICT", `${r.error}. La commande n'a pas été annulée.`);
      const montant = formatMontant(c.montantTotal, c.devise);
      return ok(
        `Commande #${c.numero} annulée, stock rendu. ${!payee ? "Elle n'était pas payée : rien à rembourser." : enLigne ? `${montant} remboursés au client via NotchPay et repris sur le portefeuille du marchand.` : `Elle avait été payée hors ligne : le marchand doit rendre ${montant} au client lui-même.`}`,
        { order_id: c.id, number: c.numero, status: "annulee", refunded: payee, refund_amount: payee ? c.montantTotal : 0, refund_channel: !payee ? null : enLigne ? "notchpay" : "especes" },
      );
    },
  },

  // ─── Clients ───────────────────────────────────────────────────────────────
  {
    name: "get_customer", module: "clients", niveau: "lecture", capacite: "clients",
    description: "Fiche complète d'UN client (par identifiant, téléphone ou email) : coordonnées, achats payés, segment calculé, fidélité, crédit en magasin, 5 dernières commandes, et sa `version`. À appeler avant update_customer.",
    parameters: objet({ customer_id: { type: "string" }, phone: { type: "string" }, email: { type: "string" } }),
    sortie: "{ customer: { customer_id, name, phone, email, segment, orders, spent, loyalty, credit, recent_orders[] }, version }",
    exemple: { phone: "+237690000000" },
    run: async (a, ctx) => {
      const tenantId = ctx.tenantId;
      const id = texte(a, "customer_id", { max: 64 }), telephone = texte(a, "phone", { max: 30 }), email = texte(a, "email", { max: 150 });
      if (!id && !telephone && !email) return refuser("INVALID_INPUT", "Indique customer_id, phone ou email.");
      const c = await prisma.client.findFirst({ where: { tenantId, ...(id ? { id } : telephone ? { telephone } : { email }) } });
      if (!c) return refuser("NOT_FOUND", "Client introuvable dans cette boutique.");
      const [achats, commandes] = await Promise.all([
        achatsParClient(tenantId),
        prisma.commande.findMany({ where: { tenantId, clientId: c.id }, orderBy: { createdAt: "desc" }, take: 5, select: { numero: true, statut: true, paiementStatut: true, montantTotal: true, createdAt: true } }),
      ]);
      const customer = {
        ...ficheClient(c, achats.clients.find((x) => x.id === c.id)), address: c.adresse, country: c.pays, label: c.segment, since: c.createdAt.toISOString(),
        loyalty: { points: c.pointsFidelite, tier: c.niveauFidelite },
        credit: { limit: c.creditPlafond, used: c.creditUtilise, blocked: c.creditBloque },
        recent_orders: commandes.map((o) => ({ number: o.numero, status: o.statut, payment_status: o.paiementStatut, total: o.montantTotal, at: o.createdAt.toISOString() })),
      };
      return lu(`Client ${c.nom} — ${LIBELLES_SEGMENT[customer.segment]}, ${customer.orders} achat(s) payé(s).`, { customer, version: versionClient(c) });
    },
  },
  {
    name: "update_customer", module: "clients", niveau: "ecriture", risque: "faible", capacite: "clients",
    description: "Corrige la fiche d'un client : nom, téléphone, email, adresse, ville, pays, étiquette libre (label, ex. « grossiste »). Ne touche NI aux points de fidélité, NI au crédit en magasin. Ne renseigne que les champs à changer.",
    parameters: objet({
      customer_id: { type: "string" }, version: VERSION, name: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
      address: { type: "string" }, city: { type: "string" }, country: { type: "string" }, label: { type: "string", description: "Étiquette libre du marchand (40 caractères)" },
    }, ["customer_id"]),
    sortie: "{ customer_id, changed: [champs], version }",
    exemple: { customer_id: "cmf0cli789", city: "Yaoundé", label: "grossiste" },
    run: async (a, ctx) => {
      const c = await prisma.client.findFirst({ where: { id: requis(a, "customer_id", 64), tenantId: ctx.tenantId } });
      if (!c) return refuser("NOT_FOUND", "Client introuvable dans cette boutique.");
      exigerVersion(a, (v) => v === versionClient(c), versionClient(c));
      const email = texte(a, "email", { max: 150 });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return refuser("INVALID_INPUT", "« email » n'est pas une adresse valide.");
      const data = Object.fromEntries(Object.entries({
        nom: texte(a, "name", { max: 100 }), telephone: texte(a, "phone", { max: 30 }), email, adresse: texte(a, "address", { max: 300 }),
        ville: texte(a, "city", { max: 80 }), pays: texte(a, "country", { max: 60 }), segment: texte(a, "label", { max: 40 }),
      }).filter(([, v]) => v !== undefined));
      if (!Object.keys(data).length) return refuser("INVALID_INPUT", "Aucun champ à modifier.");
      const maj = await prisma.client.update({ where: { id: c.id }, data });
      return ok(`Fiche de ${maj.nom} mise à jour (${Object.keys(data).join(", ")}).`, { customer_id: c.id, changed: Object.keys(data), version: versionClient(maj) });
    },
  },
  {
    name: "segment_customers", module: "clients", niveau: "lecture", capacite: "clients",
    description: `Liste les clients d'un segment, pour cibler une relance ou une offre : ${SEGMENTS.map((s) => `${s} = ${LIBELLES_SEGMENT[s]}`).join(" ; ")}. Les segments sont calculés sur les commandes payées. Pour le poids de chaque segment : analyze_customer_segments.`,
    parameters: objet({ segment: { type: "string", enum: SEGMENTS }, limit: { type: "number", description: "20 par défaut, 50 au plus" }, offset: { type: "number" } }, ["segment"]),
    sortie: "{ segment, total, customers: [{ customer_id, name, phone, email, orders, spent, last_order_at }] }",
    exemple: { segment: "at_risk", limit: 20 },
    run: async (a, ctx) => {
      const tenantId = ctx.tenantId;
      const segment = parmi(a, "segment", SEGMENTS);
      const max = limite(a, 20, 50), saut = decalage(a);
      const select = { id: true, nom: true, email: true, telephone: true, ville: true } as const;
      if (segment === "prospect") {
        const where = { tenantId, commandes: { none: { paiementStatut: PAIEMENT.PAYE } } };
        const [clients, total] = await Promise.all([prisma.client.findMany({ where, orderBy: { createdAt: "desc" }, take: max, skip: saut, select }), prisma.client.count({ where })]);
        return lu(`${total} client(s) n'ont jamais acheté.`, { segment, total, customers: clients.map((c) => ficheClient(c)) });
      }
      const achats = await achatsParClient(tenantId);
      const du = achats.clients.filter((c) => c.segment === segment);
      const page = du.slice(saut, saut + max);
      const fiches = await prisma.client.findMany({ where: { tenantId, id: { in: page.map((c) => c.id) } }, select });
      return lu(`${du.length} client(s) dans le segment « ${LIBELLES_SEGMENT[segment]} »${achats.tronque ? " (calcul limité aux 5 000 meilleurs acheteurs)" : ""}.`, {
        segment, total: du.length,
        customers: page.flatMap((x) => { const c = fiches.find((f) => f.id === x.id); return c ? [ficheClient(c, x)] : []; }),
      });
    },
  },
];
