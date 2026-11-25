import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CRENEAU_PHRASES } from './constants'
import { proposeCreneau, summarizeCrowd } from './engine'
import { TERGNIER_COORDS } from './sunset'

const root = resolve(__dirname, '..')

describe('créneau copy + Plan B dynamique', () => {
  it('TrainingView n’a plus la promesse « peu de monde, en sécurité » (CA-C34)', () => {
    const src = readFileSync(
      resolve(root, 'components/training/TrainingView.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/peu de monde,\s*en sécurité/)
    expect(src).not.toMatch(/peu de monde/)
  })

  it('CreneauFlow v9 : heroes par état + pas de case sunset', () => {
    const flow = readFileSync(
      resolve(root, 'components/training/creneau/CreneauFlow.tsx'),
      'utf8',
    )
    expect(flow).toMatch(/hero-01/)
    expect(flow).toMatch(/hero-07/)
    expect(flow).toMatch(/CreneauV9Screen/)
    expect(flow).not.toMatch(/Après le coucher du soleil/)
    expect(flow).not.toMatch(/type="checkbox"/)
  })

  it('Plan B crowd n’est plus codé en dur « Moyen · à confirmer »', () => {
    const flow = readFileSync(
      resolve(root, 'components/training/creneau/CreneauFlow.tsx'),
      'utf8',
    )
    expect(flow).not.toMatch(/Moyen · à confirmer/)
    const now = Date.now()
    const crowd = summarizeCrowd(
      [{ gymId: 'g2', level: 'charge', atMs: now - 1000, personId: 'x' }],
      'g2',
      now,
    )
    expect(crowd.label).toBe('Chargé')
  })

  it('phrases imposées v9 / Vérificateur', () => {
    expect(CRENEAU_PHRASES.minorHeroLine).toBe(
      "Retour avant 20 h. Un adulte de confiance peut t'aider.",
    )
    expect(CRENEAU_PHRASES.goButton).toBe("J'y vais")
    expect(CRENEAU_PHRASES.otherTime).toBe('Autre heure')
  })

  it('soleil phrase vient du calcul ville (Tergnier), pas hardcodée 17:00', () => {
    const { soleilPhrase, sunsetDisplayHm } = proposeCreneau({
      age: 28,
      nowHm: '15:00',
      heatVigilance: false,
      eveningWalkEnabled: false,
      stafflessGymEnabled: false,
      preferQuiet: true,
      softSession: false,
      delayMin: 0,
      favorite: {
        id: 'g1',
        name: 'Salle de la gare',
        staffFromHm: '07:00',
        staffUntilHm: '22:00',
        closesHm: '23:00',
        travelMin: 15,
        latitude: TERGNIER_COORDS.latitude,
        longitude: TERGNIER_COORDS.longitude,
        cityKnown: true,
      },
      backup: null,
      nowDate: new Date(2026, 10, 24),
    })
    expect(sunsetDisplayHm).toBe('16:55')
    expect(soleilPhrase).toBe('Le soleil se couche à 16:55.')
    expect(soleilPhrase).not.toMatch(/17:00/)
    expect(soleilPhrase).not.toMatch(/fera nuit/i)
  })
})
