# Axso Control — piloter Axso depuis une IA externe

Un marchand relie Claude, ChatGPT, Gemini ou tout client MCP à sa boutique. L'IA ne reçoit
jamais d'identifiant Axso : elle obtient un jeton par OAuth, limité à une boutique et aux
droits que le marchand a cochés.

## Ce qui existait déjà (réutilisé tel quel)

| Besoin | Où |
|---|---|
| Outils métier (catalogue, commandes, clients, boutique, marketing, finance, caisse, fournisseurs) | `lib/axia/tools.ts`, `lib/axia/pos-tools.ts` |
| Droits par module et par outil | `lib/permissions.ts`, `lib/axia/droits.ts` |
| Accord du marchand avant une action sensible | `lib/axia/confirmation.ts`, `app/api/axia/propositions` |
| Plans (Palier Pro pour AXIA) | `lib/plans.ts`, `lib/abonnement.ts` |
| Connexions sortantes Meta, Google, WhatsApp, SMS, Higgsfield, Gemini | `lib/mcp/` |
| Agents autonomes, objectifs, sourcing, automatisations | `lib/agents`, `lib/objectifs.ts`, `lib/sourcing`, `app/api/automation` |

Il manquait la porte d'entrée : aucun serveur OAuth, aucun serveur MCP entrant, aucun écran
pour gérer les IA reliées.

## Ce qui a été ajouté

```
Claude / ChatGPT / Gemini
        │  OAuth 2.1 (code + PKCE)           app/oauth/authorize, app/api/oauth/*
        ▼
/api/mcp/v1  (JSON-RPC, jeton Bearer)        app/api/mcp/v1/route.ts
        ▼
lib/controle-ia/serveur.ts                   identité, droits, politique, idempotence, journal
        ▼
lib/axia/tools.ts → services Axso            aucune logique métier dupliquée
```

- **Découverte** : `/.well-known/oauth-protected-resource` et `/.well-known/oauth-authorization-server`.
- **Client** : enregistrement dynamique (`/api/oauth/register`). Le `client_id` est la fiche du
  client signée par Axso ; rien n'est stocké.
- **Autorisation** (`/oauth/authorize`) : le marchand connecté choisit la boutique et, par
  domaine, « aucun », « consulter » ou « consulter et modifier ». Défaut : consulter.
- **Jetons** : opaques, seule l'empreinte SHA-256 est en base. Accès 1 h, rafraîchissement
  60 jours à usage unique, code 5 min à usage unique.
- **Identité** : compte et boutique viennent du jeton, jamais des paramètres. Droits effectifs
  = droits cochés ∩ droits actuels du compte, relus à chaque appel.
- **Scopes** : `axso:{products,orders,customers,store,marketing,finance}:{read,write}`.
- **Politique** (`lib/controle-ia/regles.ts`) :

| Mode | Lecture | Écriture courante | Sensible (prix, envois, publication) | Risque élevé (paiements, retours, envois en masse, publicité) |
|---|---|---|---|---|
| Assistant | fait | accord | accord | accord |
| Copilote (défaut) | fait | fait | accord | accord |
| Autopilote | fait | fait | fait (prix : dans la limite en %) | accord |

- **Journal** : table `ActionIA`, une ligne par appel (outil, risque, paramètres résumés,
  résultat, statut). `idempotency_key` : un même appel rejoué n'est exécuté qu'une fois.
- **Contrôle IA** (`/dashboard/controle-ia`) : adresse à coller dans l'assistant, IA reliées,
  mode et limite, accords en attente, historique, coupure immédiate de l'accès.
- **Limite de débit** : 60 appels par minute et par connexion.

Tables : `ConnexionIA`, `JetonIA`, `ActionIA` (migration `controle_ia`).
Tests : `tests/controle-ia.test.ts`.

## Modules spécialisés (lib/controle-ia/modules)

Un module déclare ses outils (droit, risque, droit fin, palier, capacité) ; le circuit commun
(`serveur.ts`) applique droits → politique → idempotence → exécution → reçu → journal.
Documentation générée de tous les outils : `GET /api/mcp/v1/outils`.

| Module | Contenu |
|---|---|
| commerce | produits, catalogue, variantes, stock, commandes, clients, thème, pages, analyses, `axso_search` |
| marche (Palier Illimité) | étude de marché, concurrence, score d'opportunité, simulateur 3 scénarios, fournisseurs, coût rendu, marge, import en brouillon, produit gagnant |
| creatif | images, vidéos, textes (moteurs Gemini / Higgsfield interchangeables), médiathèque `MediaIA`, campagnes, promotions, réseaux sociaux |
| automatisation (Palier Illimité) | déclencheur événement ou horaire, conditions, étapes outil / attente / accord / branche, webhooks signés |
| objectifs (Palier Illimité) | `axso_plan_goal` (plan sans rien exécuter), `axso_execute_goal`, `get_goal_status`, `cancel_goal`, `axso_delegate` |

