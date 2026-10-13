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

- [ ] Committer ce qui reste (les tests : dossier `tests/`, `package.json`,
      `vercel.json`, et cette note).
- [ ] Fusionner la branche `feature-test` dans `main`, puis pousser `main`.

**État au 12/10/2026 à 17h30** : l'essentiel est dans le commit `746326d` sur la
branche `feature-test`. `main` n'a pas bougé, donc la prod garde l'ancien code,
avec toutes les failles décrites plus bas, tant que la fusion n'est pas poussée.

**Attention** : pousser `main` déclenche le déploiement. Faire l'étape 1
(variables d'environnement) **avant**.

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

### 1.5 Liste complète des variables lues par le code (ajout du 12/10/2026)

À régler dans Vercel → Project → Settings → Environment Variables, pour
**Production** (et pour **Preview** si tu fais tester une branche).

**Indispensables** (sans elles l'appli ne marche pas) :
`DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_AXSO_DOMAIN`, `BLOB_READ_WRITE_TOKEN`, `NOTCHPAY_PUBLIC_KEY`,
`NOTCHPAY_PRIVATE_KEY`, `NOTCHPAY_WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`,
`GEMINI_API_KEY`.

**Par fonctionnalité** :
- WhatsApp et Meta : `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
  `NEXT_PUBLIC_META_WEBHOOK_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- Domaines personnalisés des boutiques : `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`
- Connexion Gmail des marchands : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- SMS : `AFRICASTALKING_USERNAME`, `AFRICASTALKING_KEY`
- IA de secours : `DEEPSEEK_API_KEY`

**À NE PAS mettre** (valeurs de secours partagées par toutes les boutiques) :
`META_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID`, `META_AD_ACCOUNT_ID`.
Si elles sont définies, une boutique qui n'a pas connecté son propre compte Meta
publierait sur TA page.

**Inutiles** (présentes dans ton `.env` local mais lues par aucun code) : Stripe,
Flutterwave, CinetPay, Groq, Cerebras, OpenRouter, Together, SambaNova, NVIDIA,
Anthropic, FAL, Pollinations, Upstash.

**Ne jamais changer `AUTH_SECRET` et `NEXTAUTH_SECRET` sur une prod en service** :
tout le monde serait déconnecté et les codes de connexion des clients acheteurs
ne seraient plus reconnus.

---

## ÉTAPE 2 — Déploiement

### 2.1 Changement de structure de base (automatique)

> **CONSTAT DU 12/10/2026 — déjà fait, sans le vouloir.** Sur Vercel, la variable
> `DATABASE_URL` est la même pour « Production » et « Preview ». Le déploiement de
> test de la branche `feature-test` (commit `746326d`, 15h44 UTC) a donc appliqué la
> nouvelle structure **directement sur la base de production**. Le journal de build
> le confirme : « Your database is now in sync with your Prisma schema ».
>
> Conséquences :
> - La base de prod a déjà la nouvelle structure. Au déploiement de `main`, cette
>   étape ne changera plus rien.
> - Le lien de test travaille sur les **vraies données** des marchands, avec les
>   **vraies clés NotchPay**. Un testeur qui passe une commande ou supprime un
>   produit le fait en production.
> - Le SQL manuel de l'étape 3 (journal d'audit) n'est **pas** appliqué pour autant.
>
> - [ ] Donner à l'environnement « Preview » sa propre base : créer une branche
>       dans Neon, copier son adresse, et l'enregistrer comme `DATABASE_URL` pour
>       « Preview » uniquement (Vercel → Settings → Environment Variables).

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

### 2.1 bis Les tests bloquent maintenant le déploiement

- [ ] Rien à faire si le build passe. S'il échoue sur `npm test`, lire le nom du
      test en échec dans les logs Vercel : il dit en français quel calcul est cassé.

**Ce qui change** : la commande de build lance 33 tests avant de toucher à la base
(`prisma generate && npm test && prisma db push && next build`). Ils couvrent les
calculs d'argent : panier, remises et plafonds, TVA, paiements mixtes, conflits
hors ligne, devises, prix conseillé, contrôle du montant payé, paliers.

**Pourquoi** : si une modification future casse un calcul d'argent, le déploiement
s'arrête au lieu de mettre le bug en ligne.

**Condition** : Vercel doit utiliser Node 22 ou plus (Project → Settings →
Build and Deployment → Node.js Version). Avec une version plus ancienne, la
commande de test échoue.

**En local** : `npm test` (6 secondes, aucune base de données nécessaire).

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

### 3.2 bis Passer les boutiques existantes à 10 % de commission — OBLIGATOIRE

- [ ] Prévenir les marchands **avant** (voir 6.10), puis exécuter :

```sql
UPDATE "Tenant" SET "commissionRate" = 0.1 WHERE "commissionRate" = 0.06;
```

**Pourquoi** : décision du 12/10/2026, la commission Axso passe de 6 % à 10 %
(dont environ 3 % partent en frais NotchPay). Le déploiement ne change que le taux
des **nouvelles** boutiques ; les boutiques existantes ont leur taux enregistré en
base et restent à 6 % tant que ce SQL n'est pas lancé.

**À savoir** : une boutique dont le taux a été réglé à autre chose que 6 % n'est
pas touchée.

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

**Pourquoi** : le contrôle du montant payé est nouveau et n'a pas encore été
exercé par un vrai paiement de bout en bout.

**Vérifié le 12/10/2026** en lisant un vrai paiement abouti chez NotchPay (mode
live) : le champ `amount` est bien le montant payé par le client (106 XAF, frais
de 3 XAF comptés à part) et la référence est bien `ORD-<commande>`. Le contrôle est
donc compatible avec ce que NotchPay renvoie ; le test reste à faire une fois.

### 4.2 bis Retraits du portefeuille — JAMAIS TESTÉS EN RÉEL

- [ ] Vérifier chez NotchPay que les transferts sortants sont activés sur le compte.
- [ ] Alimenter le solde NotchPay, puis faire un retrait de test de 1 000 XAF vers
      ton propre numéro MTN ou Orange.

**Constat du 12/10/2026** : NotchPay n'a enregistré **aucun transfert** depuis la
création du compte, et son solde disponible est de **401 XAF**. Un retrait
automatique (minimum 1 000 XAF) ne peut donc pas partir aujourd'hui.

**À savoir** : le retrait n'est automatique que pour le Cameroun, en XAF, vers MTN
ou Orange. Tout le reste (autres pays, virement bancaire) reste « en attente » :
c'est toi qui paies à la main puis qui clôtures le retrait dans l'admin.

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

### 6.9 Les lots suivent maintenant les transferts entre magasins

Quand un produit suivi par lots est transféré, le lot part avec lui : le lot qui
périme le premier part en premier, et à l'arrivée il devient un lot nommé
`<code d'origine>-<numéro du transfert>` (exemple : `L42-TR8F3K2`), avec la même
date de péremption, le même coût et le même fournisseur.

**À savoir pour les équipes** :
- Pour retrouver tout ce qui vient d'un lot (rappel de produit par exemple),
  chercher le code d'origine dans Traçabilité : les lots transférés ressortent
  aussi, car leur code commence par celui d'origine.
- **Bloquer ou rappeler un lot ne bloque pas automatiquement ses parties déjà
  transférées** dans un autre magasin : il faut le faire sur chacune.
- Les transferts faits **avant** le déploiement ne sont pas corrigés : leurs lots
  restent rattachés à l'entrepôt de départ. Un inventaire les recale.

### 6.10 Commission à 10 % : les prix en ligne montent d'environ 4 %

La commission est **ajoutée au prix payé par le client** ; le marchand touche
toujours son prix en entier.

| Produit du marchand à 10 000 | Le client paie | Le marchand touche |
|---|---|---|
| Payé en ligne (produit digital, formation, etc.) | 11 000 (avant : 10 600) | 10 000 |
| Produit physique payé à la livraison | 10 000 | 10 000 (aucune commission) |

Sur les 1 000 de commission, NotchPay prend environ 3 % du montant payé (environ
330) : il reste environ 670 à Axso, soit 6,7 % du prix du marchand et non 7 %
pile. Pour garder 7 % nets, il faudrait un taux de 10,3 %.

- [ ] Annoncer le changement aux marchands avant de lancer le SQL de l'étape 3.2 bis.

### 6.11 AXSO Sourcing tient en une seule page (13/10/2026)

Les 10 entrées du menu Sourcing et `/dashboard/dropshipping` sont remplacées par
une seule page, `/dashboard/sourcing` : une conversation avec l'assistant, le
« dossier en cours » à côté, et en dessous les blocs À faire, Expéditions, Stocks,
Bénéfice et Calcul rapide. « Mes fournisseurs » et « Réglages » s'ouvrent depuis
cette page. Les anciennes adresses redirigent automatiquement.

- L'assistant n'invente aucun produit ni prix : il calcule à partir de ce que le
  marchand lui donne (nom, prix d'achat, poids) et des fournisseurs enregistrés.
- Publier, fixer un prix, changer de mode ou créer une commande fournisseur
  demande toujours un clic « Confirmer ».
- Sans `GEMINI_API_KEY`, la conversation est désactivée avec un message ; les
  blocs et le calcul rapide marchent sans elle.

### 6.12 Fonctions non configurées : masquées au lieu de planter

- Campagnes SMS : bouton « Bientôt disponible » tant que `AFRICASTALKING_*`
  manquent (avant, une campagne était enregistrée « envoyée » sans rien envoyer).
- Connexion Meta et Gmail : message « bientôt disponible » au lieu d'une erreur.
- [ ] Nouvelle page admin **/admin/integrations** (super-admin seulement) : elle
      dit quelles variables sont configurées sur le serveur, sans jamais montrer
      leur valeur. À ouvrir après chaque déploiement pour vérifier.

---

## CE QUI N'A PAS ÉTÉ FAIT (à décider plus tard)

Ces points viennent de l'audit et restent ouverts. Aucun ne bloque le déploiement.

| Sujet | État | Conséquence |
|---|---|---|
| Tests automatiques | 33 tests sur les calculs d'argent | Pas de test d'écran ni de test avec base de données : la liste de l'étape 4 les remplace |
| Tests du moteur de promotions | Non écrits | Les promotions (2+1, lots, seuils) ne sont pas couvertes par les tests |
| Documentation technique et utilisateur | Absente | Demandée par le prompt POS |
| Limitation de débit sur les routes de caisse | Absente | Risque de surcharge |
| `/api/cron/publications` | Non planifiée | Les posts planifiés ne partent jamais ; demande un passage toutes les 5 à 15 min (offre Vercel Pro ou service externe) |
| `/api/cron/agents` | Non planifiée | Déclenche des actions autonomes et des coûts d'IA : à décider |
| `/api/cron/sync-fournisseurs` | Non planifiée, **à ne pas planifier** | Réécrit des prix de vente sans aucune donnée fournisseur (`lib/sync-fournisseurs.ts`) |
| Rejeu des scans téléphone faits avant l'ouverture de l'écran | Abandonné volontairement | Comme chez Square et Shopify : un scan sans panier ouvert est refusé avec un message, pas gardé pour plus tard |
| Rappel d'un lot en cascade | Non fait | Rappeler un lot n'atteint pas ses parties transférées (voir 6.9) |
| Taux de livraison dans les délais par fournisseur | Non fait | Seul le taux de commandes honorées est compté ; le délai réel vient encore des évaluations saisies à la main |
| Vente hors ligne et session de caisse | Partiel | La vente est bien datée, mais rattachée à la session ouverte au moment de la synchronisation |
| Ancienne page `/dashboard/dropshipping` | Toujours là | Ses onglets font doublon avec Sourcing |
| Paiement et livraison via les abstractions | Non branché | Le paiement appelle NotchPay directement |
