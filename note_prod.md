# Note de mise en production

> **Origine de cette note** : conversation du **12/10/2026** avec Claude Code.
> Sujet : vérification des trois grands chantiers (Dropshipping Engine, Supplier
> Intelligence Engine, POS 2.0), puis correction des 20 bugs trouvés par l'audit.
>
> **À quoi sert cette note** : tout le travail a été fait et vérifié **en local**.
> Rien n'a été déployé ni committé. Cette note liste, dans l'ordre, tout ce que
> tu dois faire toi-même pour que ces corrections fonctionnent en production.
> Chaque bloc dit **quoi faire**, **où**, **pourquoi**, et **ce qui casse si tu l'oublies**.
>
> Coche les cases au fur et à mesure.

---

## ÉTAPE 0 — Avant de déployer

### 0.1 Sauvegarder la base de production

- [ ] Faire une sauvegarde (ou un point de restauration Neon) de la base de prod.

**Pourquoi** : le déploiement lance `prisma db push`, qui modifie la structure de
la base (voir 2.1). La modification est sans perte de données, mais on ne touche
jamais une base de prod sans sauvegarde.

### 0.2 Committer et pousser le code

- [ ] Relire `git status` (environ 160 fichiers modifiés ou nouveaux).
- [ ] Committer, puis pousser sur `main`.

**Pourquoi** : rien n'est committé. Tant que ce n'est pas poussé, la prod garde
l'ancien code, avec toutes les failles décrites plus bas.

**À savoir** : trois fichiers ont été **supprimés volontairement**. C'est normal :
- `app/api/ai/agent-dropshipping/route.ts` (ancien agent IA qui inventait des produits, des prix et des fournisseurs)
- `app/api/dropshipping/produits/route.ts` (route morte, dangereuse)
- `app/api/dropshipping/fournisseurs/route.ts` (route morte, dangereuse)

---

## ÉTAPE 1 — Variables d'environnement (Vercel → Project → Settings → Environment Variables → Production)

À faire **avant** le déploiement, sinon des fonctions se bloquent dès la mise en ligne.

### 1.1 `META_APP_SECRET` — OBLIGATOIRE

- [ ] Vérifier qu'elle existe et qu'elle est correcte.

**Où trouver la valeur** : Meta for Developers → ton application → Paramètres →
Général → « Clé secrète de l'application ».

**Pourquoi** : avant, n'importe qui pouvait envoyer de faux événements au webhook
Meta (fausses dépenses pub, faux clients, faux messages). Maintenant les webhooks
Meta **et** WhatsApp vérifient la signature de chaque événement avec ce secret.

**Si tu l'oublies** : les deux webhooks refusent **tout** (erreur 401). Plus de
messages WhatsApp entrants, plus de leads, plus de messages Instagram, plus de
statistiques de campagnes.

### 1.2 `CRON_SECRET` — OBLIGATOIRE

- [ ] Créer la variable avec une valeur aléatoire d'au moins 16 caractères.

**Pourquoi** : aucune tâche automatique ne tournait. Deux tâches quotidiennes
sont maintenant déclarées dans `vercel.json`, et Vercel les appelle avec ce secret.

**Si tu l'oublies** : les 5 routes `/api/cron/*` répondent 401 et aucune tâche ne
tourne (pas d'alerte de certification expirée, pas d'alerte de caisse).

### 1.3 `NOTCHPAY_PRIVATE_KEY`, `NOTCHPAY_PUBLIC_KEY`, `NOTCHPAY_WEBHOOK_SECRET` — À VÉRIFIER

- [ ] Vérifier que les trois sont présentes et que ce sont les clés **live**.

**Pourquoi** : avant, une commande ou un abonnement passait à « payé » sans que
le montant réellement payé soit comparé au montant dû. Maintenant chaque paiement
est relu chez NotchPay avec la clé privée et comparé (montant + devise + référence).

**Si la clé privée est fausse ou absente** : la relecture échoue et la
confirmation ne repose plus que sur l'événement webhook.

### 1.4 `META_WEBHOOK_VERIFY_TOKEN` et `NEXT_PUBLIC_META_WEBHOOK_TOKEN` — RECOMMANDÉ

- [ ] Définir les deux avec la **même** valeur personnelle, puis mettre cette
      valeur dans la configuration du webhook côté Meta.

