# Dépulib

**Relier l'avis citoyen au travail parlementaire réel** — POC réalisé pour le hackathon *« Le parcours de la loi : vers une IA de confiance »* (Assemblée nationale, juillet 2026).

Dépulib prend un avis citoyen, le classe, le relie à l'amendement en cours d'examen qui y répond, synthétise les retours pour les députés, et organise les rendez-vous (citoyens et représentants d'intérêts) — le tout **sourcé vers les textes officiels**, avec une IA au rôle strictement borné.

liens (accèssible pour le moment): http://51.210.2.119:3000/

## IA de confiance, par conception

- **Ancrage documentaire** : toute sortie IA affiche ses sources cliquables (dossier AN / texte officiel). Sans source valide → badge « Non sourcé ».
- **Validation serveur des sources** : chaque URL citée par le modèle est vérifiée contre le contexte fourni ; les sources inventées sont retirées (anti-hallucination).
- **Seuil de confiance 0,7** : l'IA ne relie un avis à un amendement que si elle est sûre — sinon elle se tait.
- **Modération transparente** : aucun message supprimé ; les messages signalés sont repliés avec leur motif, exclus des agrégats, consultables au clic.
- **IA souveraine** : inférence sur **Cloud Temple LLMaaS** (SecNumCloud / HDS). Bascule automatique en mode dégradé déterministe si l'IA est indisponible.

## Stack

Next.js 14 (App Router, TS strict) · `@codegouvfr/react-dsfr` (Système de design de l'État) · SQLite + Prisma · iron-session · Cloud Temple LLMaaS (modèle **`mistral-small4:119b`**, embeddings `bge-m3`).

## Démarrage (Docker — recommandé)

```bash
# 1. Renseigner la clé API dans depulib/.env (voir .env.example)
cp .env.example .env   # puis éditer CLOUDTEMPLE_LLMAAS_API_KEY
# 2. Lancer
docker compose up --build
```

L'application est servie sur http://localhost:3000. Au premier démarrage, la base est créée, seedée (49 lois réelles de l'open data AN réparties par commission, 319 amendements, 10 organisations HATVP, 5 comptes, commentaires), les embeddings calculés et les résumés IA pré-générés automatiquement.

> Sans clé API, l'app fonctionne quand même en **mode dégradé** (réponses de secours déterministes).

## Démarrage (local)

```bash
npm install
cp -r node_modules/@codegouvfr/react-dsfr/dsfr public/dsfr  # styles DSFR (sinon page sans CSS)
npx prisma db push          # crée data/depulib.db
npm run seed                 # lois AN + résumés/synthèses IA + embeddings FIGÉS (aucun appel LLM)
npm run dev                  # http://localhost:3000
```

> `public/dsfr` est ignoré par git (build artifact) et doit être régénéré après chaque `npm install`.

Les résumés IA, synthèses et embeddings sont **figés dans le dépôt** (`seed/resumes.json`, `seed/embeddings.json`) : `npm run seed` les recharge à l'identique, **sans clé API ni appel LLM**. Pour tout régénérer depuis le modèle (après import de nouvelles lois), utiliser `npm run ingest` puis `npm run export:resumes`.

La clé `CLOUDTEMPLE_LLMAAS_API_KEY` est lue depuis `depulib/.env` **ou** `../.env`.

## Comptes de démonstration (connexion FranceConnect simulée, sans mot de passe)

| Identifiant | Rôle | Espace |
|---|---|---|
| `alain.david` | Député (Gironde, Commission des lois) | `/depute/dashboard` |
| `paul.martin` | Collaborateur de M. David | `/depute/dashboard` (lecture, RDV désactivés) |
| `hugo.citoyen` | Citoyen (circo. 93-07) | `/citoyen` |
| `lea.citoyenne` | Citoyenne (circo. 93-07) | `/citoyen` |
| `jean.lobby` | Représentant d'intérêts (France Digitale) | `/representant` |

## Parcours de démonstration

1. **Citoyen** (`hugo.citoyen`) → commission « Affaires culturelles et éducation » → loi réelle « Protéger les mineurs des risques […] réseaux sociaux » → écrire un avis sur la *protection de la petite enfance face aux écrans* → l'IA propose l'amendement réel **AC9** avec résumé + lien vers le texte officiel → « Soutenir cet amendement ».
2. **Député** (`alain.david`) → tableau de bord → jauge de sentiment, top amendements, **synthèse avec verbatims réels** → onglet Avis : message modéré replié (« rien ne disparaît ») → calendrier : RDV de `jean.lobby`, **fiche HATVP** + document résumé par IA.
3. **Représentant** (`jean.lobby`) → demander un RDV, déposer une contribution + PDF → visible côté député dans l'onglet dédié, séparé des avis citoyens.
4. **Collaborateur** (`paul.martin`) → même dashboard que le député, boutons d'action RDV désactivés.
5. **« Quoi de neuf ? »** (`hugo.citoyen`) → feed mensuel personnalisé, chaque item sourcé.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run seed` | (Ré)initialise la base avec les lois (open data AN) |
| `npm run embed` | Calcule les embeddings bge-m3 des amendements |
| `npm run warm` | Pré-génère et met en cache les résumés IA (dossiers + amendements) → affichage instantané |
| `npm run fix:amendements` | Rattache les `sourceUrl` d'amendements à l'open data AN (URLs officielles valides) — voir *Données législatives* |
| `npm run export:resumes` | Fige les résumés/synthèses IA + embeddings réels dans `seed/resumes.json` et `seed/embeddings.json` (versionnés) |
| `npm run ingest` | Enchaîne seed + embed + warm (régénère tout via le LLM) |
| `POST /api/warm` | Même pré-génération, à la demande, pour un député connecté |
| `POST /api/mcp/sync` | Tente une synchro MCP tricoteuses (rôle député ; fallback BDD sinon) |

## Données législatives

Les lois proviennent de l'**open data de l'Assemblée nationale** (17e législature, `"source": "assemblee-nationale-opendata"`) : dossiers inscrits à l'ordre du jour de la séance publique, répartis par commission au fond, avec leurs amendements réels (numéro, auteur, article, dispositif, exposé sommaire, sort, URL officielle vérifiable). Le client MCP tricoteuses est aussi implémenté (`src/lib/mcp.ts`) mais le site est protégé par un anti-bot ; l'UI lit **exclusivement la BDD**.

### Sources d'amendements vers les textes officiels

Chaque amendement pointe vers sa page officielle sur `assemblee-nationale.fr`. L'URL est la forme **canonique dérivée de l'`uid` open data** (`/dyn/17/amendements/<uid>`), qui **redirige toujours** vers la bonne page — contrairement à une URL reconstruite à la main (mauvais numéro de texte → lien mort). Ces URLs sont **figées dans le seed**, donc aucun appel à l'API n'est nécessaire au démarrage.

- **Mapping open data** (API tricoteuses) : les amendements d'un dossier se récupèrent via `GET /amendements?dossierRefUid=<REFUID>` (l'`id` de dossier sans le préfixe `an-`, en majuscules). L'API rate-limite sous charge (502/503).
- **`npm run fix:amendements`** ré-aligne les `sourceUrl` (et les sources figées de `seed/resumes.json`) sur l'open data : idempotent, préfère la version canonique en cas de doublon, et replie sur la page officielle du dossier si un amendement est introuvable — **jamais de lien cassé**. Relancer `npm run seed` ensuite pour propager en BDD.
- **Résumés IA au fetch, pas au clic** : les résumés d'amendements sont pré-générés à l'ingestion (`npm run warm`, figés dans `seed/resumes.json`) ; les pages les lisent en lecture seule, sans appel LLM au rendu.
