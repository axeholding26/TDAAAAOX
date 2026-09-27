# Rapport de contrôle complet — AXSO

*Contrôle réalisé le 27 septembre 2026. Rien n'a été commité.*

## 1. En bref

- **L'application est fonctionnelle et cohérente** sur tous les profils testés : admin, marchand de boutique physique, marchand de boutique digitale, livreur, membre d'équipe restreint et visiteur.
- Le parcours automatique a ouvert **139 pages sur ordinateur et sur mobile (308 visites)** et contrôlé **187 liens internes**.
  - Avant correction : 8 anomalies. Après correction : 0.
  - **Aucun débordement horizontal** détecté, sur aucune page et aucun écran.
- **AXIA** a été corrigé et testé avec de vrais appels au modèle, dans 5 contextes : accueil AXIA, Constructeur, modules (SMS…), membre restreint et assistant de la vitrine. Détails au §4.
- **9 bugs corrigés**, dont 3 qui auraient touché la production (§3).
- **Le build de production (`next build`) réussit sans aucun avertissement**, avec la vérification des types désormais bloquante.

## 2. Méthode

- **Test sur un build de production** (`next build` + `next start`), et non sur le serveur de développement.
  - Le serveur de dev saturait la machine : 4,8 Go de mémoire et une charge de 80. La cause est trouvée et corrigée (§3, n°1).
  - C'est aussi exactement ce qui part sur Vercel.
- **Comptes de test temporaires** en base locale (`@qa.local`) : un admin, un livreur, un membre d'équipe restreint (sans accès aux clients ni aux finances, catalogue en écriture, boutique en lecture) et un marchand digital. Tous ont été **supprimés à la fin**, avec la commande de test.
- **Pour chaque page**, sur ordinateur (1 400 px) et sur mobile (390 px) :
  - le code HTTP ;
  - les erreurs JavaScript et les erreurs de console ;
  - le débordement horizontal, avec l'élément responsable ;
  - la collecte de tous les liens internes, ensuite ouverts un par un.
- **Tests fonctionnels ciblés** : droits d'accès, envois réels de fichiers vers Vercel Blob (fichiers supprimés ensuite), AXIA en plan gratuit puis en plan payant (simulé puis restauré), parcours du livreur.

## 3. Bugs corrigés

