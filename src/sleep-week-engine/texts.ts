// Textes des 12 états : noms et « Texte » repris mot pour mot de SCIENCE_12_ETATS.md (partie B).
// Les actions sont les actions de la partie B, écrites court ; les heures sont calculées sur la semaine d'exemple.
import { fmtClock, type SleepEtatResult } from './engine.ts'

const c = (m: number): string => fmtClock(Math.round(m / 5) * 5)

export const ANIM: Record<number, string> = {
  // useAnimations (MIT) — un fichier différent par état
  1: 'battery-charging',
  2: 'sunrise',
  3: 'coffee',
  4: 'clock',
  5: 'sun',
  6: 'repeat',
  7: 'moon',
  8: 'anchor',
  9: 'wind',
  10: 'watch',
  11: 'smartphone',
  12: 'thumb-up',
}

export const SLUG: Record<number, string> = {
  1: 'nuits_courtes_fatigue',
  2: 'longues_nuits',
  3: 'tres_courtes_en_forme',
  4: 'juste_sous_le_besoin',
  5: 'tres_longues_epuise',
  6: 'yoyo_semaine_weekend',
  7: 'couche_tard_regulier',
  8: 'horaires_zigzag',
  9: 'nuit_en_morceaux',
  10: 'nuit_courte_grosse_sieste',
  11: 'ado_un_peu_court',
  12: 'rythme_au_top',
}

export type SleepEtatTexts = {
  nom: string
  texte: string
  actions: string[]
  aide?: boolean
  bars?: boolean
}

export function etatTexts(id: number, r: SleepEtatResult): SleepEtatTexts | undefined {
  const s = r.s
  const cible = s.Cmed - 15
  const rep = `${(r.Bb ?? 0) / 60} à ${(r.Bh ?? 0) / 60} h`
  const T: Record<number, SleepEtatTexts> = {
    1: {
      nom: 'Nuits courtes, fatigue',
      texte: `Semaine chargée. Ce soir, au lit à ${c(cible)}.`,
      actions: [
        `Ce soir, au lit à ${c(cible)}. Ensuite 15 min plus tôt chaque soir, jusqu'à ton repère (${rep}).`,
        '45 min avant le coucher : écran posé ou en mode nuit, lumière douce.',
        'Ni café, ni thé fort, ni cola, ni boisson énergisante 6 h avant le lit.',
      ],
    },
    2: {
      nom: 'Longues nuits, mais fatigue',
      texte: 'Tu dors beaucoup, top. Essaie le même réveil chaque jour.',
      actions: [
        `Lève-toi à la même heure chaque jour (vers ${c(s.Lmed)}, à 30 min près).`,
        "30 min dehors ou près d'une fenêtre, peu après le lever.",
        `Ton repère : ${rep}.`,
      ],
    },
    3: {
      nom: 'Nuits très courtes mais en forme',
      texte:
        'En forme, top ! Ton corps a quand même besoin de plus de nuit. On teste 15 min de plus ce soir ?',
      actions: [
        `Café, thé, cola ou boisson énergisante : le dernier avant ${c(cible - 360)}.`,
        `Ce soir, au lit à ${c(cible)}. Ensuite 15 min plus tôt chaque soir.`,
        'Test : 3 nuits à ton repère, puis compare ta forme.',
      ],
      aide: true,
    },
    4: {
      nom: 'Presque assez',
      texte: 'Il manque 15 min. Au lit 15 min plus tôt ce soir.',
      actions: [
        `Ce soir et demain : au lit 15 min plus tôt (${c(cible)}).`,
        'Coup de barre ? Sieste flash de 10 à 20 min, avant 15 h.',
        `Café ou thé : le dernier avant ${c(cible - 360)}.`,
      ],
    },
    5: {
      nom: 'Longues nuits, toujours fatigue',
      texte: "Ce n'est pas ta faute. On essaie un réveil fixe et la lumière du matin.",
      actions: [
        `Lève-toi à la même heure chaque jour (vers ${c(s.Lmed)}), aussi le week-end.`,
        "30 min de lumière le matin : dehors ou près d'une fenêtre.",
      ],
      aide: true,
    },
    6: {
      nom: 'Semaine ≠ week-end',
      texte: 'Le week-end, tu rattrapes beaucoup. On rapproche tes deux rythmes, petit à petit.',
      bars: true,
      actions: [
        'En semaine : au lit 15 min plus tôt chaque soir.',
        'Le week-end : réveil max 1 h plus tard, puis lumière.',
      ],
    },
    7: {
      nom: 'Couche-tard régulier',
      texte: "Tard mais régulier, et tu dors assez. Envie d'avancer ? 15 min par jour.",
      actions: [
        "Envie d'avancer ? Coucher et lever 15 min plus tôt chaque jour, avec de la lumière dès le lever.",
        "Moins d'écrans dans l'heure avant le coucher.",
        'Sinon, garde ce rythme : il est régulier, bravo.',
      ],
    },
    8: {
      nom: 'Heures en zigzag',
      texte: 'Tes heures bougent. Un seul but : même réveil chaque jour.',
      actions: [
        'Un seul repère : lève-toi à la même heure 7 jours sur 7 (à 30 min près).',
        'Le soir, à heure fixe : on ralentit.',
        'Mini-routine au choix : douche, lecture papier, lumière douce.',
      ],
    },
    9: {
      nom: 'Nuit en morceaux',
      texte: 'Tes nuits sont en petits morceaux. Ce soir, on essaie une routine calme de 5 min.',
      actions: [
        'Pas sommeil ? Lève-toi, fais un truc calme dans une lumière douce, reviens quand le sommeil arrive.',
        'Ce soir : 5 min de respiration lente.',
        `Café ou thé : le dernier avant ${c(s.Cmed - 360)}.`,
      ],
      aide: true,
    },
    10: {
      nom: 'Nuit courte + grosse sieste',
      texte: "Ta sieste t'aide, mais elle vole du sommeil à ta nuit. Garde-la courte et tôt.",
      actions: [
        'Sieste courte : 20 min au plus, avant 15 h.',
        `Au lit 15 min plus tôt chaque soir (ce soir ${c(cible)}).`,
        'Minuteur sieste : 20 min.',
      ],
    },
    11: {
      nom: 'Un peu court pour ton âge',
      texte: 'À ton âge, le corps aime 8 à 10 h. Tu es tout près : 15 min de plus ce soir !',
      actions: [
        `Au lit 15 min plus tôt chaque soir (ce soir ${c(cible)}), jusqu'à 8 h de nuit.`,
        'Écran posé 30 à 60 min avant le coucher.',
        'Même heure de lever, aussi le week-end (à 1 h près).',
      ],
    },
    12: {
      nom: 'Rythme au top',
      texte: 'Bravo, rythme régulier et une durée qui colle à ton âge !',
      actions: ['Garde la même heure de lever.'],
    },
  }
  return T[id]
}

export const AIDE: Record<number, string> = {
  3: "Moins de 6 h, c'est sous ton repère, même quand tu te sens en forme. On avance de 15 min à la fois.",
  5: "Une longue nuit ne repose pas toujours plus. Même réveil et lumière du matin aident. L'app ne te dira jamais de dormir encore plus.",
  9: 'Pas sommeil ? Un moment calme hors du lit aide. Pas de minuteur, pas de règle stricte.',
}

export const LIGNE_PRO = 'Si la fatigue dure malgré tout, un pro de santé peut aider.'
