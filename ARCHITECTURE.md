# Architecture d'Axso — audit de l'existant

Phase 1 du cahier des charges « Axso AI Control ». Relevé fait par lecture du dépôt le 13/10/2026
(branche `feature-test`, arbre de travail non commité). Chaque affirmation renvoie à un fichier.
Ce qui n'a pas été lu est marqué « non vérifié ». Aucune valeur de secret n'est recopiée.

**Le dépôt a bougé pendant l'audit** (d'autres agents écrivaient) : entre 23:42 et 23:47 sont apparus
`lib/chiffrement.ts`, `lib/connect.ts`, `lib/controle-ia/plan.ts`, `lib/controle-ia/simulateur.ts` et
`app/api/controle-ia/services/`. Les sections 8 et 11 disent ce qui a été relu à 23:47 ; les comptages
(routes, lignes) datent de 23:42 sauf mention contraire.

Chiffres relevés : 300 fichiers `route.ts` sous `app/api` (301 à 23:47), 132 modèles Prisma, 106 pages dans le
tableau de bord, 16 pages vitrine, 10 pages admin, 19 migrations, 5 fichiers de tests.

---

## 1. Stack

| Sujet | Constat | Source |
|---|---|---|
| Framework | Next.js 16.3.8 (App Router, Turbopack), React 19.2.4, TypeScript 5 | `package.json`, `next.config.ts` |
| Particularité Next 16 | `proxy.ts` remplace `middleware.ts` ; `after()` utilisé pour le travail après réponse | `proxy.ts`, `app/api/webhooks/whatsapp/route.ts`, `lib/controle-ia/taches.ts` |
| Runtime | Node.js 20 (image Docker et CI) ; 6 routes déclarent `runtime = "nodejs"` | `Dockerfile`, `.github/workflows/ci.yml` |
| Base de données | PostgreSQL, pilote `pg` via `@prisma/adapter-pg` | `lib/prisma.ts`, `prisma/schema.prisma` |
| ORM | Prisma 7.8 (`prisma-client-js`), URL dans `prisma.config.ts`, client en singleton | `prisma.config.ts`, `lib/prisma.ts` |
| Authentification | NextAuth v5 bêta (`next-auth` 5.0.0-beta.32), fournisseur Credentials, session JWT, `bcryptjs` | `lib/auth.ts` |
| Validation | zod 4 | `lib/validations.ts`, routes |
| Interface | Tailwind CSS 4, composants shadcn (style `base-nova`), `lucide-react`, `sonner`, `recharts`, `@dnd-kit`, `leaflet`, `zustand` | `package.json`, `components.json`, `store/` |
| Stockage de fichiers | Vercel Blob (`@vercel/blob` 0.27) ; une vidéo marketing sur Cloudinary | `app/api/upload/*`, `lib/televerser.ts`, `components/marketing/VideoSection.tsx` |
| Paiements | NotchPay (appels `fetch`, pas de SDK) : encaissement, remboursement, transferts | `lib/notchpay.ts` |
| E-mails | Resend 6 ; Gmail du marchand par OAuth Google | `lib/email.ts`, `lib/mcp/connectors/gmail.ts` |
| SMS | Africa's Talking | `lib/mcp/connectors/sms.ts`, `lib/integrations.ts` |
| WhatsApp | Genuka, sinon Cloud API Meta, sinon lien `wa.me` | `lib/whatsapp.ts`, `lib/genuka.ts` |
| IA | Gemini (`@google/genai`) en principal, DeepSeek en secours pour le texte ; Higgsfield pour la vidéo | `lib/llm-client.ts`, `lib/mcp/connectors/higgsfield.ts` |
| Documents | `pdf-lib`, `xlsx`, `qrcode`, `jsbarcode`, `@zxing/browser` (lecture de codes-barres) | `package.json` |
| Hébergement | Vercel (commande de build, durées de fonctions, 2 tâches planifiées) ; image Docker `standalone` en alternative | `vercel.json`, `Dockerfile`, `next.config.ts` |
| Tests | `tsx --test tests/*.test.ts` (lanceur de tests de Node), 48 tests dans 5 fichiers ; `playwright` installé, aucun test Playwright trouvé dans `tests/` | `package.json`, `tests/` |
| CI | GitHub Actions : contrôle de types, lint, build, tests, audit npm, déploiement Vercel sur `main` | `.github/workflows/ci.yml` |

Détails de configuration :

- `vercel.json` : build = `prisma generate && npm test && prisma db push && next build` ; durées maximales
  120 s (`app/api/ai/axia/**`), 60 s (`app/api/ai/**`, `app/api/themes/importer/**`), 300 s (`app/api/pos/flux/**`).
- `next.config.ts` : en-têtes de sécurité sur toutes les routes (CSP avec `'unsafe-eval'` et `'unsafe-inline'`
  pour les scripts), redirections des anciennes adresses Sourcing, `images.remotePatterns` ouvert à tout hôte https,
  `typescript.ignoreBuildErrors: false`.
- `instrumentation.ts` : au démarrage en production, crée les comptes administrateurs de la plateforme
  s'ils n'existent pas (adresses et empreintes bcrypt écrites dans le fichier).

---

## 2. Architecture générale

### 2.1 Groupes de routes (`app/`)

| Groupe | Contenu | Garde d'accès |
|---|---|---|
| `app/(dashboard)/dashboard/*` | Espace marchand, 106 pages (une cinquantaine de sections : commandes, produits, pos, sourcing, marketing, wallet, builder, axia, controle-ia…) | `app/(dashboard)/layout.tsx` : `auth()` sinon `/connexion` ; charge plan, quota, permissions |
| `app/(storefront)/[slug]/*` | Vitrine publique d'une boutique : accueil, produits, collections, panier, checkout, suivi, facture, formation, espace livreur par jeton, compte acheteur | `app/(storefront)/[slug]/layout.tsx` ; boutique non publiée masquée par `lib/tenant.ts::boutiqueVisible` |
| `app/(admin)/admin/*` | Administration de la plateforme : boutiques, abonnements, finances, équipe, fournisseurs, livreurs, intégrations, axsocial | `app/(admin)/admin/layout.tsx` : `getAdminSession()` |
| `app/(auth)/*` | Connexion, inscription (marchand et livreur), mot de passe oublié, invitation d'équipe | public |
| `app/(livreur)/livreur/*` | Espace du livreur connecté | `app/(livreur)/layout.tsx` : rôle `livreur` exigé |
| `app/oauth/authorize` | Écran d'autorisation d'une IA externe (AXSO CONTROL) | session marchande |
| `app/.well-known/*` | Découverte OAuth | public |
| `app/scanner` | Interface du téléphone-scanner de la caisse | jeton d'appareil (`lib/pos/acces.ts`) |
| Pages marketing | `app/page.tsx`, `about`, `blog`, `fonctionnalites`, `themes`, `legal`, `affiliation`, `suivi`… | public |
| `app/api/*` | 300 routes (section 6) | par route + `proxy.ts` |

### 2.2 `proxy.ts` (multi-boutique)

Un seul fichier, exécuté sur toutes les requêtes hors fichiers statiques :

1. **API** (`/api/*`) : jamais réécrites. Si la route est rattachée à un module (`lib/permissions-api.ts::moduleApi`)
   et que la requête porte une session avec `tenantId`, `requireNiveau` est appliqué (lecture pour GET/HEAD,
   écriture sinon). Sans session, le proxy laisse passer : c'est la route qui authentifie.