| # | Problème | Impact | Correction |
|---|---|---|---|
| 1 | Next prenait **`/home/nathan`** comme racine du projet, à cause d'un `~/package-lock.json` qui traîne. | En dev, Turbopack surveillait tout le dossier personnel, d'où la mémoire saturée et les arrêts du serveur. | `turbopack.root` fixé dans `next.config.ts`. |
| 2 | Les imports de fichiers passaient par une fonction serveur, **limitée à 4,5 Mo sur Vercel**. | En production, les fichiers digitaux (jusqu'à 200 Mo), les vidéos et les images de plus de 4,5 Mo **échouaient**. | Nouveau `lib/televerser.ts` : envoi direct navigateur → Blob. Les 9 points d'import l'utilisent. Types et tailles centralisés dans `lib/types-fichiers.ts` et vérifiés côté serveur. **Testé : un fichier de 6 Mo passe.** |
| 3 | **AXIA ignorait les droits** des membres d'équipe. | Un caissier pouvait lire les revenus ou modifier les produits via AXIA, alors que le menu et les API le lui refusent. | `lib/axia/droits.ts` : chaque outil est rattaché à un module et à un niveau. L'outil est filtré **et** bloqué à l'exécution, dans les deux routes AXIA. |
| 4 | AXIA ne pouvait **pas changer les couleurs** du thème, mais promettait de le faire. | Le marchand croyait la modification faite. | Nouvel outil `modifier_couleurs`, plus une règle : ne jamais annoncer une action qu'aucun outil n'a réalisée. |
| 5 | Dans le Constructeur, « Ajoute une section… » **échouait**. C'est la 1ʳᵉ suggestion du panneau AXIA. | Le modèle se trompait dans les crochets d'un JSON profondément imbriqué. | Mode **JSON contraint** de Gemini (`completionAuto(…, json)`) pour les 6 agents qui renvoient du JSON, plus un log d'erreur. **Testé : 3 réussites sur 3.** |
| 6 | L'agent expert **Boutique**, qui reçoit « Optimise le thème », n'avait **aucun outil de design**. | Délégation inutile. | Outils de design ajoutés : page d'accueil, fiche produit, pages annexes, couleurs. |
| 7 | Erreur d'hydratation sur `/dashboard/feeds`. | Erreur React, rendu recalculé côté navigateur. | L'adresse du site est lue après l'affichage de la page. |
| 8 | Espace livreur : **lien dans un lien** (Maps et WhatsApp dans la carte commande). | Erreur d'hydratation, et un clic sur « Maps » ouvrait la fiche commande. | Carte restructurée en liens indépendants. Aucune autre imbrication dans tout le projet (vérifié automatiquement). |
| 9 | L'admin ne pouvait pas consulter les boutiques **en brouillon** depuis `/admin/boutiques`. | Liens 404 dans l'admin. | `boutiqueVisible` accepte les rôles admin. |

Deux autres règles ajoutées à AXIA :
- **Pas de promo inventée.** AXIA avait inventé le code « RETOUR10 » dans un SMS. L'interdiction de citer un code promo, une remise ou une offre inexistants est ajoutée aux prompts : AXIA, module universel, agents experts et assistant de la vitrine.
- **Droits expliqués.** AXIA sait désormais à quels modules le membre connecté n'a pas accès. Avant, il « déduisait » un chiffre d'affaires à 0 au lieu de dire que le rôle ne le permet pas.

## 4. AXIA — résultats des tests réels

| Contexte | Demande | Résultat |
|---|---|---|
| Accueil AXIA (propriétaire) | « Combien de produits actifs et lequel est le plus cher ? » | ✓ Outil `lister_produits`, réponse juste en 6 s, avec un conseil utile (produits sans image). |
| Plan gratuit | Créer un code promo, changer le design | ✓ Refus clair avec invitation à passer au plan Pro, conforme aux plans. |
| Plan payant | « Crée un code promo QAAXIA10 de 10 % » | ✓ Code créé en base. |
| Constructeur (plan payant) | « Couleur d'accent en #E11D48 » | ✓ Couleur enregistrée et visible partout (après correction n°4). |
| Constructeur (plan payant) | « Ajoute une section avec 3 avantages » | ✓ Section ajoutée à la page d'accueil (après correction n°5). |
| Membre restreint | « Mon chiffre d'affaires ? » | ✓ « Ton rôle ne te permet pas d'accéder aux informations financières… » |
| Module SMS | Rédiger un SMS promo | ✓ Texte correct (le code promo inventé est corrigé). |
| Vitrine (visiteur) | « Vous avez des pantalons ? Quel prix ? » | ✓ Produit réel, prix et stock exacts. |

Temps de réponse : 2 à 10 s selon la demande.

## 5. Droits et permissions (vérifiés)

- **Membre restreint** :
  - redirigé vers l'accueil sur Clients, Paiements et Revenus, **sans qu'aucune donnée de ces modules ne soit envoyée au navigateur** ;
  - l'API des livreurs lui répond 403 ;
  - la recherche lui cache les clients ;
  - AXIA refuse les modules interdits.
- **Livreur** : il ne voit que ses commandes et ne peut que marquer « livrée » ou signaler un échec. Parcours complet validé : création, assignation, livraison, position GPS.
- **Admin** : toutes les pages `/admin/*` s'affichent sans erreur, et il peut consulter les boutiques en brouillon.

## 6. Ce qui fonctionne sans anomalie

- **Vitrines** : boutique à design (`pnath`) et boutique digitale (`digit-cm`) ; accueil, catalogue, fiche produit (diaporama), panier, commande, À propos, Contact, favoris, espace client.
- **Tableau de bord marchand** : les 82 pages, y compris le Constructeur physique et le Constructeur digital, et les assistants de création de produits (fichier, licence, formation, bundle).
- **Pages publiques et authentification** : 21 pages publiques et 5 pages d'authentification.
- **Envois vers Vercel Blob** : images et fichiers digitaux au-delà de 4,5 Mo (testés réellement puis supprimés).
- **Interface** : aucun débordement horizontal sur mobile ni sur ordinateur, sur les 139 pages.

## 7. Points qui demandent une décision (non modifiés)

1. ~~**Domaine personnalisé**~~ → **construit** : `lib/domaines.ts`, `app/api/domaine/route.ts`, page Paramètres → Domaine et routage dans `proxy.ts`. Nécessite `VERCEL_API_TOKEN` et `VERCEL_PROJECT_ID` (et `VERCEL_TEAM_ID` si le projet appartient à une équipe).
2. ~~**Admin → Finances**~~ → **corrigé** : les totaux sont convertis en XAF aux taux du jour (`lib/finances-admin.ts`), et le classement des boutiques se fait sur ces montants convertis.
3. **WhatsApp, mode Meta direct** : la signature des messages est vérifiée avec la clé secrète d'**une seule** app Meta (`META_APP_SECRET`), alors que chaque marchand crée la sienne. Il faudrait enregistrer la clé de chaque marchand. Le mode Genuka n'est pas concerné.
4. **Pages et routes inactives** : conservées à ta demande. La liste complète est dans la conversation précédente : 9 pages, 13 routes utilisées seulement par ces pages, et 13 routes jamais appelées.
5. **Assistant AXIA de la vitrine** : il annonce les prix dans la devise de la boutique, alors que la page affiche la devise du visiteur. Le montant cité est bien celui débité, mais il faudrait peut-être ajouter l'équivalent converti.

## 8. Notes de déploiement

- **Vercel** : aucune action nécessaire. `AUTH_TRUST_HOST` est géré automatiquement.
- **Docker** : corrigé dans le `Dockerfile`. Ajout de `DOCKER_BUILD=1` (sans lui, le build Docker échouait faute de dossier `standalone`) et de `AUTH_TRUST_HOST=true`. Image construite et démarrée avec succès.
- **Paiements** : `NOTCHPAY_PUBLIC_KEY`, `NOTCHPAY_PRIVATE_KEY` et `NOTCHPAY_WEBHOOK_SECRET` restent nécessaires pour les paiements en ligne.
- **Machine locale** : le fichier `~/package-lock.json` (à la racine de ton dossier personnel) semble inutile. Il n'a plus d'effet grâce à la correction n°1, mais tu peux le supprimer.

## 9. Fichiers touchés

- **Nouveaux** : `lib/axia/droits.ts`, `lib/televerser.ts`, `lib/types-fichiers.ts`.
- **Modifiés** :
  - configuration : `next.config.ts`, `lib/tenant.ts` ;
  - AXIA et IA : `lib/axia/tools.ts`, `lib/axia/agents.ts`, `lib/gemini.ts`, `lib/llm-client.ts`, `app/api/ai/axia/route.ts`, `app/api/ai/universal/route.ts`, `app/api/ai/storefront/route.ts` ;
  - envoi de fichiers : `app/api/upload/route.ts`, `app/api/upload/client/route.ts`, les 6 fichiers qui importaient des fichiers ;
  - pages : `app/(dashboard)/dashboard/feeds/page.tsx`, `app/(livreur)/livreur/page.tsx`.