**Pourquoi** : sans elles, le code utilise la valeur par défaut `axso_meta_2026`,
qui est écrite en clair dans le code source. Ce point n'a **pas** été modifié dans
le code, c'est juste une variable à régler.

---

## ÉTAPE 2 — Déploiement

### 2.1 Changement de structure de base (automatique)

- [ ] Rien à lancer à la main : `prisma db push` s'exécute pendant le build Vercel.
- [ ] Vérifier dans les logs du build qu'il se termine sans erreur.

**Ce qui change** (trois modifications, toutes sans perte de données) :

| Changement | Pourquoi |
|---|---|
| `Fournisseur.delaiLivraison` devient facultative et perd sa valeur par défaut de 15 jours | Tout nouveau fournisseur affichait « 15 jours annoncés » alors que personne ne l'avait annoncé. Maintenant c'est « Non communiqué ». Les fournisseurs existants gardent leur valeur. |
| Nouvelle colonne `CommandeFournisseur.motifAnnulation` | Savoir si une annulation est la faute du fournisseur (voir 6.8). |
| Nouvelle colonne `Caisse.ecranVenteAt` | Savoir si l'écran de vente est ouvert sur l'ordinateur (voir 6.2). |

**Si tu utilises `prisma migrate deploy` au lieu de `db push`** : les trois
migrations sont dans `prisma/migrations/` et commencent par `20261012`.

### 2.2 Vérifier que les tables du POS 2.0 existent en prod

- [ ] Après le build, vérifier que la table `JournalAudit` existe dans la base de prod.

**Pourquoi** : la gestion des entrepôts écrit maintenant dans le journal d'audit.

**Si la table manque** : toute création, modification ou suppression d'entrepôt
renvoie une erreur 500.

---

## ÉTAPE 3 — SQL à exécuter À LA MAIN sur la base de prod (une seule fois)

`prisma db push` ne crée pas les triggers. Il faut donc lancer ce SQL toi-même
(console SQL Neon). Il est rejouable sans risque.

### 3.1 Rendre le journal d'audit impossible à modifier — OBLIGATOIRE

- [ ] Exécuter :

```sql
CREATE OR REPLACE FUNCTION journal_audit_immuable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'JournalAudit est en ajout seul : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_audit_immuable ON "JournalAudit";
CREATE TRIGGER journal_audit_immuable BEFORE UPDATE OR DELETE ON "JournalAudit"
  FOR EACH ROW EXECUTE FUNCTION journal_audit_immuable();

DROP TRIGGER IF EXISTS journal_audit_immuable_vidage ON "JournalAudit";
CREATE TRIGGER journal_audit_immuable_vidage BEFORE TRUNCATE ON "JournalAudit"
  FOR EACH STATEMENT EXECUTE FUNCTION journal_audit_immuable();
```

**Pourquoi** : c'est ce qui garantit qu'une annulation, une remise ou un écart de
caisse ne peut pas être effacé après coup.

**Si tu l'oublies** : une ligne du journal peut être modifiée ou supprimée
directement en base.

### 3.2 Classer les anciennes ventes de caisse — RECOMMANDÉ

- [ ] Exécuter :

```sql
UPDATE "Commande" SET "canal" = 'pos' WHERE "clientEmail" = 'pos@local' AND "canal" <> 'pos';
```

**Pourquoi** : les ventes faites avec l'ancienne caisse sont rangées avec les
ventes en ligne, ce qui fausse les statistiques (taux de conversion notamment).

### 3.3 Le reste du SQL manuel

- [ ] Lire la section 5 de `prisma/migrations/20261011120000_pos_v2/migration.sql`
      (à partir de la ligne 785). Le point 5.3 (répartition du stock par entrepôt)
      est marqué facultatif.

---

## ÉTAPE 4 — Vérifications juste après le déploiement

### 4.1 Tâches planifiées

- [ ] Vercel → Project → Settings → Cron Jobs : deux tâches doivent apparaître.
- [ ] Cliquer « Run » sur chacune : les logs doivent montrer une réponse 200.

| Tâche | Heure (UTC) | Heure à Douala | Rôle |
|---|---|---|---|
| `/api/cron/surveillance-fournisseurs` | 04:00 | 05:00 | Certifications expirées, signaux de risque, meilleur fournisseur disponible |
| `/api/cron/pos/alertes` | 04:30 | 05:30 | Alertes de caisse et de stock, nettoyage des événements de plus de 24 h |

