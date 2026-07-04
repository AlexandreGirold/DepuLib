# Dépulib

**Relier l'avis citoyen au travail parlementaire réel** — POC réalisé pour le hackathon *« Le parcours de la loi : vers une IA de confiance »* (Assemblée nationale, juillet 2026).

Dépulib prend un avis citoyen, le classe, le relie à l'amendement en cours d'examen qui y répond, synthétise les retours pour les députés, et organise les rendez-vous (citoyens et représentants d'intérêts) — le tout **sourcé vers les textes officiels**, avec une IA au rôle strictement borné.

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

L'application est servie sur http://localhost:3000. Au premier démarrage, la base est créée, seedée (4 dossiers, 63 amendements, 10 organisations HATVP, 5 comptes, commentaires) et les embeddings calculés automatiquement.

> Sans clé API, l'app fonctionne quand même en **mode dégradé** (réponses de secours déterministes).

## Démarrage (local)

```bash
npm install
npx prisma db push          # crée data/depulib.db
npm run seed                 # données de démonstration
npm run embed                # embeddings bge-m3 des amendements
npm run dev                  # http://localhost:3000
```

La clé `CLOUDTEMPLE_LLMAAS_API_KEY` est lue depuis `depulib/.env` **ou** `../.env`.

## Comptes de démonstration (connexion FranceConnect simulée, sans mot de passe)

| Identifiant | Rôle | Espace |
|---|---|---|
| `marie.dupont` | Députée (Commission des lois) | `/depute/dashboard` |
| `paul.martin` | Collaborateur de M. Dupont | `/depute/dashboard` (lecture, RDV désactivés) |
| `hugo.citoyen` | Citoyen (circo. 93-07) | `/citoyen` |
| `lea.citoyenne` | Citoyenne (circo. 93-07) | `/citoyen` |
| `jean.lobby` | Représentant d'intérêts (France Digitale) | `/representant` |

## Parcours de démonstration

1. **Citoyen** (`hugo.citoyen`) → dossier « Protection des mineurs sur les espaces numériques » → écrire un avis sur le *scroll infini / design addictif* → l'IA propose l'amendement **CL12** avec résumé + lien officiel → « Soutenir cet amendement ».
2. **Députée** (`marie.dupont`) → tableau de bord → jauge de sentiment, top amendements, **synthèse avec verbatims réels** → onglet Avis : message modéré replié (« rien ne disparaît ») → calendrier : RDV de `jean.lobby`, **fiche HATVP** + document résumé par IA.
3. **Représentant** (`jean.lobby`) → demander un RDV, déposer une contribution + PDF → visible côté député dans l'onglet dédié, séparé des avis citoyens.
4. **Collaborateur** (`paul.martin`) → même dashboard que la députée, boutons d'action RDV désactivés.
5. **« Quoi de neuf ? »** (`hugo.citoyen`) → feed mensuel personnalisé, chaque item sourcé.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run seed` | (Ré)initialise la base avec les lois (open data AN) |
| `npm run embed` | Calcule les embeddings bge-m3 des amendements |
| `npm run warm` | Pré-génère et met en cache les résumés IA (dossiers + amendements) → clic instantané |
| `npm run ingest` | Enchaîne seed + embed + warm (pipeline complet de récupération des lois) |
| `POST /api/warm` | Même pré-génération, à la demande, pour un député connecté |
| `POST /api/mcp/sync` | Tente une synchro MCP tricoteuses (rôle député ; fallback BDD sinon) |

## Données législatives

Les dossiers sont des données de démonstration réalistes (`"source": "donnees-demo"`) au schéma open data AN. Le client MCP tricoteuses est implémenté (`src/lib/mcp.ts`) mais le site est protégé par un anti-bot : l'UI lit **exclusivement la BDD seedée**, la synchro MCP est optionnelle.