2. **Sous-domaine** `slug.<NEXT_PUBLIC_AXSO_DOMAIN>` : réécriture vers `/{slug}/…`.
3. **Domaine personnalisé** : recherche du slug en base (`lib/domaines.ts::slugPourDomaine`, cache mémoire 60 s),
   404 si aucune boutique publiée ne le porte. Les hôtes `*.vercel.app` et `localhost` ne sont jamais traités ainsi.
4. **Adresse principale** : quand un domaine personnalisé est actif (`Tenant.domaineActifAt`), l'adresse Axso
   redirige en 308 vers ce domaine (`domainePrincipal`), sauf pendant l'aperçu du Constructeur (cookie `axso_apercu`).
5. Pose `x-pathname` pour les composants serveur et `X-Frame-Options`.

Les domaines personnalisés sont ajoutés au projet Vercel par son API (`lib/domaines.ts`, `app/api/domaine/route.ts`).
Les slugs interdits sont dans `lib/utils.ts::SLUGS_RESERVES`.

### 2.3 Couches

```
Page (serveur ou "use client")  ──fetch──▶  app/api/**/route.ts  ──▶  lib/*.ts (services)  ──▶  lib/prisma.ts
        │                                         ▲
        └── composant serveur : lit Prisma directement (ex. app/(dashboard)/layout.tsx)
```

- Les règles métier partagées ont un « point de passage unique » dans `lib/` : `lib/cycle-livraison.ts`,
  `lib/remboursement.ts`, `lib/stock.ts`, `lib/paiement-commande.ts`, `lib/wallet.ts`, `lib/commandes.ts` (constantes de statut).
- La couche n'est pas étanche : de nombreuses routes appellent Prisma directement, et dix routes
  `app/api/ai/agent-*/route.ts` exportent leur logique, importée ensuite par `lib/agent-consumer.ts`.
- 67 fichiers `page.tsx` sur 163 sont des composants client (`"use client"`).

### 2.4 Conventions

- **Nommage en français** : modèles (`Commande`, `LigneCommande`, `MembreEquipe`), fonctions
  (`changerStatutCommande`, `planActif`), routes (`/api/commandes/[id]/assigner`), champs (`statut`, `tenantId` excepté).
  Sans accents dans les identifiants.
- **Séparation client / serveur** : un fichier qui importe Prisma n'est jamais importé par un composant client
  (`lib/permissions.ts` pur, `lib/permissions-server.ts` avec base ; même découpage pour
  `lib/axso-design-manifest.ts`, `lib/plans-catalogue.ts`, `lib/sourcing/connecteurs.ts`).
- **Commentaires d'en-tête** : la plupart des fichiers de `lib/` expliquent leur rôle et leurs appelants.
- **Traduction** : la clé est le texte français ; dictionnaire anglais dans `lib/i18n/en` (`lib/i18n/index.ts`).
- **Composants** : `components/ui` (6), `components/dashboard` (51), `components/storefront` (40),
  `components/pos` (64 fichiers), plus `admin`, `affilie`, `livreur`, `marketing`.
- **État client** : `store/posStore.ts`, `store/wishlistStore.ts` (zustand) ; `hooks/useAxiaConversations.ts`.

---

## 3. Modules métier

| Module | Pages | API | Services (`lib/`) |
|---|---|---|---|
| Boutique, thèmes, constructeur | `dashboard/boutique`, `dashboard/themes`, `dashboard/builder` (`panels.tsx` : 1696 lignes) | `api/tenant`, `api/tenants`, `api/themes` (+ `importer`, `provisionner`), `api/preview-theme`, `api/domaine` | `theme-config.ts`, `block-catalog.ts`, `block-tree.ts`, `vitrine-design.ts`, `axso-design-library.ts`, `axso-design-manifest.ts`, `theme-import-clone.ts`, `generate-store-config.ts` ; gabarits HTML dans `Templates/` (16 fichiers) |
| Vitrine | `app/(storefront)/[slug]/*` | `api/storefront`, `api/recherche`, `api/stock/reserver`, `api/avis`, `api/pixel` | `fiche-produit.ts`, `pricing.ts`, `devise-visiteur.ts`, `pixels.ts` |
| Catalogue | `dashboard/produits` (+ `nouveau`, `creer`, `[id]`, `categories`) | `api/produits`, `api/categories`, `api/variantesPrix`, `api/magic-import` | `categories-produits.ts`, `images-carrees.ts` |
| Produits digitaux, formations, licences, bundles | `dashboard/produits/digital`, `[slug]/formation/[token]` | `api/produits/digitaux`, `api/formations`, `api/licences`, `api/telechargements`, `api/livraison-digitale` | `affiliation.ts::traiterPaiementDigital`, `bundle-delivery.ts`, `commandes.ts::accesDigitalOuvert` |
| Commandes | `dashboard/commandes`, `dashboard/retours` | `api/commandes` (10 routes), `api/retours`, `api/tracking`, `api/suivi` | `commandes.ts`, `paiement-commande.ts`, `remboursement.ts` |
| Livraison et livreurs | `dashboard/livraison`, `dashboard/livreurs`, `dashboard/transporteurs`, `app/(livreur)` | `api/livraison`, `api/livreurs`, `api/transporteurs` | `cycle-livraison.ts`, `livraison.ts` |
| Clients | `dashboard/clients`, `dashboard/messages`, `dashboard/avis` | `api/messages`, `api/clients-acheteurs`, `api/chatbot` | `compte-acheteur.ts` |
| Caisse (POS 2.0) | `dashboard/pos/*` (caisse, stock, inventaire, receptions, credit, fidelite, comptabilite…), `app/scanner` | `api/pos` (75 routes, 41 sous-dossiers) | `lib/pos/*` : `acces.ts`, `vente.ts`, `stock.ts`, `retours.ts`, `droits.ts`, `idempotence.ts`, `audit.ts`, `evenements.ts`, `hors-ligne/`, `achats/`, `operations/`, `promotions/`, `scanner/` |
| Stock et entrepôts | `dashboard/entrepots`, `dashboard/logistique` | `api/entrepots`, `api/stock` | `stock.ts`, `lib/pos/stock.ts` |
| Sourcing et fournisseurs | `dashboard/sourcing` (+ `fournisseurs`, `reglages`) | `api/sourcing` (10), `api/fournisseurs` (9), `api/dropshipping` | `lib/sourcing/*` (`acces.ts`, `connecteurs.ts`, `rentabilite.ts`, `fulfillment.ts`, `fournisseurs/`), `sync-fournisseurs.ts` |
| Marketing | `dashboard/marketing` (codes-promo, email, tracking), `campagnes`, `sms`, `popups`, `publicite`, `scheduler`, `automation`, `veille`, `whatsapp`, `feeds` | `api/campagnes`, `api/codes-promo`, `api/email`, `api/sms`, `api/popups`, `api/posts`, `api/automation`, `api/veille`, `api/feed` | `email.ts`, `whatsapp.ts`, `lib/mcp/*` |
| Affiliation | `dashboard/affiliation`, `app/affilie`, `app/mon-espace-affilie` | `api/affiliation` (10), `api/affilie`, `api/track` | `affiliation.ts`, `affiliation-local.ts` |
| Finances | `dashboard/wallet`, `factures`, `revenus`, `paiements`, `abonnement`, `rapports` | `api/wallet`, `api/factures`, `api/tva`, `api/abonnement`, `api/paiements/notchpay/*` | `wallet.ts`, `notchpay.ts`, `plans.ts`, `abonnement.ts`, `taux-change.ts`, `devise-convert.ts` |
| Équipe et permissions | `dashboard/parametres/equipe`, `app/(auth)/rejoindre-equipe/[token]` | `api/equipe` (4), `api/boutiques` (+ `switch`) | `permissions.ts`, `permissions-server.ts`, `permissions-api.ts`, `tenant.ts` |
| Médias et fichiers | `dashboard/medias`, `dashboard/fichiers`, `dashboard/studio` | `api/upload`, `api/fichiers`, `api/medias`, `api/ai/video`, `api/ai/voix-off` | `televerser.ts`, `fichiers-boutique.ts`, `image-gen.ts` |
| IA marchand | `dashboard/axia`, `dashboard/agents`, `dashboard/objectifs`, `dashboard/controle-ia` | `api/ai` (21), `api/axia`, `api/orchestrator`, `api/objectifs`, `api/controle-ia` | sections 7 et 8 |
| Administration | `app/(admin)/admin/*` | `api/admin` (13) | `admin-auth.ts`, `admin-actions.ts`, `finances-admin.ts`, `integrations.ts`, `lib/axia-admin/outils.ts` |
| Réseau social Axso | `admin/axsocial`, `dashboard/gamification` | `api/reseau` (7), `api/badges` | modèles `PostSocial`, `ReactionSociale`, `CommentaireSocial` |

