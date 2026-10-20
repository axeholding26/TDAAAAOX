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

## Import IA → boutique (lib/import-creations, module imports)

Outils : `importer_creation`, `ajouter_visuel_produit`, `creer_lien_depot`, `etat_import`,
`publier_import` (aussi en REST : `/api/ia/imports`). Circuit unique : `pipeline.ts`.

**Cinq adresses, cinq rôles — à ne jamais confondre**

| Adresse | Durée de vie | Rôle |
|---|---|---|
| Lien de dépôt `/depot/<jeton>` | 30 min, **une seule utilisation** (consommé au dépôt) | Page où l'utilisateur glisse ses fichiers. Jeton haché en base (`JetonIA`), masqué dans le journal. |
| URL source (`files[].url`) | Celle du fournisseur | Où Axso télécharge le fichier (https public, SSRF bloquée). Une URL signée peut expirer : 404 = définitif. |
| Fichier temporaire `boutiques/<id>/depot/…` | Jusqu'à sa recopie ou son refus | Copie déposée par le navigateur ; supprimée ensuite. |
| Stockage permanent `boutiques/<id>/digitals/import-…` | Permanent (Blob public, suffixe aléatoire) | Fichier vendu ; jamais renvoyé à l'IA ni listé. |
| Téléchargement acheteur `/api/telechargements/<jeton>` | Tant que la commande est payée | Créé après paiement ; contrôle paiement, limite, révocation. |

Le suivi d'un import se fait par `etat_import` (pas d'URL).

**Formats** : type reconnu aux octets, extension cohérente. Refusés : HTML/HTM, SVG, scripts,
exécutables (même renommés). Un jeu ou une page HTML se vend **dans un .zip** (l'acheteur extrait
l'archive et ouvre le .html ; dire dans `instructions` si Internet est nécessaire). Le contenu du
ZIP n'est pas inspecté (limite connue).

**États** (`ImportCreation.statut`) et sens opérationnel

| Statut | Sens |
|---|---|
| `received` | En attente des fichiers (dépôt). Lien expiré ou utilisé : `creer_lien_depot` avec `import_id`. |
| `validated`, `stored` | Étapes internes d'un passage (vérifié, stocké + relu par SHA-256). |
| `product_created`, `assets_attached` | Produit en brouillon ; `derniereErreur` « À compléter » = action manuelle requise (prix, visuel…). |
| `ready_for_review` | Complet, en brouillon : `publier_import` (accord du marchand en copilote). |
| `published` | En vente. Un rejeu ne le retouche jamais. |
| `retrying` | Échec passager (5xx, délai, stockage en panne) : reprise à 1 min, 5 min, 25 min, 2 h, 10 h (5 essais). |
| `failed` | Échec définitif (404, fichier refusé, contenu à renvoyer) : jamais repris seul. |

**Idempotence et reprise** : même `import_key` = même import, jamais un second produit. Les
fichiers renvoyés (ou redéposés) sont rapprochés **par leur nom** : déjà stocké → ignoré ; en échec
→ source remplacée ; nouveau → ajouté ; une ligne en échec non renvoyée est retirée (c'est ainsi
qu'un `.html` refusé est remplacé par le `.zip`). Le produit n'est créé qu'une fois tous les
fichiers stockés : un import partiel ne crée jamais de produit.

**Guide d'exploitation**
- *Diagnostic* : Produits → Imports IA, ou `etat_import` (cause, fichiers conservés, état du
  produit, action suivante). Journal des appels : Contrôle IA. Erreurs internes : logs
  `import_creation_erreur` / `import_creation_stockage` (jamais de jeton).
- *Lien expiré / déjà utilisé* : `creer_lien_depot` avec `import_id` (ou le même `import_key`).
- *Fichier refusé* : redéposer le bon format (ex. `.zip`) sur un nouveau lien du même import.
- *URL 404* : nouvelle URL avec le même `import_key`, ou dépôt.
- *`retrying` qui n'avance pas* : repris à la consultation (`etat_import`, page Imports IA) et
  par le cron quotidien ; « Reprendre » remet le compteur à zéro.
- *Escalade* : stockage indisponible de façon durable → vérifier `BLOB_READ_WRITE_TOKEN` et l'état
  de Vercel Blob.

Tests : `tests/import-creations.test.ts` (règles), `tests/integration/import-creations.test.ts`
(incident Business Quest rejoué, liens, reprise, idempotence, pannes, étanchéité, téléchargement
acheteur ; stockage simulé, aucun réseau).

## Retirer un produit : désactiver, dépublier, archiver, supprimer

| Action | Effet réel | Comment |
|---|---|---|
| Désactiver / archiver | `Produit.actif = false` : hors vente, absent de la vitrine ; fiche, stock et historique gardés. Réversible. (Axso n'a pas d'état « archivé » distinct d'un brouillon.) | Tableau de bord (interrupteur « en vente ») ; IA : `archive_product` (`archived: false` pour remettre en vente) — accord du marchand en copilote. |
| Dépublier du catalogue | `visibleListage = false` : absent des listes, encore achetable par son lien. | IA : `update_product` avec `listed: false`. |
| Supprimer définitivement | Fiche, variantes, stock par entrepôt et fichiers rattachés effacés. **Irréversible.** Refusé (409 / CONFLICT) si le produit a été commandé, mouvementé en stock ou reste lié (avis, liste de souhaits, accès clients, affiliation…) : il faut l'archiver. Commandes et factures ne sont jamais touchées. | Tableau de bord : fiche produit → Supprimer (propriétaire seulement, confirmation). AXIA : `supprimer_produit` (propriétaire). IA externe : `delete_catalog_item` avec `product_id`. |

Une IA externe ne voit `delete_catalog_item` que si le marchand a coché « Supprimer
définitivement des produits, médias ou données » (`axso:delete:write`) en reliant l'IA ; sinon
`axso_capacites` le signale comme fermé avec ce droit. Les droits d'une connexion ne se modifient
pas après coup : il faut refaire la connexion. Même avec ce droit, chaque suppression attend
l'accord du marchand (risque élevé, quel que soit le mode). Logique commune : `lib/produits.ts`
(`supprimerProduit`), qui relit l'état et marque en échec l'import IA qui avait créé le produit.
Tests : `tests/integration/suppression-produits.test.ts`.

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
- Import IA : fichiers envoyés sur la page de dépôt sans que le dépôt soit validé (onglet fermé)
  restent dans `boutiques/<id>/depot/` (pas de nettoyage planifié) ; contenu des ZIP non inspecté ;
  fichiers vendus en Blob **public** (adresse impossible à deviner, mais pas privée) ; contenu
  base64 non conservé : après une panne passagère, il faut le renvoyer avec le même `import_key`.
- En copilote, une écriture soumise à accord (ex. `publier_import`) est mise en attente avant
  que l'outil ne vérifie l'identifiant : un identifiant inconnu n'est refusé (NOT_FOUND) qu'à
  l'exécution, après l'accord.
- Production : définir `AXSO_CLE_CHIFFREMENT` ; les jetons déjà en base restent en clair jusqu'à
  leur prochaine écriture.
