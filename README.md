# Card Manager — collection de cartes Pokémon (PWA)

PWA gratuite pour rechercher, scanner, collectionner et estimer des cartes Pokémon en français.
Hébergement visé : **0 €** (Cloudflare Pages + Supabase Free).

> **Projet indépendant, non affilié à The Pokémon Company, Nintendo, Creatures ou Game Freak.**
> Pokémon et les noms associés sont des marques de leurs propriétaires respectifs. Le dépôt
> n'embarque aucune image ni aucun logo officiel : les visuels de cartes sont chargés depuis
> l'API [TCGdex](https://tcgdex.dev) au moment de l'affichage. Les icônes de l'app sont originales.

## Mise en service (état actuel)

Le backend est **déjà provisionné et testé** :

| Élément                                                        | État                                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Projet Supabase `card-manager` (`qhegzrfosiellxutojrm`, Paris) | Actif, offre gratuite                                                      |
| Migration `init_schema`                                        | Appliquée, 0 alerte de sécurité Supabase                                   |
| Edge Function `card-prices`                                    | Déployée (`verify_jwt = true`)                                             |
| `.env.production`                                              | URL + clé publishable versionnées : le build fonctionne sans configuration |

Il reste **3 réglages manuels** (non pilotables depuis le code) :

1. **Cloudflare Pages** → _Workers & Pages → Create → Pages → Connect to Git_ → dépôt
   `card_manager`, branche de production `main`, build `npm run build`, sortie `dist`,
   variable `NODE_VERSION=22`. Aucune autre variable n'est nécessaire.
2. **Supabase → Authentication → Sign In / Providers → Email** : désactiver **Confirm email**
   (recommandé pour démarrer). Sinon, le serveur d'email intégré n'envoie **qu'aux membres de
   l'organisation Supabase** (2 emails/heure) et toute autre inscription est refusée ; l'alternative
   est un SMTP gratuit (ex. Resend, Brevo) dans _Authentication → Emails → SMTP Settings_.
3. **Supabase → Authentication → URL Configuration** : `Site URL` = l'URL `*.pages.dev`
   obtenue à l'étape 1 (et l'ajouter aux _Redirect URLs_). Facultatif : restreindre le CORS de
   l'Edge Function avec le secret `ALLOWED_ORIGIN` = cette même URL.

## Fonctionnalités (MVP)

| #   | Fonction    | Détails                                                                                                                                                                       |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Auth        | Email + mot de passe (Supabase Auth), routes protégées                                                                                                                        |
| 2   | Recherche   | Par **nom**, **set** ou **numéro** (`025`, `025/165`, `TG05`), en français, debounce 350 ms + `AbortController`                                                               |
| 3   | Fiche carte | Image HD, set, rareté, illustrateur, versions existantes, prix Cardmarket (bas / moyen / tendance, + reverse/holo)                                                            |
| 4   | Collection  | Ajout, suppression, quantité, état (NM/EX/GD/PL), version (normale/reverse/holo). Un doublon (même carte + état + version) **incrémente** la quantité, atomiquement côté base |
| 5   | Valeur      | Valeur totale et par set, nombre de cartes sans prix connu                                                                                                                    |
| 6   | Scan        | Caméra (`getUserMedia`) ou photo, OCR Tesseract.js (nom + numéro), suggestions classées, correction manuelle, confirmation par l'utilisateur                                  |
| 7   | Hors ligne  | App shell précachée, images et réponses TCGdex consultées mises en cache par le service worker                                                                                |

## Stack

React 19 · Vite 8 · TypeScript 6 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) ·
React Router 8 · Tailwind 4 · vite-plugin-pwa 2 (Workbox) · Supabase (Auth, Postgres + RLS, Edge
Functions) · Zod 4 · Tesseract.js 7 · Vitest 5 · ESLint 10 (typescript-eslint strict) · Prettier.

## Architecture