Règles métier visibles dans le code : commission ajoutée au prix client sur les paiements en ligne
(`lib/pricing.ts`), `Tenant.commissionRate` à 0,1 par défaut (`prisma/schema.prisma`), quota de 60 commandes
par mois au palier 0 qui bloque les actions marchand et non le checkout (`lib/abonnement.ts`).

---

## 4. Base de données

Source : `prisma/schema.prisma` (3044 lignes, 132 modèles, aucun `enum` : tous les statuts sont des `String`
documentés en commentaire). Migrations dans `prisma/migrations/` (19, dont `controle_ia` et `controle_ia_complet` du 13/10/2026).

### 4.1 Regroupement par domaine

| Domaine | Modèles |
|---|---|
| Boutique et comptes | `Tenant`, `User`, `ProprietaireBoutique`, `MembreEquipe`, `Account`, `Session`, `VerificationToken`, `CodeVerification`, `CompteAcheteur`, `Theme`, `CategorieProduit` |
| Catalogue | `Produit`, `Variante`, `Collection`, `VariantePrix`, `ProduitFichier`, `FichierNumerique`, `Formation`, `Chapitre`, `Lecon`, `ProgressionLecon`, `AccesFormation`, `LicenceProduit`, `CleLicence`, `ActivationLicence`, `BundleProduit`, `ElementBundle`, `Telechargement` |
| Commandes et livraison | `Commande`, `LigneCommande`, `Client`, `Livreur`, `Notification`, `NotificationMarchand`, `ReglePort`, `RetourRMA`, `Facture`, `StockReservation`, `Avis`, `Wishlist` |
| Finances | `Wallet`, `WalletTransaction`, `Retrait`, `Commission`, `CodePromo` |
| Marketing | `Campagne`, `Publicite`, `CampagneSMS`, `CampagneEmail`, `PopupCampagne`, `PostPlanifie`, `AutomationWorkflow`, `VeilleConcurrentielle`, `PixelEvent`, `Analytics`, `MessageRecu`, `BadgeMarchand`, `PostSocial`, `ReactionSociale`, `CommentaireSocial` |
| Affiliation | `AffiliationLien`, `AffiliationCommission`, `AffiliationEntrante`, `PaiementCommission`, `ProgrammeAffiliation`, `Affilie`, `AffilieClic`, `CommissionAffilie` |
| Fournisseurs et sourcing | `Fournisseur`, `CommandeFournisseur`, `ProduitFournisseur`, `DocumentFournisseur`, `AuditFournisseur`, `EchantillonFournisseur`, `EvaluationFournisseur`, `VerificationFournisseur`, `DemandeDevis`, `ReponseDevis`, `ProduitSource`, `Expedition`, `ReglagesSourcing`, `JournalSourcing` |
| Stock et caisse | `Entrepot`, `StockEntrepot`, `StockMouvement`, `LotTracabilite`, `ChargeExploitation`, `Magasin`, `Caisse`, `AppareilPos`, `SessionCaisse`, `MouvementCaisse`, `PaiementVente`, `PanierSuspendu`, `ScanPos`, `EvenementPos`, `MutationPos`, `Promotion`, `MouvementFidelite`, `MouvementCredit`, `AvoirClient`, `NumeroSerie`, `ComptageInventaire`, `LigneComptage`, `TransfertStock`, `LigneTransfert`, `BonCommande`, `LigneBonCommande`, `ReceptionAchat`, `LigneReception`, `JournalAudit`, `ReglagesPos` |
| IA interne | `AgentMemory`, `AgentTask`, `AgentDecision`, `AgentGoal`, `AxiaConversation`, `AxiaProposition`, `AdminAxiaAction`, `VideoGeneree`, `VoixOff`, `ConnecteurConfig` |
| AXSO CONTROL | `ConnexionIA`, `JetonIA`, `ActionIA`, `TacheIA`, `PlanIA`, `EvenementIA`, `WebhookIA`, `AutomatisationIA`, `ExecutionAutomatisation`, `MediaIA` |

### 4.2 Multi-tenancy

- **Une seule base, une colonne** : 100 modèles sur 132 portent `tenantId` (obligatoire sauf `User`, `Livreur`,
  `Theme` où il est optionnel). Les 32 autres sont des lignes filles rattachées par leur parent
  (`LigneCommande`, `Variante`, `Chapitre`, `LigneComptage`…), les tables NextAuth, `CodeVerification`,
  `AdminAxiaAction` et `JetonIA`.
- **Pas de cloisonnement au niveau base** : aucune politique de sécurité par ligne ni extension Prisma ;
  chaque requête ajoute elle-même `where: { tenantId }`. Seuls 27 modèles déclarent une relation Prisma
  (clé étrangère) vers `Tenant` ; les autres portent `tenantId` en simple colonne indexée (ex. `ConnecteurConfig`).
- **Origine de `tenantId`** :
  - session marchande : `session.user.tenantId`, issu du JWT (`lib/auth.ts`), boutique active du compte ;
  - caisse : session ou jeton d'appareil, « jamais du corps ni de l'URL » (`lib/pos/acces.ts`) ;
  - IA externe : jeton OAuth (`lib/controle-ia/serveur.ts::contexteDuJeton`) ;
  - vitrine : `slug` de l'URL résolu en `Tenant` ;
  - webhooks : identifiant du fournisseur (page Meta, numéro WhatsApp) ou `tenantId` dans l'URL avec
    signature HMAC propre à la boutique (`app/api/webhooks/genuka/[tenantId]/route.ts`).
- **Livreur** : `tenantId` de session forcé à `null` pour le rôle `livreur` (`lib/auth.ts`, callback `session`).
- **Plateforme** : une boutique technique porte le portefeuille d'Axso (`lib/wallet.ts::getPlatformTenantId`).

### 4.3 Modèles sensibles

