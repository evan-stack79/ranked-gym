/**
 * Textes Juriste — mot pour mot (SPEC 8/11/2026 13:40).
 * Ne pas reformuler côté UI.
 */
import { PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY, PRO_OFFERS } from './constants'

/** PRO-L05 — case de renonciation (non précochée). */
export const PRO_L05_CHECKBOX_TEXT =
  "Je demande l'accès immédiat à Ranked Pro et je reconnais perdre mon droit de rétractation de 14 jours dès que cet accès commence."

/** PRO-L05b — au-dessus du bouton, mensuel. */
export const PRO_L05B_MONTHLY =
  "Essai gratuit de 14 jours, puis 9,99 €/mois, renouvelé automatiquement jusqu'à résiliation. Résilie à tout moment depuis les réglages de ton compte App Store / Google Play, au moins 24 h avant la fin de l'essai pour ne rien payer."

/** PRO-L05b — annuel. */
export const PRO_L05B_YEARLY =
  "Essai gratuit de 14 jours, puis 89,99 €/an, renouvelé automatiquement jusqu'à résiliation. Résilie à tout moment depuis les réglages de ton compte App Store / Google Play, au moins 24 h avant la fin de l'essai pour ne rien payer."

export function proL05bForOffer(offerKey: 'solo_monthly' | 'solo_yearly'): string {
  return offerKey === 'solo_yearly' ? PRO_L05B_YEARLY : PRO_L05B_MONTHLY
}

export const PRO_AUTO_RENEW_MENTION = 'renouvellement automatique jusqu’à résiliation'

export const PRO_CANCEL_LINK_LABEL = 'Résilier votre abonnement'

export const PRO_RESTORE_LABEL = 'Restaurer mes achats'

export const PRO_DISCOVER_CTA = 'Découvrir Pro'

/** Contenu Pro exact (PRO-C01…04 ; C05 retiré v0). */
export const PRO_CONTENT_BULLETS = [
  'Skins / thèmes / cadres de rang (look seulement)',
  'Badges cosmétiques Pro',
  '« Ma bouteille » (photo détourée)',
  'Confort UI (widgets, personnalisation Accueil, historique plus long) — sans effet compétitif',
] as const

export const PRO_EXCLUDED_BULLETS = [
  'Aucun impact sur rang, Ranked Force, Discipline ou ligues',
  'Même taux et plafond de points partenaires',
  'Catalogue cadeaux identique (pas d’accès anticipé ni exclusif)',
] as const

/**
 * PRO-D02 — texte temporaire sans asso, mot pour mot (+ date précise PRO-D03).
 */
export function proD02EngagementText(
  announceBy: string = PRO_ENGAGEMENT_ASSOCIATION_ANNOUNCE_BY,
): string {
  return `Ranked Gym s'engage à reverser 6 % de son chiffre d'affaires (hors taxes et commissions des stores) à une association. L'association sera annoncée avant le ${announceBy} et les montants versés seront publiés ici chaque trimestre.`
}

/** Interdits côté joueur (PRO-D05). */
export const PRO_DONATION_FORBIDDEN_PHRASES = [
  'ton abonnement finance une asso',
  'don',
  'déductible',
  'reçu fiscal',
  "6 % de ton abonnement",
] as const

export const PRO_YEARLY_PRICE_LINE = `89,99 € / an, soit environ ${PRO_OFFERS.yearly.monthlyEquivalentEurosDisplay} / mois`

export const PRO_MONTHLY_PRICE_LINE = '9,99 € / mois'

export const PRO_PAGE_ENGAGEMENT_TITLE = 'Notre engagement 6 %'

export const PRO_WEB_PURCHASE_UNAVAILABLE =
  'Achat disponible dans l’application mobile Ranked Gym (App Store / Google Play). Aucun paiement web en v0.'