```
src/
├── lib/                      # Logique pure et transverse (sans React)
│   ├── result.ts             # Result<T, E> : aucun appel réseau ne lève d'exception
│   ├── http.ts               # fetchJson : timeout, retry borné, validation zod
│   ├── cardNumber.ts         # Normalisation des numéros de collection
│   ├── ocr/normalize.ts      # Texte OCR → { nom, numéro }  (testé)
│   ├── matching/score.ts     # Scoring des candidats, top-k en O(n·k)  (testé)
│   ├── pricing/valuation.ts  # Valeur par carte / set / total, en centimes  (testé)
│   ├── collection/duplicates.ts # Détection de doublon (miroir de la contrainte SQL)  (testé)
│   └── supabase/             # Client (clé publishable uniquement) + types de la base
├── providers/
│   ├── cards/types.ts        # Interface CardProvider (Open/Closed)
│   ├── cards/tcgdex/         # TcgdexProvider : schémas zod, mappers, requêtes
│   ├── cards/registry.ts     # TcgId → CardProvider (ajouter OnePieceProvider ici)
│   └── prices/               # Interface PriceProvider + EdgeFunctionPriceProvider
├── features/
│   ├── auth/                 # Contexte de session, page de connexion, garde de route
│   ├── search/               # Recherche nom/set/numéro, page set, fiche carte
│   ├── collection/           # Repository Supabase, état optimiste, page valeur
│   └── scan/                 # Caméra, prétraitement d'image, OCR, candidats
└── components/               # Layout, états loading/error/empty, images, PWA
supabase/
├── migrations/               # SQL versionné (schéma + RLS + RPC)
├── functions/card-prices/    # Edge Function : cache des prix (TTL 24 h)
└── functions/_shared/        # PriceSource + extraction des prix (pure, testée)
public/_headers               # CSP stricte et en-têtes de sécurité (Cloudflare Pages)
```

### Flux des prix

```
Client ──(JWT utilisateur, ≤100 ids)──▶ Edge Function card-prices
                                          │ 1. lit card_prices (cache partagé)
                                          │ 2. rafraîchit ≤25 entrées périmées (>24 h),
                                          │    5 en parallèle, via PriceSource (TCGdex)
                                          │ 3. upsert avec la clé secrète (RLS bypass)
                                          ▼
                                     { prices: [...] , stale }
```

Le client ne peut **que lire** `card_prices` ; il n'appelle jamais une API de prix en masse. Une
grosse collection se « réchauffe » sur quelques appels (budget de 25 rafraîchissements par requête),
les valeurs périmées restent servies avec `stale: true`.

### Ajouter un jeu (ex. One Piece)

1. Ajouter `'onepiece'` à `TcgId` (`src/providers/cards/types.ts`) et à la contrainte `check (tcg in …)` via une nouvelle migration.
2. Créer `src/providers/cards/onepiece/OnePieceProvider.ts` qui implémente `CardProvider`.
3. L'enregistrer dans `src/providers/cards/registry.ts`, et ajouter un `PriceSource` côté Edge Function.

Aucun écran ni aucune fonction pure n'a besoin d'être modifié.

## Décisions et hypothèses (à valider)

Documentation vérifiée le 23/11/2026 (TCGdex, Supabase, Tesseract.js, vite-plugin-pwa, Pokémon TCG API).