| Modèle | Donnée sensible | Forme stockée |
|---|---|---|
| `User.password`, `CompteAcheteur.passwordHash` | mots de passe | empreinte bcrypt |
| `CodeVerification.code` | code 2FA et réinitialisation | en clair, 10 min, usage unique (`lib/two-factor.ts`) |
| `ConnecteurConfig.accessToken`, `.config` | jetons Meta, WhatsApp, Gmail (accès et rafraîchissement), secret Genuka | en clair au début de l'audit ; chiffrement AES-256-GCM en cours de branchement (`lib/connect.ts`, section 11) |
| `JetonIA.hash` | jetons OAuth des IA | empreinte SHA-256 seulement |
| `AppareilPos.tokenHash` | jeton du téléphone-scanner | empreinte SHA-256 |
| `WebhookIA.secret` | secret de signature des webhooks sortants | colonne `String` ; écriture non vérifiée (aucun code ne l'utilise encore) |
| `Commande.trackingToken`, `.livreurToken`, `Telechargement.token`, `AccesFormation.token`, `Affilie.portalToken`, `MembreEquipe.inviteToken` | jetons d'accès par lien | en clair (ce sont des liens) |
| `Wallet`, `WalletTransaction`, `Retrait`, `PaiementVente`, `MouvementCredit` | argent | — |
| `Tenant.kycDocUrl`, `Tenant.parametresPaiement`, `Tenant.trackingScripts` | KYC, réglages de paiement, scripts injectés tels quels sur la vitrine | — |
| `JournalAudit` | journal de caisse chaîné par hachage, ajout seul | `lib/pos/audit.ts` |

---

## 5. Authentification et autorisations

### 5.1 Connexion (`lib/auth.ts`)

- Fournisseur unique : e-mail + mot de passe (bcrypt). Session en JWT (pas de session en base malgré `PrismaAdapter`).
- Le jeton porte `id`, `tenantId`, `role`. Rôles vus dans le code : `owner`, `admin`, `admin_lecteur`, `membre_equipe`, `livreur`.
- **2FA par e-mail** : code à 6 chiffres exigé à la connexion **seulement si Resend est configuré**
  (`hasResend()`), demandé par `app/api/auth/2fa/demander/route.ts`, vérifié par `lib/two-factor.ts::verifierCode`
  (mise à jour conditionnelle : deux requêtes simultanées, une seule passe).
- Un membre d'équipe suspendu de toutes ses boutiques ne peut pas se connecter.
- Mot de passe oublié : `app/api/auth/mot-de-passe-oublie/{demander,reinitialiser}`.
- Acheteurs de la vitrine : compte séparé (`CompteAcheteur`, `app/api/clients-acheteurs/*`), hors NextAuth.

### 5.2 Multi-boutique

- `ProprietaireBoutique` (compte ↔ boutique) et `MembreEquipe` (unique par compte et boutique).
- `lib/tenant.ts::boutiquesDuCompte` liste les boutiques possédées et celles où le compte est membre actif,
  et rattrape le lien propriétaire des anciens comptes.
- Changement de boutique : `app/api/boutiques/switch/route.ts` vérifie l'accès, met à jour `User.tenantId`
  et réécrit le cookie de session avec `encode` de `next-auth/jwt`.

### 5.3 Permissions d'équipe

- 9 modules, 3 niveaux (`aucun`, `lecture`, `ecriture`) ; préréglages `gerant`, `caissier`, `comptable`, `lecture`,
  et `personnalise` (grille en JSON) : `lib/permissions.ts`.
- `lib/permissions-server.ts::permissionsSession` relit la base à chaque appel (non portée par le JWT) :
  une suspension prend effet à la requête suivante. `requireNiveau` (API) et `exigerModule` (pages).
- **Application centrale** : `proxy.ts` + `lib/permissions-api.ts` (table préfixe d'URL → module, préfixe le plus
  long d'abord, `null` = route publique ou contrôlée ailleurs). 13 routes appellent aussi `requireNiveau` elles-mêmes.
- Une route `/api/*` absente de la table n'a aucun contrôle de module par le proxy (`moduleApi` rend `null`).
- Caisse : droits fins par action en plus du module (`lib/pos/droits.ts`, `MembreEquipe.droitsPos`, `magasinIds`).
- AXIA : chaque outil est rattaché à un module et un niveau (`lib/axia/droits.ts`).

### 5.4 Plans

- Paliers `palier0` (Essentiel), `palier1` (Pro, 6000 XAF), `palier2` (Illimité, 20000 XAF) : `lib/plans.ts`,
  `lib/plans-catalogue.ts`, prix repris dans `app/api/paiements/notchpay/webhook/route.ts`.
- `lib/abonnement.ts::planActif` : le meilleur palier non expiré parmi les boutiques des mêmes propriétaires.
- Fonctions par palier : `sourcing_mondial`, `analytics_avance`, `analytics_temps_reel`, `multi_boutique` ;
  les outils AXIA portent un `tier` filtré par `filtrerOutilsParPalier`.

### 5.5 Administration

- `lib/admin-auth.ts::getAdminSession` (rôles `admin` et `admin_lecteur`) ; `estAdminComplet` réserve les
  mutations au rôle `admin`. Utilisé par 15 routes et par `app/(admin)/admin/layout.tsx`.
- Actions partagées entre l'interface admin et AXIA admin : `lib/admin-actions.ts`.

---

## 6. API

### 6.1 Organisation

76 dossiers de premier niveau sous `app/api`, 300 routes. Les plus gros : `pos` (75), `ai` (21), `admin` (13),
`mcp` (11), puis `commandes`, `produits`, `affiliation`, `sourcing` (10 chacun), `fournisseurs` (9), `reseau` (7).

### 6.2 Conventions relevées

| Sujet | Constat |
|---|---|
| Authentification | `await auth()` dans 140 routes ; `getAdminSession` dans 15 ; `routePos` / `accesPos` / `routeScanner` dans 74 ; `accesSourcing` pour `api/sourcing` |
| Validation | zod dans 126 routes (83 l'importent directement, la caisse passe par `lib/pos/schemas.ts`). 115 routes lisent `req.json()` sans zod détecté dans le fichier |
| Réponses | `NextResponse.json` ; clé d'erreur non uniforme (`{ error }` le plus souvent, `{ message }` dans `lib/rate-limit.ts`) ; caisse : erreurs typées (`lib/pos/erreurs.ts`) |
| Limitation de débit | `lib/rate-limit.ts` : compteurs en mémoire par IP (`apiLimiter` 60/min, `aiLimiter` 20/min, `authLimiter` 10/15 min). Utilisée par 25 routes seulement |
| Idempotence | caisse : `MutationPos` (`lib/pos/idempotence.ts`) ; IA externe : `ActionIA.cleIdempotence` ; cron des publications : prise atomique par `updateMany` |
| Durées | `maxDuration` déclaré dans 20 routes, plus `vercel.json` |

### 6.3 Routes publiques (sans session)

Relevé par recherche des routes sans `auth()`, garde admin, caisse ou sourcing (54 fichiers) :

- **Vitrine** : `storefront/[slug]/{contact,newsletter,recherche}`, `storefront/wishlist`, `boutique/[slug]/zones`,
  `livraison/calculer`, `codes-promo/verifier`, `stock/reserver`, `avis`, `tva`, `pixel`, `preview-theme`.
- **Commande et paiement** : `commandes/digital-creer`, `commandes/whatsapp-creer`,
  `paiements/notchpay/{initier,verifier,webhook}`.
- **Accès par jeton** : `tracking/[token]`, `suivi`, `telechargements/[token]`, `formations/progression`,
  `licences/activer`, `affilie/[token]`, `equipe/accepter`, `pos/scanner/appairage/echange`.
- **Affiliation et flux** : `affiliation/{tracker,rejoindre}`, `affilie/track-clic`, `track/[code]`, `v/[varianteId]`,
  `feed/{meta,google,tiktok}`.
- **Comptes** : `auth/*`, `clients-acheteurs/{connexion,commandes}`, `livreurs/inscription`, `ai/onboarding`.
- **AXSO CONTROL** : `mcp/v1` (jeton Bearer), `mcp/v1/outils`, `oauth/{register,token}`.

### 6.4 Webhooks entrants

| Route | Vérification |
|---|---|
| `app/api/paiements/notchpay/webhook/route.ts` | signature `x-notch-signature` (`lib/notchpay.ts::verifierSignatureWebhook`) ; aiguillage par préfixe de référence (`ORD-`, `SUB-`, transferts) |
| `app/api/webhooks/meta/route.ts` | HMAC SHA-256 `x-hub-signature-256` avec le secret de l'application, comparaison à temps constant |
| `app/api/webhooks/whatsapp/route.ts` | même signature ; traitement après réponse par `after()` |
| `app/api/webhooks/genuka/[tenantId]/route.ts` | HMAC avec le secret enregistré par le marchand (`lib/genuka.ts`) |

### 6.5 Tâches planifiées

Toutes exigent `CRON_SECRET` (en-tête `x-cron-secret` ou `Authorization: Bearer`) et sont fermées sans lui.

| Route | Rôle | Planifiée dans `vercel.json` |
|---|---|---|
| `api/cron/surveillance-fournisseurs` | surveillance des fournisseurs | oui, 04:00 chaque jour |
| `api/cron/pos/alertes` | alertes de caisse | oui, 04:30 chaque jour |
| `api/cron/agents` | orchestration autonome, 100 boutiques maximum par passage, palier Pro et plus | non |
| `api/cron/publications` | publication des posts planifiés, 50 par passage | non |
| `api/cron/sync-fournisseurs` | synchronisation des produits dropshipping | non |

Les trois dernières ne tournent que si un déclencheur externe les appelle ; son existence est non vérifiée.

---

## 7. IA existante

### 7.1 Fournisseurs de modèles (`lib/llm-client.ts`)

- Texte et appels d'outils : liste de modèles Gemini essayés dans l'ordre (`GEMINI_MODELS`), puis DeepSeek
  (`deepseek-chat`, API compatible OpenAI) si une clé existe : `completionAuto`, `completionWithToolsAuto`.
- Flux : `streamGemini`, `streamDeepSeek`.
- Médias (Gemini seulement) : `generateImageGemini`, `generateSpeechGemini` (voix `GEMINI_TTS_VOICES`),
  `startVideoGemini` / `pollVideoGemini`. Enregistrement des images dans Vercel Blob : `lib/image-gen.ts`.
- `lib/gemini.ts` : fonctions spécialisées (description et FAQ produit, analyse de gabarit importé,
  `agentConstructeurLibre` pour le Constructeur, dont les actions sont validées par `lib/agent-actions.ts`).
- `lib/ai-agent.ts` : plan de boutique à l'inscription (`app/api/ai/onboarding/route.ts`).

### 7.2 AXIA (assistant du marchand)

| Élément | Fichier |
|---|---|
| Route de conversation (zod, limite de débit, plan, droits, flux) | `app/api/ai/axia/route.ts` |
| Moteur : boucle d'outils (6 itérations), reprises, délais, réponse jamais vide | `lib/axia/engine.ts` |
| Outils : `AXIA_TOOLS` (74 définitions, 45 avec `tier`), `executerOutilDirect`, `executeAxiaTool` | `lib/axia/tools.ts` (1932 lignes) |
| Outils de caisse : `AXIA_POS_TOOLS`, `executerOutilPos` | `lib/axia/pos-tools.ts` |
| Droits par outil : `niveauRequis`, `moduleRequis`, `outilAutorise`, `restreindreAxia` | `lib/axia/droits.ts` |
| Actions sensibles → demande d'accord (`AxiaProposition`), exécutée au clic du marchand | `lib/axia/confirmation.ts`, `app/api/axia/propositions/route.ts` |
| Agents experts appelés par `deleguer_vers_agent` | `lib/axia/agents.ts` |
| Constats proactifs, style et langue | `lib/axia/constats.ts`, `lib/axia/style.ts` |
| Historique | `AxiaConversation`, `app/api/axia/conversations/*`, `hooks/useAxiaConversations.ts` |
| Voix | `app/api/ai/axia/voix/route.ts` |

Une seconde route, `app/api/ai/universal/route.ts` (1648 lignes, « Agent Universel »), redéfinit des outils et
s'appuie sur `lib/agent-runner.ts` et `lib/agents/definitions.ts` ; elle délègue trois outils de livraison à
`lib/axia/tools.ts`. Deux moteurs coexistent donc (`lib/axia/engine.ts` et `lib/agent-runner.ts`).

### 7.3 Agents autonomes

- Dix routes `app/api/ai/agent-{revenue,veille,growth,stock,fidelite,marketing,analytics,clients,produits,livraison}/route.ts`,
  chacune avec son invite, ses outils et son `executeOutil`.
- Bus : `lib/agent-bus.ts` (table `AgentTask`) ; mémoire et journal : `lib/agent-memory.ts` (`AgentMemory`, `AgentDecision`).
- Orchestration : `lib/orchestrator.ts` (`orchestrerAutonomie`, objectifs `AgentGoal`), exécution des tâches par
  `lib/agent-consumer.ts`, qui applique `estSensible` / `demanderConfirmation`. Déclenchement : `app/api/cron/agents/route.ts`.
- Interface : `dashboard/agents`, `dashboard/objectifs`, `app/api/agent-decisions`, `app/api/ai/orchestrator`.

### 7.4 Connecteurs sortants « MCP » (`lib/mcp/`)

Le nom est interne : ce sont des appels sortants vers des services tiers, pas un serveur MCP.

- Registre : `lib/mcp/registry.ts` (`MCP_CONNECTEURS` : meta, whatsapp, gmail, google_ads, tiktok, sms, higgsfield, gemini).
- Exécution : `lib/mcp/executor.ts::executerOutilMcp(nom, args, tenantId)` lit la configuration de la boutique dans `ConnecteurConfig`.
- Connecteurs écrits : `lib/mcp/connectors/{meta,whatsapp,gmail,sms,higgsfield,gemini}.ts`. Aucun fichier pour
  `google_ads` ni `tiktok` ; `app/api/cron/publications/route.ts` laisse les posts TikTok en attente.
- Liaison des comptes : `app/api/mcp/oauth/{google,meta}/*` avec paramètre `state` aléatoire en cookie
  (`lib/mcp/oauth-etat.ts`) ; `app/api/connecteurs/*` pour WhatsApp et Genuka.
- `app/api/mcp/execute/route.ts` : point d'entrée générique, annoté « aucun appelant connu (à supprimer) ».

### 7.5 AXIA admin

`app/api/admin/axia/route.ts` et `actions/route.ts`, outils dans `lib/axia-admin/outils.ts` (lecture directe,
actions confirmées et journalisées dans `AdminAxiaAction`), actions réelles dans `lib/admin-actions.ts`.

---

## 8. AXSO CONTROL (en cours d'écriture)

État lu le 13/10/2026 vers 23:43. Tous ces fichiers sont non commités et d'autres agents les modifient :
ce relevé peut être dépassé. Document de conception : `AXSO_AI_ARCHITECTURE.md`.

### 8.1 En place

| Brique | Fichier | Contenu |
|---|---|---|
| Découverte OAuth | `app/.well-known/oauth-protected-resource/[[...chemin]]/route.ts`, `app/.well-known/oauth-authorization-server/[[...chemin]]/route.ts` | RFC 9728 et RFC 8414 ; PKCE S256, clients publics |
| Enregistrement de client | `app/api/oauth/register/route.ts` | RFC 7591 sans table : le `client_id` est la fiche du client signée en HMAC (`lib/controle-ia/regles.ts::creerClientId`) |
| Autorisation | `app/oauth/authorize/page.tsx` | choix des boutiques et des droits par domaine ; émet un code à usage unique |
| Jetons | `app/api/oauth/token/route.ts`, `lib/controle-ia/serveur.ts` | code 5 min, accès 1 h, rafraîchissement 60 jours à usage unique ; seule l'empreinte SHA-256 est en base (`JetonIA`) |
| Serveur MCP | `app/api/mcp/v1/route.ts` | JSON-RPC sur HTTP POST : `initialize`, `ping`, `tools/list`, `tools/call` ; 401 avec `WWW-Authenticate` ; journal JSON par appel ; pas de flux serveur (GET → 405) |
| Catalogue public | `app/api/mcp/v1/outils/route.ts` | description de tous les outils, sans donnée de boutique |
| Circuit d'un appel | `lib/controle-ia/serveur.ts::appelerOutil` | droits → politique → idempotence → exécution → reçu → journal `ActionIA` |
| Règles pures | `lib/controle-ia/regles.ts` | scopes, risque par outil, décision par mode, limites, PKCE |
| Tâches longues | `lib/controle-ia/taches.ts` | `TacheIA` + `after()` ; borné par les 60 s de la route (noté dans le fichier) |
| Centre de contrôle | `app/api/controle-ia/route.ts`, `app/(dashboard)/dashboard/controle-ia/page.tsx` | connexions, journal, statistiques sur 30 jours, réglages, révocation |
| Accord du marchand | `lib/controle-ia/serveur.ts::executerAccordIA`, `accordVisible`, `noterRefusIA` | réutilise les demandes d'accord d'AXIA |
| Tests | `tests/controle-ia.test.ts` (9 tests) | règles pures |

Principes lus dans le code :

- La boutique et le compte viennent du jeton, jamais des paramètres. Droits effectifs = droits cochés ∩ droits
  actuels du compte (`intersecter`, `permissionsSession`).
- Scopes : `axso:{products,orders,customers,store,marketing,finance}:{read,write}` plus trois droits fins
  (`axso:payments:execute`, `axso:automation:write`, `axso:creative:write`).
- Modes `assistant`, `copilot` (défaut), `autopilot` ; limites par connexion (`variationPrixMax`, `budgetPubMax`, `transactionMax`).
- Plan : palier Pro minimum (`planSuffisant`).
- Outils exposés : 5 outils de cœur (`axso_contexte`, `axso_capacites`, `axso_choisir_boutique`,
  `axso_statut_tache`, `axso_annuler_action`) + les outils AXIA qui ont une règle de droits, sauf `deleguer_vers_agent`.
- Débit : sept compteurs en mémoire (connexion par minute et par jour, boutique, compte, fournisseur d'IA, IP,
  outil), réglables par variables `MCP_LIMITE_*`.
- Une connexion peut couvrir plusieurs boutiques (`ConnexionIA.boutiques`, `axso_choisir_boutique`).

### 8.2 Déclaré mais vide au moment de la lecture

- `lib/controle-ia/modules/{commerce,marche,creatif,automatisation,objectifs}.ts` : coquilles de 4 lignes
  (« à écrire »), aucun outil. Contrat dans `lib/controle-ia/types.ts` (`ModuleIA`, `OutilIA`, `CtxOutil`).
- `lib/controle-ia/recus.ts` : `prendreInstantane`, `conclureInstantane`, `conflitVersion` rendent `null` ;
  `annulerAction` répond « Annulation indisponible ». L'outil `axso_annuler_action` est pourtant déjà annoncé.
- Tables créées sans code lu qui les alimente : `PlanIA`, `EvenementIA`, `WebhookIA`, `AutomatisationIA`,
  `ExecutionAutomatisation`, `MediaIA`. Le schéma cite `lib/controle-ia/evenements.ts`, absent du dépôt à la lecture.
- `lib/controle-ia/plan.ts` (200 lignes, validation et déroulé d'un plan figé, 20 étapes au plus) et
  `lib/controle-ia/simulateur.ts` (221 lignes, simulateur d'activité et score d'opportunité, logique pure) :
  apparus pendant l'audit, importés par aucun fichier à 23:47.
- `app/api/controle-ia/services/route.ts` : apparu pendant l'audit, non lu (il importe `lib/connect.ts`).
- « Axso Connect » : `lib/chiffrement.ts` (AES-256-GCM, format `enc:v1:…`, clé `AXSO_CLE_CHIFFREMENT` ou dérivée
  du secret de session) et `lib/connect.ts` (seul lecteur et écrivain des secrets de `ConnecteurConfig`),
  déjà importé par 16 fichiers à 23:47 (retours OAuth Google et Meta, `lib/mcp/executor.ts`, `lib/whatsapp.ts`, webhooks).

### 8.3 Écarts entre le document et le code

`AXSO_AI_ARCHITECTURE.md` annonce une limite unique de 60 appels par minute, une boutique par connexion, et
range « annulation », « file de tâches » et « webhooks sortants » dans « volontairement pas fait ». Le code et le
schéma vont déjà plus loin (sept limites, plusieurs boutiques, tables et contrats correspondants) : le document est en retard.

---

## 9. Stockage de fichiers et médias

- **Vercel Blob, rangé par boutique** : préfixe `boutiques/{tenantId}/` (`lib/fichiers-boutique.ts::dossierBoutique`),
  sous-dossiers par catégorie ; `digitals/` est exclu de la bibliothèque Fichiers.
- **Envoi direct depuis le navigateur** : `lib/televerser.ts` → `app/api/upload/client/route.ts`, qui ne délivre
  qu'un jeton, refuse tout chemin hors du dossier de la boutique connectée, impose types et tailles côté serveur.
- **Envoi par le serveur** : `app/api/upload/route.ts`, gardé pour les petits fichiers (limite de 4,5 Mo par requête sur Vercel, notée dans le fichier).
- **Limites** (`lib/types-fichiers.ts`) : image 5 Mo, document 20 Mo, vidéo 100 Mo, fichier digital 200 Mo.
- **Bibliothèque** : `app/api/fichiers/route.ts`, `dashboard/fichiers` ; médias générés : `app/api/medias/route.ts`, `dashboard/medias`.
- **Fichiers digitaux vendus** : `app/api/produits/digitaux/[id]/fichiers/*`, livrés par jeton (`app/api/telechargements/[token]`).
- **Accès** : les objets sont envoyés en `access: "public"` (`lib/televerser.ts`) ; l'adresse suffit pour lire un fichier.
- **Images générées** : `lib/image-gen.ts` (renvoie une `data:` URL si le stockage n'est pas configuré).
- **Cloudinary** : seule la vidéo de la page d'accueil (`components/marketing/VideoSection.tsx`). Aucun SDK Cloudinary dans `package.json`.
- **Gabarits de thèmes** : fichiers HTML locaux lus sur disque (`Templates/`, `app/api/preview-theme/route.ts`).

---

## 10. Intégrations externes

Registre : `lib/integrations.ts` (`INTEGRATIONS`, `integrationActive`, `etatIntegrations`), affiché dans
`app/(admin)/admin/integrations/page.tsx`. Il ne rend jamais de valeur.

| Service | Usage | Fichiers | Variables (noms seulement) |
|---|---|---|---|
| PostgreSQL | toute l'application | `lib/prisma.ts` | `DATABASE_URL` |
| NotchPay | paiement des commandes et des abonnements, remboursements, retraits | `lib/notchpay.ts`, `lib/wallet.ts`, `lib/paiement-commande.ts`, `app/api/paiements/notchpay/*` | `NOTCHPAY_PUBLIC_KEY`, `NOTCHPAY_PRIVATE_KEY`, `NOTCHPAY_WEBHOOK_SECRET` |
| Vercel Blob | fichiers | section 9 | `BLOB_READ_WRITE_TOKEN` |
| Vercel API | domaines personnalisés | `lib/domaines.ts` | `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` |
| Resend | e-mails transactionnels, 2FA | `lib/email.ts` | `RESEND_API_KEY` |
| Gemini | texte, outils, image, voix, vidéo | `lib/llm-client.ts` | `GEMINI_API_KEY` |
| DeepSeek | secours texte | `lib/llm-client.ts` | `DEEPSEEK_API_KEY` |
| Meta (Graph API) | publication Facebook et Instagram, publicités, webhooks | `lib/mcp/connectors/meta.ts`, `app/api/mcp/oauth/meta/*`, `app/api/webhooks/meta` | `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_AD_ACCOUNT_ID` |
| WhatsApp Cloud API | notifications et messages | `lib/whatsapp.ts`, `lib/mcp/connectors/whatsapp.ts`, `app/api/webhooks/whatsapp` | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| Genuka | WhatsApp simplifié, messages entrants | `lib/genuka.ts`, `app/api/connecteurs/whatsapp-genuka`, `app/api/webhooks/genuka/[tenantId]` | `GENUKA_PROXY_TOKEN` |
| Google (OAuth, Gmail) | envoi d'e-mails depuis le compte du marchand | `lib/mcp/connectors/gmail.ts`, `app/api/mcp/oauth/google/*` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Africa's Talking | SMS | `lib/mcp/connectors/sms.ts` | `AFRICASTALKING_USERNAME`, `AFRICASTALKING_KEY` |
| Higgsfield | vidéo et image IA | `lib/mcp/connectors/higgsfield.ts` | `HIGGSFIELD_API_KEY` |
| Taux de change | conversion de devises | `lib/taux-change.ts` (hôte `open.er-api.com`) | aucune vue |
| Flux catalogue | Meta, Google, TikTok | `app/api/feed/{meta,google,tiktok}` | — |
| Pixels | Meta, TikTok, Snapchat, GTM sur la vitrine | `lib/pixels.ts`, champs de `Tenant` | — |
| Fournisseurs (Alibaba, 1688, AliExpress, CJdropshipping) | **non branchés** : statut « à connecter », seuls « manuel » et « sandbox » fonctionnent | `lib/sourcing/connecteurs.ts` | — |

---

## 11. Risques et dette constatés

Uniquement ce qui a été vu dans le code. Classés par gravité estimée.

### Sécurité

| # | Constat | Fichier |
|---|---|---|
| 1 | **Jetons tiers en clair en base** (constat de 23:42) : jetons Meta et WhatsApp (`ConnecteurConfig.accessToken`), jetons d'accès et de rafraîchissement Gmail, secret de webhook Genuka dans `config`. **Correction en cours pendant l'audit** : à 23:47 les écritures passent par `lib/connect.ts::enregistrerConnexion` (chiffrement). Restent à vérifier une fois le chantier fini : `app/api/chatbot/route.ts` écrit encore `ConnecteurConfig` directement ; les valeurs déjà en base restent en clair jusqu'à leur prochaine écriture (dit dans `lib/chiffrement.ts`) ; la clé retombe sur le secret de session si `AXSO_CLE_CHIFFREMENT` est absente | `lib/connect.ts`, `lib/chiffrement.ts`, `app/api/chatbot/route.ts` |
| 2 | **Limitation de débit en mémoire, par instance** : sur des fonctions sans état, chaque instance a ses compteurs. Vaut pour la connexion, le 2FA et les sept limites du serveur MCP. Clé = `x-forwarded-for`, repli sur `127.0.0.1` | `lib/rate-limit.ts`, `lib/controle-ia/serveur.ts` |
| 3 | **Connexion sans limite de débit propre** : `authorize` ne limite rien et la route NextAuth exporte les gestionnaires bruts. Si Resend n'est pas configuré, le 2FA est désactivé et le mot de passe seul suffit | `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts` |
| 4 | **Comptes administrateurs écrits dans le code** (adresses et empreintes bcrypt), recréés au démarrage en production | `instrumentation.ts` |
| 5 | **Chaîne de connexion de secours avec mot de passe** quand `DATABASE_URL` est absent | `lib/prisma.ts` |
| 6 | **Cloisonnement des boutiques par convention** : pas de garde au niveau base ni au niveau du client Prisma ; 73 modèles portent `tenantId` sans clé étrangère vers `Tenant` | `prisma/schema.prisma` |
| 7 | **Permissions d'API par liste de préfixes** : une nouvelle route oubliée dans la table n'a aucun contrôle de module ; une route `/api/pos` qui oublierait `accesPos()` serait publique (dit dans le fichier) | `lib/permissions-api.ts`, `lib/pos/acces.ts` |
| 8 | CSP avec `'unsafe-eval'` et `'unsafe-inline'` ; `Tenant.trackingScripts` injecté tel quel sur la vitrine ; `images.remotePatterns` ouvert à tout hôte | `next.config.ts`, `prisma/schema.prisma` |
| 9 | Code 2FA stocké en clair (durée 10 min, usage unique) | `lib/two-factor.ts` |
| 10 | Fichiers en accès public par adresse, y compris les fichiers digitaux vendus (même fonction d'envoi) | `lib/televerser.ts` |

### Fiabilité et exploitation

| # | Constat | Fichier |
|---|---|---|
| 11 | **Pas de file de tâches** : aucune dépendance de file ou de cache partagé dans `package.json`. Le travail long passe par `after()` (6 fichiers), borné par la durée de la fonction, ou par des boucles séquentielles dans les crons | `lib/controle-ia/taches.ts`, `app/api/cron/agents/route.ts` |
| 12 | **Trois tâches planifiées sur cinq non déclarées** dans `vercel.json` (agents, publications, synchronisation fournisseurs) | `vercel.json`, `app/api/cron/*` |
| 13 | Le cron des agents traite 100 boutiques au plus, l'une après l'autre, dans une seule requête | `app/api/cron/agents/route.ts` |
| 14 | **Build de production = `prisma db push`** alors que 19 migrations existent : le schéma est poussé sans passer par l'historique | `vercel.json`, `prisma/migrations/` |
| 15 | **CI non bloquante** : contrôle de types, lint et audit se terminent par `\|\| true` ; aucun fichier de configuration ESLint à la racine ; la CI ne se déclenche que sur `main` et `develop` | `.github/workflows/ci.yml` |
| 16 | Caches en mémoire par instance (domaines, 60 s) | `lib/domaines.ts` |
| 17 | Aucune dépendance de suivi d'erreurs ou de métriques : journaux `console.*` seulement | `package.json` |
| 18 | Le webhook NotchPay accuse réception même si le traitement échoue (voulu, noté dans le fichier) : un échec ne sera pas rejoué | `app/api/paiements/notchpay/webhook/route.ts` |

### Qualité du code

| # | Constat | Fichier |
|---|---|---|
| 19 | **Fichiers très gros** : 1932 lignes (`lib/axia/tools.ts`), 1696 (`builder/panels.tsx`), 1648 (`app/api/ai/universal/route.ts`), 1619 (`ProductPageClient.tsx`), 1239 (`inscription/page.tsx`), 1059 (`CheckoutForm.tsx`) | — |
| 20 | **Deux moteurs d'agent et deux jeux d'outils** : `lib/axia/engine.ts` + `lib/axia/tools.ts` d'un côté, `lib/agent-runner.ts` + `app/api/ai/universal/route.ts` de l'autre ; deux listes d'agents (`lib/axia/agents.ts`, `lib/agents/definitions.ts`) | — |
| 21 | **`lib/` importe des routes** : `lib/agent-consumer.ts` importe dix `app/api/ai/agent-*/route.ts` | `lib/agent-consumer.ts` |
| 22 | **Validation inégale** : 115 routes lisent le corps JSON sans zod détecté dans le fichier (validation manuelle possible, non vérifiée route par route) | `app/api/**` |
| 23 | **Typage contourné** : 526 `as any` dans `app`, `lib`, `components`, dont 272 `session.user as any` (la session n'est pas typée) | — |
| 24 | Aucun `enum` Prisma : statuts en chaînes libres, cohérence portée par le code (`lib/commandes.ts`) ; valeurs héritées de `planType` encore gérées | `prisma/schema.prisma`, `lib/plans.ts` |
| 25 | Code mort déclaré : `app/api/mcp/execute/route.ts` (« à supprimer ») ; connecteurs `google_ads` et `tiktok` au registre sans implémentation | `lib/mcp/registry.ts` |
| 26 | Couverture de tests faible : 48 tests pour 300 routes ; rien sur les commandes, l'authentification, les permissions ni le cloisonnement des boutiques | `tests/` |
| 27 | Dossier `AXIA/` à la racine : projet Vite séparé avec ses propres `node_modules` (208 Mo). Rôle non vérifié | `AXIA/` |
| 28 | Format d'erreur non uniforme entre routes (`error` ou `message`) | `lib/rate-limit.ts`, routes |

---

## 12. Réutilisable pour piloter Axso par une IA externe

À réutiliser plutôt qu'à réécrire. Le serveur MCP actuel s'appuie déjà sur les six premières lignes.

| Besoin | À réutiliser | Remarque |
|---|---|---|
| Actions métier | `lib/axia/tools.ts::executerOutilDirect(nom, args, tenantId)`, `lib/axia/pos-tools.ts::executerOutilPos` | Signature unique `ToolExecutor` ; 74 outils décrits en JSON Schema |
| Droits par outil | `lib/axia/droits.ts` (`moduleRequis`, `niveauRequis`, `outilAutorise`) | Un outil sans règle n'est jamais exposé à une IA externe |
| Droits du compte | `lib/permissions.ts`, `lib/permissions-server.ts::permissionsSession` | Relus à chaque appel |
| Accord du marchand | `lib/axia/confirmation.ts` (`estSensible`, `demanderConfirmation`), `app/api/axia/propositions/route.ts` | File d'accords déjà affichée dans le tableau de bord |
| Plans | `lib/plans.ts`, `lib/abonnement.ts::planActif` | |
| Boutiques d'un compte | `lib/tenant.ts::boutiquesDuCompte` | |
| Commandes et livraison | `lib/cycle-livraison.ts` (`changerStatutCommande`, `assignerLivreurCommande`, `marquerEspecesRemises`) | Point de passage unique, notifications comprises |
| Annulation, remboursement, retours | `lib/remboursement.ts` | |
| Stock | `lib/stock.ts` (`sortirStock`, `rendreStock`) | |
| Argent | `lib/wallet.ts`, `lib/notchpay.ts`, `lib/paiement-commande.ts`, `lib/affiliation.ts::payerCommissionsAffilie` | |
| Prix et livraison | `lib/pricing.ts`, `lib/livraison.ts::calculerOptionsLivraison` | |
| Caisse | `lib/pos/*` avec `lib/pos/idempotence.ts`, `lib/pos/audit.ts`, `lib/pos/evenements.ts` | Modèle d'idempotence et de journal chaîné réutilisable tel quel |
| Sourcing | `lib/sourcing/*` (`acces.ts`, `rentabilite.ts`, `fulfillment.ts`, interface `SupplierConnector`) | Connecteurs réels non branchés |
| Canaux sortants | `lib/mcp/executor.ts::executerOutilMcp`, `lib/email.ts`, `lib/whatsapp.ts` | Configuration par boutique dans `ConnecteurConfig` |
| Modèles IA | `lib/llm-client.ts` (`completionAuto`, `completionWithToolsAuto`, médias) | |
| Thème et constructeur | `lib/theme-config.ts`, `lib/block-tree.ts`, `lib/agent-actions.ts` (`validerActions`, `applyAgentActions`), `lib/axia/reglages-theme.ts` | Actions bornées, jamais de mutation libre de l'arbre |
| Fichiers | `lib/fichiers-boutique.ts::dossierBoutique`, `lib/image-gen.ts` | |
| Objectifs et agents | `lib/orchestrator.ts`, `lib/agent-bus.ts`, `lib/agent-memory.ts`, `lib/objectifs.ts` | Base du futur module « objectifs » |
| Liens absolus | `lib/origine-site.ts` (`origineSite`, `lienBoutique`), `lib/domaines.ts::domainePrincipal` | |
| État des services | `lib/integrations.ts::integrationActive` | Sert à `ModuleIA.indisponible` |
| Secrets des services reliés | `lib/connect.ts` (`lireConnexion`, `enregistrerConnexion`, `etatConnexions`), `lib/chiffrement.ts` | En cours de branchement (risque 1) ; ne jamais lire `ConnecteurConfig` directement |
| Point d'extension | `lib/controle-ia/types.ts` (`ModuleIA`, `OutilIA`, `CtxOutil.appeler`), registre `lib/controle-ia/modules/index.ts` | Un module déclare ses outils ; droits, politique et journal sont appliqués avant lui |

Points d'attention pour la suite :

1. Ne pas exposer `app/api/ai/universal/route.ts` ni `deleguer_vers_agent` : les sous-agents n'appliquent pas les droits de la connexion (`lib/controle-ia/serveur.ts`, `EXCLUS`).
2. Les tâches de plus de 60 s n'ont pas de support d'exécution (risque 11) ; `TacheIA` existe, pas le cron qui reprendrait les tâches en attente.
3. Les limites de débit du serveur MCP ne tiennent pas entre instances (risque 2).
4. Finir le chiffrement des jetons des services reliés avant d'élargir ce qu'une IA peut déclencher (risque 1).
