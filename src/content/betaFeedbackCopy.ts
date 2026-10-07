/**
 * Textes UI « Donner mon avis » — SPEC_AVIS_BETA + corrections Vérificateur §7 (2026-10-07).
 * Tutoiement (H1). Lexique : « Effort », jamais le sigle anglais (SEC-TON-02).
 */

export const BETA_FEEDBACK_SETTINGS_LABEL = 'Donner mon avis'

export const BETA_FEEDBACK_SCREEN_TITLE = 'Ton avis nous aide à améliorer Ranked Gym'

export const BETA_FEEDBACK_TEXTE_HELP =
  "Raconte-nous ce qui s'est passé ou ce que tu aimerais. Pour un bug : que faisais-tu juste avant ?"

/** Sous le champ texte — oriente vers l’aide sans décourager (Vérificateur §7.1). */
export const BETA_FEEDBACK_TEXTE_HINT =
  "Pas besoin de parler de ta santé ici. Si ça ne va pas, tu peux trouver de l'aide dans « Besoin d'en parler ? »."

export const BETA_FEEDBACK_META_HINT =
  'Ajoutées automatiquement pour nous aider à comprendre.'

export const BETA_FEEDBACK_SUBMIT = 'Envoyer mon avis'

export const BETA_FEEDBACK_CONFIRM =
  'Merci ! Ton avis est bien arrivé. On lit chaque message, même si on ne peut pas répondre à chacun.'

/** Niveau 1 — TCA / mal-être (Vérificateur §7.3). */
export const BETA_FEEDBACK_CONFIRM_URGENT_TCA =
  "Merci de nous avoir écrit. Si tu traverses un moment difficile avec l'alimentation, ton corps ou le moral, tu n'es pas seul(e). Des professionnels peuvent t'écouter, sans jugement."

/** Niveau 2 — idées suicidaires (Vérificateur §7.3) — 3114 + 15 (ou 112). */
export const BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE =
  "Merci de nous avoir écrit. Ce que tu vis compte. Si tu penses au suicide ou si tu te sens en danger, appelle le 3114 : c'est gratuit, 24 h/24 et 7 j/7, et un professionnel formé t'écoute. Si ta vie est en danger maintenant, appelle le 15 (ou le 112)."

export const BETA_FEEDBACK_NO_REALTIME =
  'Nous lisons ton message, mais nous ne pouvons pas répondre en urgence.'

export const BETA_FEEDBACK_CALL_3114 = 'Appeler le 3114'
export const BETA_FEEDBACK_CALL_15 = 'Appeler le 15'
export const BETA_FEEDBACK_TEL_3114 = 'tel:3114'
export const BETA_FEEDBACK_TEL_15 = 'tel:15'

export const BETA_FEEDBACK_NEED_TO_TALK = "Besoin d'en parler ?"

export const BETA_FEEDBACK_SESSION_LINK = 'Une remarque ? Dis-le-nous'

export const BETA_FEEDBACK_CONSENT =
  "J'accepte que mon avis, la page et la version de l'app soient enregistrés pour améliorer Ranked Gym."

export const BETA_FEEDBACK_CONSENT_MORE = 'En savoir plus'

/** Pas de « Studio Manager » (Vérificateur §7.1). */
export const BETA_FEEDBACK_CONSENT_MORE_BODY =
  "Ton avis reste privé : il n'est jamais publié dans l'app. Seule l'équipe de Ranked Gym y a accès, avec l'aide d'un outil de tri automatique, pour améliorer l'app. Tu peux demander une copie ou la suppression de tes avis depuis les réglages ou en nous écrivant. Aucune donnée de santé n'est demandée ici."

export const BETA_FEEDBACK_ERROR_SEND =
  "Oups, l'envoi n'a pas marché. Ton texte est gardé : réessaie dans un instant."

export const BETA_FEEDBACK_RETRY = 'Réessayer'

export const BETA_FEEDBACK_OFFLINE =
  "Pas de connexion pour l'instant. Ton avis est gardé sur ton téléphone et partira tout seul dès que tu seras connecté(e)."

/** AV-17 — hors ligne + insultes : prévenir du masquage avant mise en file. */
export const BETA_FEEDBACK_OFFLINE_INSULT_MASK =
  "Hors ligne : les mots blessants seront masqués avant l'envoi. Tu peux reformuler, ou envoyer quand même."

/** AV-17 — avertissement avant déconnexion si file hors ligne non vide. */
export const BETA_FEEDBACK_LOGOUT_QUEUE_WARN =
  "Tu as des avis en attente d'envoi sur cet appareil. Te déconnecter les effacera. Continuer ?"

export const BETA_FEEDBACK_DAILY_LIMIT =
  "Tu as déjà envoyé 5 avis aujourd'hui, merci pour ton aide ! Tu pourras en envoyer d'autres demain."

export const BETA_FEEDBACK_EMPTY = "Écris quelques mots avant d'envoyer."

export const BETA_FEEDBACK_TOO_LONG =
  "Ton message dépasse 2 000 caractères. Tu peux le raccourcir ou l'envoyer en deux fois."

export const BETA_FEEDBACK_INSULT_PROMPT =
  "On sent que quelque chose t'a agacé(e), et ton avis compte. Tu veux le reformuler sans les mots blessants ?"

export const BETA_FEEDBACK_REFORMULATE = 'Reformuler'

export const BETA_FEEDBACK_SEND_ANYWAY = 'Envoyer quand même'

export const BETA_FEEDBACK_TYPE_BUG = 'Bug'
export const BETA_FEEDBACK_TYPE_BUG_HINT = 'Quelque chose ne marche pas'
export const BETA_FEEDBACK_TYPE_IDEE = 'Idée'
export const BETA_FEEDBACK_TYPE_IDEE_HINT = 'Une envie, une amélioration'
export const BETA_FEEDBACK_TYPE_AUTRE = 'Autre'
export const BETA_FEEDBACK_TYPE_AUTRE_HINT = 'Ce qui te plaît, ce qui te gêne…'

export const BETA_FEEDBACK_PAGE_LABEL = 'Page'
export const BETA_FEEDBACK_VERSION_LABEL = 'Version'

export const BETA_FEEDBACK_AGE_BLOCKED =
  'Cette fonction est réservée aux personnes majeures.'

/** Âge manquant côté profil (serveur fail-closed) — orienter vers le profil. */
export const BETA_FEEDBACK_COMPLETE_PROFILE =
  'Complète ton profil pour donner ton avis'

export const BETA_FEEDBACK_OPEN_PROFILE = 'Compléter mon profil'

export const BETA_FEEDBACK_BACK = 'Retour'
export const BETA_FEEDBACK_TYPE_GROUP_LABEL = "Type d'avis"
export const BETA_FEEDBACK_TEXTE_SR_LABEL = 'Ton avis'
export const BETA_FEEDBACK_DRAFT_KEPT = 'Brouillon conservé sur cet appareil.'
export const BETA_FEEDBACK_OFFLINE_QUEUED_HELP =
  'Ton avis partira dès que tu seras reconnecté(e).'