**Limite de l'offre Vercel Hobby** : une exécution par jour maximum, à l'heure
près (04:00 peut partir jusqu'à 04:59).

### 4.2 Paiement de test réel — OBLIGATOIRE AVANT D'OUVRIR AUX CLIENTS

- [ ] Passer une vraie commande d'un petit montant en XAF et la payer.
      Elle doit passer à « payée » et le portefeuille du marchand doit être crédité.
- [ ] Faire le même test sur un abonnement palier 1 (6 000 XAF).

**Pourquoi** : le contrôle du montant payé est nouveau et n'a pas pu être testé
avec un vrai paiement en local. Si NotchPay renvoie un montant net de frais ou une
devise convertie, des paiements **légitimes** seraient refusés.

**Si le test échoue** : chercher dans les logs Vercel
`[paiement-commande] paiement refusé` ou `[notchpay/webhook] abonnement refusé`.
La ligne donne le montant et la devise attendus et reçus. Ne pas ouvrir aux
clients tant que ce test ne passe pas.

### 4.3 Webhooks Meta et WhatsApp

- [ ] Envoyer un message WhatsApp de test à une boutique connectée : il doit arriver dans le dashboard.

**Si rien n'arrive** : `META_APP_SECRET` est faux ou absent (voir 1.1).

### 4.4 Planificateur externe (seulement si tu en as un)

- [ ] Si un service externe appelle `/api/cron/agents` ou `/api/cron/publications`,
      lui ajouter l'en-tête `x-cron-secret: <valeur de CRON_SECRET>`.

**Pourquoi** : ces deux routes étaient ouvertes à tout le monde quand
`CRON_SECRET` n'était pas défini. Elles exigent maintenant le secret.

---

## ÉTAPE 5 — Données à repasser en revue une fois

### 5.1 Fournisseurs déjà marqués « vérifiés »

- [ ] Ouvrir `/admin/fournisseurs`, cocher « Tous les fournisseurs », et repasser
      sur ceux qui sont déjà vérifiés.

**Pourquoi** : avant, un marchand pouvait modifier sa fiche après vérification et
garder le label. C'est corrigé pour l'avenir, mais pas de façon rétroactive.

### 5.2 Prix d'achat des produits dropshipping

- [ ] Renseigner le prix d'achat des produits rattachés à un fournisseur.

**Pourquoi** : avant, le système inventait un coût égal à 50 % du prix de vente.
Maintenant, sans prix d'achat, la commande fournisseur est créée à 0 avec la note
« Prix d'achat à renseigner ». Les anciennes commandes fournisseur gardent leur
montant inventé à 50 % : elles ne sont pas recalculées.

### 5.3 Stocks des entrepôts

- [ ] Si un entrepôt principal a déjà été changé, ou un entrepôt non vide supprimé
      en prod : faire un inventaire des entrepôts concernés.

**Pourquoi** : ces deux gestes déplaçaient du stock sans laisser de trace. C'est
bloqué pour l'avenir, mais les décalages passés ne sont pas réparés.

### 5.4 Offres fournisseurs en devise inconnue

- [ ] Vérifier les offres saisies avec une devise inhabituelle.

**Pourquoi** : une devise non reconnue était convertie à 1 pour 1. Les nouvelles
saisies sont refusées, et « RMB », « $ », « € », « FCFA » sont maintenant compris.
Une ancienne ligne dans une devise réellement inconnue reste fausse.

---

## ÉTAPE 6 — À annoncer aux marchands et à leurs équipes

Ces changements sont voulus, mais ils modifient ce que les gens peuvent faire.

### 6.1 Remises à l'ancienne caisse

Un caissier sans le droit « remise » ne peut plus faire de remise. Au-delà du
plafond (10 % par défaut), il faut le droit « remise hors plafond ». Remise de
ligne et remise globale sont maintenant additionnées pour ce contrôle.

- [ ] Vérifier les droits des caissiers dans Équipe, ou ajuster le plafond dans Réglages de la caisse.

### 6.2 Scanner téléphone

L'écran de **vente** doit être ouvert sur l'ordinateur. Si l'ordinateur est sur un
autre écran (Retours, Stock, etc.) ou si la caisse est fermée, le téléphone affiche
« Refusé » avec la raison, au lieu de faire croire que l'article est au panier.

**Limite connue** : si l'onglet de la caisse est fermé brutalement (ou si
l'ordinateur plante), le téléphone peut encore afficher « Envoyé » pendant
90 secondes au maximum.

### 6.3 Membres limités à un magasin

Ils sont maintenant refusés sur les ventes, retours, inventaires, transferts et
réceptions des autres magasins.

- [ ] Vérifier que les responsables multi-magasins n'ont pas de restriction de magasin.

### 6.4 Annulation d'une vente en espèces

Impossible caisse fermée : il faut une session de caisse ouverte.

### 6.5 Postes de caisse

- [ ] Recharger la page de caisse sur chaque poste après le déploiement.

**Pourquoi** : pour charger la nouvelle logique hors ligne. Les ventes en attente
de synchronisation sont conservées.

### 6.6 POS 2.0 éteint par défaut

Tant qu'une boutique n'a pas fait « Mise en route », elle voit l'ancienne caisse.
Scanner mobile, promotions, fidélité, crédit, inventaires, transferts et mode hors
ligne s'activent dans Réglages de la caisse.

### 6.7 AXSO Sourcing réservé au forfait Illimité (palier 2) — vraiment, cette fois

Avant, le menu cachait Sourcing aux forfaits inférieurs, mais l'adresse tapée à la
main ouvrait tout. Maintenant le serveur refuse : les pages renvoient vers
`/dashboard/abonnement` et les API répondent 403.

- [ ] Vérifier qu'aucune boutique en forfait Essentiel ou Pro n'utilisait Sourcing
      de cette façon. Si oui, la prévenir avant le déploiement : elle perd l'accès
      aux écrans (ses données restent en base).

**À savoir** : cela couvre aussi `/dashboard/dropshipping` et les commandes fournisseur.

### 6.8 Motif obligatoire pour annuler une commande fournisseur

Dans Sourcing → Commandes fournisseurs, l'annulation demande maintenant un motif.
« Rupture », « ne répond pas » et « retard » comptent contre la fiabilité du
fournisseur. « Le client a annulé » et « erreur de ma part » ne comptent pas.

**Pourquoi** : c'est la règle des grandes places de marché. La fiabilité affichée
d'un fournisseur vient désormais de son historique réel : une commande partie de
chez lui compte comme honorée.

**À savoir** : l'historique démarre à zéro au déploiement. Les commandes passées
ne sont pas recomptées. Une commande fournisseur ne peut plus revenir à une étape
précédente.

---

## CE QUI N'A PAS ÉTÉ FAIT (à décider plus tard)

Ces points viennent de l'audit et restent ouverts. Aucun ne bloque le déploiement.

| Sujet | État | Conséquence |
|---|---|---|
| Tests automatiques | Aucun dans le projet | Rien ne protège contre une régression |
| Documentation technique et utilisateur | Absente | Demandée par le prompt POS |
| Limitation de débit sur les routes de caisse | Absente | Risque de surcharge |
| `/api/cron/publications` | Non planifiée | Les posts planifiés ne partent jamais ; demande un passage toutes les 5 à 15 min (offre Vercel Pro ou service externe) |
| `/api/cron/agents` | Non planifiée | Déclenche des actions autonomes et des coûts d'IA : à décider |
| `/api/cron/sync-fournisseurs` | Non planifiée, **à ne pas planifier** | Réécrit des prix de vente sans aucune donnée fournisseur (`lib/sync-fournisseurs.ts`) |
| Rejeu des scans téléphone faits avant l'ouverture de l'écran | Abandonné volontairement | Comme chez Square et Shopify : un scan sans panier ouvert est refusé avec un message, pas gardé pour plus tard |
| Lots suivis lors d'un transfert | Non fait | Après transfert, le lot reste rattaché à l'entrepôt d'origine |
| Taux de livraison dans les délais par fournisseur | Non fait | Seul le taux de commandes honorées est compté ; le délai réel vient encore des évaluations saisies à la main |
| Vente hors ligne et session de caisse | Partiel | La vente est bien datée, mais rattachée à la session ouverte au moment de la synchronisation |
| Ancienne page `/dashboard/dropshipping` | Toujours là | Ses onglets font doublon avec Sourcing |
| Paiement et livraison via les abstractions | Non branché | Le paiement appelle NotchPay directement |