1. **Source de prix : TCGdex (Cardmarket, EUR) au lieu de la Pokémon TCG API.** La Pokémon TCG API
   est **dépréciée** : plus aucune inscription de nouvelle clé, les clés existantes fonctionnent
   jusqu'au 1er mars 2027, migration recommandée vers Scrydex (payant). TCGdex inclut désormais un
   bloc `pricing.cardmarket` dans chaque carte, gratuit, sans clé, avec les mêmes identifiants que le
   catalogue (aucun mapping d'ID fragile). L'architecture demandée est conservée : `PriceSource`
   côté serveur, Edge Function, cache `card_prices` TTL 24 h. Brancher une autre source = une classe.
2. **Prix de référence** : tendance Cardmarket (`trend`), sinon moyenne (`avg`), sinon plus bas
   (`low`). Reverse/holo utilisent les champs `-holo`. **Décote par état** (heuristique, pas une
   donnée de marché) : NM ×1, EX ×0,85, GD ×0,65, PL ×0,45.
3. **Colonnes ajoutées** au schéma demandé :
   - `collection_items` : instantané `card_name`, `set_id`, `set_name`, `local_id`, `image_url`
     pour afficher la collection (et sa copie hors ligne) sans un appel API par carte.
   - `card_prices` : `holo_low/mid/market` (les reverse/holo ont un autre prix), `source`, `tcg`.
   - La contrainte d'unicité inclut `tcg` : `(user_id, tcg, card_id, condition, variant)`, pour
     qu'un futur jeu ne puisse pas entrer en collision d'identifiant.
4. **Cartes TCG Pocket exclues** : TCGdex mélange les cartes numériques de Pokémon TCG Pocket
   (série `tcgp`) avec les cartes physiques ; elles sont filtrées du catalogue.
5. **Recherche par numéro** : le filtre strict `eq:` de TCGdex ne fonctionne pas sur `localId`
   (vérifié). On interroge par suffixe (`localId=*25`) puis on filtre l'égalité exacte en local
   (`025` = `25`, `TG05` = `TG5`).
6. **OCR** : Tesseract.js exécute déjà la reconnaissance dans son propre Web Worker. Le worker et
   le cœur WASM (variantes LSTM uniquement) sont **auto-hébergés** sous `/tesseract/` (copiés depuis
   `node_modules` au build) pour garder `script-src 'self'` ; seules les données de langue
   (`fra` + `eng`) viennent de jsDelivr au premier scan, puis d'IndexedDB.
7. **Toutes les routes exigent une connexion** (le prix passe par une Edge Function authentifiée,
   ce qui empêche un usage anonyme du quota).

## Base de données

Migration : `supabase/migrations/20261123000001_init_schema.sql`

| Table              | Accès client                                                | Points clés                                                                                           |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `profiles`         | lecture / mise à jour de `display_name`, ses propres lignes | Créée par trigger à l'inscription                                                                     |
| `collection_items` | CRUD sur ses propres lignes                                 | `unique (user_id, tcg, card_id, condition, variant)` (sert aussi d'index), checks sur tous les champs |
| `card_prices`      | **lecture seule** (`authenticated`)                         | Écrite uniquement par l'Edge Function (clé secrète)                                                   |

- RLS activée partout, politiques `to authenticated` avec `(select auth.uid())` (évalué une fois par requête).
- `revoke all … from anon, authenticated` puis grants explicites minimaux.
- RPC `add_collection_item` en `security invoker` : `insert … on conflict do update set quantity = quantity + n` → pas de condition de course entre deux appareils.
- Fonctions `security definer` limitées au trigger d'inscription, `search_path = ''`.

## Développement local

Prérequis : Node ≥ 22.12 (voir `.nvmrc`).

```bash
npm ci
cp .env.example .env.local    # puis renseigner l'URL et la clé publishable
npm run dev                   # http://localhost:5173
```

| Script                                                        | Rôle                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm test`                                                    | Vitest : normalisation OCR, matching, valorisation, doublons, HTTP, prix, image |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | Qualité                                                                         |
| `npm run build`                                               | `tsc -b` + build Vite + service worker                                          |

Le scan nécessite HTTPS (ou `localhost`). Pour tester sur téléphone en local : `npm run dev -- --host`
derrière un tunnel HTTPS, ou déployez une préversion Cloudflare Pages.

## Déploiement gratuit

### 1. Supabase (Free)

1. Créer un projet sur [supabase.com](https://supabase.com) (région UE recommandée).
2. Installer la CLI puis lier le projet :
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```
3. Appliquer la migration : `npx supabase db push`
4. Déployer l'Edge Function : `npx supabase functions deploy card-prices`
   (`verify_jwt = true` est déclaré dans `supabase/config.toml`).
5. Restreindre le CORS de la fonction à votre domaine (facultatif mais recommandé) :
   ```bash
   npx supabase secrets set ALLOWED_ORIGIN=https://<votre-projet>.pages.dev
   ```
   `SUPABASE_URL` et les clés (`SUPABASE_SECRET_KEYS`, …) sont injectées automatiquement dans
   l'Edge Function : **aucune clé secrète n'est à copier nulle part**.
6. Dashboard → **Authentication → URL Configuration** : `Site URL` = l'URL Cloudflare Pages
   (sinon le lien de confirmation d'email pointe vers `localhost`).
7. Dashboard → **Settings → API Keys** : copier la **publishable key** (`sb_publishable_…`).

### 2. Cloudflare Pages (Free)

1. Dashboard Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, choisir ce dépôt.
2. Paramètres de build :
   - Framework preset : _None_ (ou Vite)
   - Build command : `npm run build`
   - Output directory : `dist`
3. Variables d'environnement (Production **et** Preview) :

   | Variable                        | Valeur                              | Secrète ?                        |
   | ------------------------------- | ----------------------------------- | -------------------------------- |
   | `VITE_SUPABASE_URL`             | `https://<project-ref>.supabase.co` | Non (publique)                   |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`                  | Non (publique, protégée par RLS) |
   | `NODE_VERSION`                  | `22`                                | Non                              |

   L'app **refuse de démarrer** si on y met par erreur une clé secrète (`sb_secret_…` ou JWT `service_role`).

4. Déployer. `public/_headers` applique la CSP ; l'absence de `404.html` active le fallback SPA natif de Pages.

### Variables d'environnement — récapitulatif

| Où                     | Variable                                                                             | Usage                                    |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------- |
| Client (build)         | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`                                 | Seules valeurs embarquées dans le bundle |
| Edge Function (secret) | `ALLOWED_ORIGIN`                                                                     | Origine CORS autorisée (défaut `*`)      |
| Edge Function (auto)   | `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_JWKS` | Injectées par Supabase                   |

## Sécurité

- **CSP stricte** (`public/_headers`) : `script-src 'self' 'wasm-unsafe-eval'` (WASM de Tesseract,
  aucun `unsafe-eval` ni `unsafe-inline`), `connect-src` limité à TCGdex, Supabase et jsDelivr,
  `img-src` limité à `assets.tcgdex.net`, `frame-ancestors 'none'`, `object-src 'none'`.
  Note : la CSP s'applique aussi au service worker, d'où `assets.tcgdex.net` dans `connect-src`.
- `Permissions-Policy` : caméra autorisée pour l'origine seulement, micro/géoloc refusés.
- Aucune clé secrète côté client ; clés de service uniquement dans l'Edge Function.
- Toutes les entrées validées : formulaires (zod), réponses API (zod), corps de l'Edge Function (zod),
  et contraintes `check` en base. Les valeurs de filtre TCGdex sont neutralisées (`*`, `|`, opérateurs).
- Pas de `dangerouslySetInnerHTML` (interdit par une règle ESLint) ; les URL d'images hors
  `assets.tcgdex.net` sont ignorées.
- Redirection post-login limitée aux chemins internes (pas d'open redirect) ; messages d'erreur
  d'auth neutres (pas d'énumération d'emails).
- `npm audit` : 4 alertes modérées dans `workbox-build` → `minimatch` (outil de **build** uniquement,
  non embarqué dans le bundle). À suivre lors des mises à jour de vite-plugin-pwa.

## Limites connues

- **Précision de l'OCR** : fiable sur le numéro (`025/165`) avec une photo nette, plus aléatoire sur
  le nom (polices stylisées, cartes holo, reflets). Sur nos tests, les deux cartes de référence sont
  trouvées en 1re suggestion, l'une uniquement grâce au numéro. Cartes très anciennes sans
  `n/total`, cartes japonaises et promos atypiques : passer par la correction manuelle ou la recherche.
- **Premier scan lent** : téléchargement des modèles de langue (~quelques Mo) et d'un cœur WASM
  (~3,9 Mo), mis en cache ensuite. Mémoire libérée en quittant l'écran de scan.
- **Prix** : Cardmarket uniquement (EUR), mis à jour quotidiennement par TCGdex ; cartes sans
  annonce Cardmarket = « aucun prix ». La décote par état est une heuristique. Ce n'est pas un
  conseil financier.
- **Quotas Supabase Free** : 500 Mo de base, 50 000 MAU, 500 000 invocations d'Edge Function / mois,
  5 Go d'egress, 2 projets actifs.
- **Emails d'authentification** : le SMTP intégré de Supabase est limité à 2 emails/heure et
  aux seules adresses des membres de l'organisation ; voir « Mise en service » (désactiver la
  confirmation d'email ou configurer un SMTP).
- **Pause du projet Supabase gratuit après 1 semaine d'inactivité** : l'app affiche alors des
  erreurs de connexion ; il faut le réactiver depuis le dashboard (ou générer un peu d'activité).
- **TCGdex** : API communautaire gratuite sans SLA ni limite documentée ; elle est appelée
  directement par le client pour le catalogue (cache SW) et par l'Edge Function pour les prix (≤25/req).
- **Hors ligne** : lecture seule de ce qui a déjà été consulté ; la collection elle-même n'est pas
  persistée hors ligne et l'ajout de cartes nécessite le réseau.
- **Optimiste** : en cas d'échec réseau pendant deux modifications simultanées, le rollback peut
  annuler visuellement la seconde ; un rechargement resynchronise.
- **Bundle initial** ~190 Ko gzip (React, Supabase, Zod, Router) ; les écrans secondaires et l'OCR
  sont chargés à la demande.

## Licence des données

Données et images : [TCGdex](https://tcgdex.dev) (projet communautaire). Prix : Cardmarket via TCGdex.