Autres pièces : reçus avant/après et annulation (`recus.ts`), verrou `version`, tâches longues
(`taches.ts`, `axso_statut_tache`), bus d'événements (`evenements.ts`, publié au paiement, à la
livraison et au stock bas), chiffrement AES-256-GCM des jetons des services reliés
(`lib/chiffrement.ts`, `lib/connect.ts`), journaux structurés avec request_id et trace_id.

Orchestrations (objectifs, automatisations, délégation) : chaque étape repasse par le circuit
complet ; elles ne peuvent pas en lancer une autre.

## Builder MCP (lib/builder, lib/controle-ia/modules/builder)

La vitrine en ligne reste `Tenant.themeConfig`. Une IA ne modifie que le **brouillon**
(`BrouillonBoutique`) par des **opérations pures** (`lib/builder/operations`, 43 opérations),
appliquées par `lib/builder/moteur.ts` en une transaction logique (toutes ou aucune), puis validées
(`validation.ts` : structure, types de blocs connus, aucun code ajouté, design importé intouchable).

- **Aperçu** : lien signé d'une heure (`/api/builder/apercu`), la vraie vitrine rend le brouillon
  pour ce navigateur seulement, sans pixels ni comptage ; le public ne le voit jamais.
- **Publication** : risque calculé sur les changements réels (`diff.ts`, `risque.ts`). Copilote :
  toute mise en ligne attend l'accord ; autopilote : jusqu'au seuil fixé par le marchand.
  L'état d'avant est toujours gardé (`VersionBoutique`) : instantanés, comparaison, restauration,
  « annule ce que tu viens de faire ».
- **Verrou d'urgence** (`Tenant.editionIaBloquee`) : un clic dans Contrôle IA bloque toute
  modification de la boutique par une IA, dès l'appel suivant.
- **Domaines** : découverte et schéma, design system en tokens, marque et garde de marque,
  thème, gabarits, pages libres (`/[slug]/p/[page]`), sections, composants, contenu, liaisons
  produits dynamiques (meilleures ventes, forte marge, dormants…), navigation, en-tête, pied de
  page, médias, analyses (mobile, SEO, accessibilité, performance, conversion, santé), vérification
  visuelle (Playwright, en local seulement), intention de design → plan → transaction →
  auto-correction, création de boutique depuis un brief, tests A/B (Palier Illimité).
- **Économie d'outils** : 23 outils Builder listés d'office ; les autres se découvrent
  (`axso_builder_get_capabilities`, `axso_decouvrir`) et s'appellent par `axso_outil`, avec les
  mêmes contrôles. Erreurs avec `builder_code` (`BUILDER_PLAN_REQUIRED`, `BUILDER_POLICY_BLOCKED`…).

Limites : pas de traduction des textes du marchand (la vitrine ne traduit que son interface) ;
paiement et commande non personnalisables ; pas de sitemap, robots, canonique ni JSON-LD dans la
vitrine ; pas de variantes d'images (aucun outil de redimensionnement installé) ; personnalisation
par pays/appareil stockée mais non rendue ; vérification visuelle indisponible sur Vercel.

## Tests

- `npm test` : règles pures de chaque module.
- `npm run test:integration` (base locale uniquement) : deux boutiques A et B ; OAuth, contrat de
  chaque outil, étanchéité (chaque outil appelé avec les identifiants de B), pas d'escalade,
  accord, reçu, annulation, idempotence concurrente, contenu piégé, plusieurs boutiques, plan ;
  Builder : refus §100 (gratuit, Pro expiré, droit absent, jeton révoqué, autre boutique, rôle sans
  droit, verrou), aucun accès direct hors passerelle, brouillon → accord → publication → retour,
  transaction tout-ou-rien.

## Limites connues

- Tâches longues et automatisations bornées à 60 s par passage (`after()`), pas de vraie file.
- Cron des automatisations déclaré une fois par jour (plan Vercel) : prévoir un planificateur
  externe toutes les 5 minutes avec `x-cron-secret`.
- Événements non branchés faute de point central : `order.created`, `product.*`,
  `campaign.completed`, `creative.ready`, `supplier.updated`.
- Pas de table d'attributs, de menu de navigation, de pages libres ni de brouillon de design dans
  Axso : les outils correspondants ne sont pas inventés.
- Limites de débit en mémoire, par instance.
- Production : définir `AXSO_CLE_CHIFFREMENT` ; les jetons déjà en base restent en clair jusqu'à
  leur prochaine écriture.
