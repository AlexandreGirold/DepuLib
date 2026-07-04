import { fr } from "@codegouvfr/react-dsfr";

export const metadata = { title: "À propos & garde-fous — Dépulib" };

export default function AProposPage() {
  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--center")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-9")}>
          <h1>Une IA de confiance, par conception</h1>
          <p className={fr.cx("fr-text--lead")}>
            Dépulib relie l'avis citoyen au texte de loi en cours d'examen. L'IA y a
            un rôle strictement borné : elle assiste, elle ne décide jamais.
          </p>

          <h2>Ancrage documentaire systématique</h2>
          <p>
            Toute sortie de l'IA (résumé, synthèse, brief, feed) est affichée avec ses
            sources : des liens cliquables vers le dossier législatif de l'Assemblée
            nationale ou vers le texte officiel. Une sortie sans source valide porte
            un badge « Non sourcé ».
          </p>

          <h2>Validation serveur des sources (anti-hallucination)</h2>
          <p>
            Chaque URL que le modèle prétend citer est validée côté serveur : elle doit
            appartenir aux textes réellement fournis dans le contexte. Toute source
            inventée est automatiquement retirée. C'est notre garantie contre les
            hallucinations de références.
          </p>

          <h2>Seuil de confiance : l'IA préfère se taire</h2>
          <p>
            Lorsqu'elle relie un avis citoyen à un amendement, l'IA n'affiche une
            correspondance que si sa confiance dépasse 0,7. En dessous, elle ne propose
            rien plutôt que de risquer une erreur — principe « certain / incertain /
            inconnu ».
          </p>

          <h2>Modération transparente</h2>
          <p>
            Aucun message n'est supprimé. Les messages signalés sont repliés, avec leur
            motif visible, exclus des agrégats de sentiment mais toujours consultables
            au clic. Rien ne disparaît, tout reste traçable.
          </p>

          <h2>IA souveraine</h2>
          <p>
            L'inférence est réalisée en France sur <strong>Cloud Temple LLMaaS</strong>,
            une infrastructure qualifiée <strong>SecNumCloud</strong> et certifiée HDS.
            Les données ne sont ni exploitées ni conservées après traitement. En cas
            d'indisponibilité, l'application bascule automatiquement sur des réponses de
            secours déterministes (mode dégradé) sans jamais s'interrompre.
          </p>

          <h2>Rôle borné</h2>
          <p>
            Le prompt système commun à tous les appels interdit à l'IA de donner une
            opinion politique ou de recommander un vote. Si l'information ne figure pas
            dans les sources, elle répond « information non disponible dans les
            sources ».
          </p>
        </div>
      </div>
    </div>
  );
}
