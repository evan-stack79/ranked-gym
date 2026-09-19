import { describe, expect, it } from 'vitest'
import type { TrainingState, Weekday, WorkoutNote } from '../types/training'
import {
  deriveRecentSessions,
  deriveTodayHubCard,
  deriveWeekStrip,
  deriveWeeklySummary,
  findActiveStrengthSession,
  formatPaceDisplay,
  formatSessionSummary,
  hubActiveMinutes,
  launchableRoutineId,
} from './trainHub'

const FIXED = new Date('2026-09-04T15:00:00') // vendredi
const WEEKDAY = FIXED.getDay() as Weekday

function note(overrides: Partial<WorkoutNote> & Pick<WorkoutNote, 'id' | 'title'>): WorkoutNote {
  return {
    dateKey: '2026-09-04',
    exercises: [{ id: 'e1', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] }],
    createdAt: FIXED.getTime(),
    estimatedKcal: 200,
    ...overrides,
  }
}

function baseState(overrides: Partial<TrainingState> = {}): TrainingState {
  return {
    primarySportId: 'musculation',
    favoriteSportIds: ['musculation'],
    stepsToday: 0,
    stepsDateKey: '2026-09-04',
    healthLinked: false,
    notificationsEnabled: false,
    templates: [],
    schedule: [],
    completed: [],
    workoutNotes: [],
    routines: [
      {
        id: 'push',
        label: 'Push',
        subtitle: 'Pecs',
        accent: '#f00',
        exercises: [{ id: 'a', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] }],
        updatedAt: 1,
      },
    ],
    lastSelectedRoutineId: null,
    lastSelectedSportId: null,
    ...overrides,
  }
}

describe('deriveTodayHubCard — priorités CTA', () => {
  it('1. séance commencée → Reprendre (prioritaire sur planifié)', () => {
    const card = deriveTodayHubCard(
      baseState({
        schedule: [
          {
            id: 's1',
            templateId: 'push',
            title: 'Push planifié',
            days: [WEEKDAY],
            time: '18:00',
            enabled: true,
          },
        ],
        routines: [
          {
            id: 'push',
            label: 'Push en cours',
            subtitle: '',
            accent: '#f00',
            exercises: [
              {
                id: 'a',
                name: 'Bench',
                sets: [
                  { reps: 8, weightKg: 60, done: true },
                  { reps: 8, weightKg: 60 },
                ],
              },
            ],
            updatedAt: 10,
          },
        ],
        lastSelectedRoutineId: 'push',
        activeWorkoutDraft: {
          routineId: 'push',
          sportId: 'musculation',
          startedAt: 1,
          updatedAt: 10,
        },
      }),
      FIXED,
    )
    expect(card.cta).toBe('resume')
    expect(card.canLaunchRoutine).toBe(true)
    expect(card.openTarget).toBe('notebook')
    expect(launchableRoutineId(card)).toBe('push')
    expect(card.title).toBe('Bench')
  })

  it('1b. séance libre démarrée (routine encore vide) → Reprendre', () => {
    const card = deriveTodayHubCard(
      baseState({
        routines: [
          {
            id: 'free-1',
            label: 'Séance libre',
            subtitle: '',
            accent: '#f00',
            exercises: [],
            updatedAt: 10,
          },
        ],
        activeWorkoutDraft: {
          routineId: 'free-1',
          sportId: 'musculation',
          startedAt: 1,
          updatedAt: 10,
        },
      }),
      FIXED,
    )
    expect(card.cta).toBe('resume')
    expect(card.summaryLine).toContain('Séance en cours')
  })

  it('2. planifié démarrable → Démarrer', () => {
    const card = deriveTodayHubCard(
      baseState({
        schedule: [
          {
            id: 's1',
            templateId: 'push',
            title: 'Push',
            days: [WEEKDAY],
            time: '18:00',
            enabled: true,
          },
        ],
      }),
      FIXED,
    )
    expect(card.cta).toBe('start')
    expect(card.sportLabel).toBe('Musculation')
    expect(card.openTarget).toBe('notebook')
    expect(launchableRoutineId(card)).toBe('push')
  })

  it('3. planifié sans routine démarrable (notebook) → Ouvrir Train + activité', () => {
    const card = deriveTodayHubCard(
      baseState({
        primarySportId: 'course-a-pied',
        schedule: [
          {
            id: 's1',
            templateId: 'notebook',
            title: 'Foot',
            days: [WEEKDAY],
            time: '18:00',
            enabled: true,
          },
        ],
      }),
      FIXED,
    )
    expect(card.cta).toBe('open_train')
    expect(card.sportLabel).toBe('Séance planifiée')
    expect(card.openTarget).toBe('activity')
    expect(card.canLaunchRoutine).toBe(false)
    expect(launchableRoutineId(card)).toBeNull()
  })

  it.each([
    ['course-a-pied', 'endurance', 'endurance', 'Course du soir'],
    ['football', 'team', 'session', 'Entraînement foot'],
    ['yoga', 'generic', 'session', 'Yoga'],
  ] as const)('créneau %s typé → Démarrer ouvre %s', (sportId, sessionKind, target, title) => {
    const card = deriveTodayHubCard(
      baseState({
        schedule: [{
          id: `scheduled-${sportId}`,
          templateId: 'notebook',
          title,
          days: [WEEKDAY],
          time: '07:30',
          enabled: true,
          sportId,
          sessionKind,
        }],
      }),
      FIXED,
    )
    expect(card).toMatchObject({
      cta: 'start',
      sportId,
      sessionKind,
      openTarget: target,
      summaryLine: 'Prévue à 07:30',
    })
    expect(launchableRoutineId(card)).toBeNull()
  })

  it('le sport connu corrige un sessionKind planifié incohérent', () => {
    const card = deriveTodayHubCard(baseState({
      schedule: [{
        id: 'run', templateId: 'notebook', title: 'Course', days: [WEEKDAY],
        time: '08:00', enabled: true, sportId: 'course-a-pied', sessionKind: 'strength',
      }],
    }), FIXED)
    expect(card.sessionKind).toBe('endurance')
    expect(card.openTarget).toBe('endurance')
  })

  it('3b. planifié force invalide → Ouvrir Train + carnet (pas le sport global)', () => {
    const card = deriveTodayHubCard(
      baseState({
        primarySportId: 'football',
        schedule: [
          {
            id: 's1',
            templateId: 'push',
            title: 'Push',
            days: [WEEKDAY],
            time: '18:00',
            enabled: true,
          },
        ],
        routines: [],
      }),
      FIXED,
    )
    expect(card.cta).toBe('open_train')
    expect(card.sportLabel).toBe('Musculation')
    expect(card.openTarget).toBe('notebook')
    expect(launchableRoutineId(card)).toBeNull()
  })

  it('4. routine vide / supprimée → Ouvrir Train, pas Démarrer', () => {
    const empty = deriveTodayHubCard(
      baseState({
        schedule: [
          {
            id: 's1',
            templateId: 'push',
            title: 'Push vide',
            days: [WEEKDAY],
            time: '18:00',
            enabled: true,
          },
        ],
        routines: [
          {
            id: 'push',
            label: 'Push',
            subtitle: '',
            accent: '#f00',
            exercises: [],
            updatedAt: 1,
          },
        ],
      }),
      FIXED,
    )
    expect(empty.cta).toBe('open_train')
    expect(empty.openTarget).toBe('notebook')
    expect(launchableRoutineId(empty)).toBeNull()

    const deleted = deriveTodayHubCard(
      baseState({
        schedule: [
          {
            id: 's1',
            templateId: 'pull',
            title: 'Pull',
            days: [WEEKDAY],
            time: '18:00',
            enabled: true,
          },
        ],
        routines: [],
      }),
      FIXED,
    )
    expect(deleted.cta).toBe('open_train')
    expect(launchableRoutineId(deleted)).toBeNull()
  })

  it('5. aucune séance → Choisir une activité', () => {
    const card = deriveTodayHubCard(baseState(), FIXED)
    expect(card.cta).toBe('choose_activity')
    expect(card.openTarget).toBe('activity')
    expect(launchableRoutineId(card)).toBeNull()
  })
})

describe('findActiveStrengthSession', () => {
  it('ignore routines sans marqueur actif explicite', () => {
    expect(findActiveStrengthSession(baseState())).toBeNull()
  })

  it('reprend uniquement la routine désignée par le marqueur actif', () => {
    const active = findActiveStrengthSession(
      baseState({
        routines: [
          {
            id: 'upper',
            label: 'Upper',
            subtitle: '',
            accent: '#f00',
            exercises: [
              { id: 'a', name: 'Row', sets: [{ reps: 8, weightKg: 50, done: true }] },
            ],
            updatedAt: 100,
          },
          {
            id: 'push',
            label: 'Push',
            subtitle: '',
            accent: '#f00',
            exercises: [
              { id: 'b', name: 'Bench', sets: [{ reps: 8, weightKg: 60, done: true }] },
            ],
            updatedAt: 50,
          },
        ],
        lastSelectedRoutineId: 'push',
        activeWorkoutDraft: {
          routineId: 'push',
          sportId: 'musculation',
          startedAt: 1,
          updatedAt: 50,
        },
      }),
    )
    expect(active?.routineId).toBe('push')
  })

  it('ne transforme pas des marqueurs done legacy en séance active', () => {
    const state = baseState({
      routines: [{
        id: 'push', label: 'Ancienne séance', subtitle: '', accent: '#f00', updatedAt: 1,
        exercises: [{ id: 'e', name: 'Bench', sets: [{ reps: 8, weightKg: 60, done: true }] }],
      }],
      activeWorkoutDraft: null,
    })
    expect(findActiveStrengthSession(state)).toBeNull()
    expect(deriveTodayHubCard(state, FIXED).cta).toBe('choose_activity')
  })

  it('1 exo bench sur routine Biceps → titre Développé couché (pas Biceps)', () => {
    const state = baseState({
      routines: [
        {
          id: 'custom-biceps',
          label: 'Biceps',
          subtitle: '',
          accent: '#f00',
          exercises: [
            {
              id: 'e1',
              name: 'Développé couché',
              canonicalExerciseId: 'bench_press',
              sets: [{ reps: 8, weightKg: 60, done: true }],
            },
          ],
          updatedAt: 10,
        },
      ],
      activeWorkoutDraft: {
        routineId: 'custom-biceps',
        sportId: 'musculation',
        startedAt: 1,
        updatedAt: 10,
      },
    })
    expect(findActiveStrengthSession(state)?.title).toBe('Développé couché')
    const card = deriveTodayHubCard(state, FIXED)
    expect(card.title).toBe('Développé couché')
    expect(card.cta).toBe('resume')
  })
})

describe('deriveWeekStrip — dates locales', () => {
  it('7 jours lun→dim, jour courant identifié, pas de faux progrès', () => {
    const strip = deriveWeekStrip(
      [
        note({ id: '1', title: 'A', dateKey: '2026-09-04' }),
        note({ id: '2', title: 'B', dateKey: '2026-09-01' }),
      ],
      FIXED,
    )
    expect(strip).toHaveLength(7)
    expect(strip[0].shortLabel).toBe('L')
    expect(strip[0].dateKey).toBe('2026-08-31')
    expect(strip[4].dateKey).toBe('2026-09-04')
    expect(strip[4].isToday).toBe(true)
    expect(strip[4].hasSession).toBe(true)
    expect(strip[4].accessibleLabel.toLowerCase()).toContain('vendredi')
    expect(strip[4].accessibleLabel.toLowerCase()).toContain('aujourd')
    expect(strip[1].hasSession).toBe(true) // 2026-09-01
    expect(strip[2].hasSession).toBe(false)
    expect(strip.every((c) => typeof c.hasSession === 'boolean')).toBe(true)
    expect(strip.every((c) => c.accessibleLabel.length > 8)).toBe(true)
  })

  it('changement de jour local → isToday suit now', () => {
    const saturday = new Date('2026-09-05T10:00:00')
    const strip = deriveWeekStrip([], saturday)
    expect(strip.find((c) => c.isToday)?.dateKey).toBe('2026-09-05')
  })
})

describe('deriveWeeklySummary — métriques universelles / sport', () => {
  const weekNotes: WorkoutNote[] = [
    note({
      id: 's1',
      title: 'Push',
      sessionKind: 'strength',
      sportId: 'musculation',
      durationMin: 45,
      dateKey: '2026-09-02',
      createdAt: new Date('2026-09-02T12:00:00').getTime(),
      exercises: [
        {
          id: 'e1',
          name: 'Bench',
          sets: [
            { reps: 8, weightKg: 60 },
            { reps: 8, weightKg: 60 },
          ],
        },
        { id: 'e2', name: 'OHP', sets: [{ reps: 8, weightKg: 40 }] },
      ],
    }),
    note({
      id: 'e1',
      title: 'Course',
      sessionKind: 'endurance',
      sportId: 'course-a-pied',
      durationMin: 30,
      dateKey: '2026-09-03',
      createdAt: new Date('2026-09-03T12:00:00').getTime(),
      exercises: [{ id: 'x', name: '5 km', sets: [{ reps: 30, weightKg: 0 }] }],
      details: { kind: 'endurance', distanceKm: 5 },
    }),
    note({
      id: 't1',
      title: 'Football',
      sessionKind: 'team',
      sportId: 'football',
      durationMin: 90,
      dateKey: '2026-09-04',
      createdAt: FIXED.getTime(),
      exercises: [{ id: 'x', name: 'Football', sets: [{ reps: 90, weightKg: 0 }] }],
      details: { kind: 'team', sessionType: 'match', minutesPlayed: 70, position: 'ailier' },
    }),
  ]

  it('filtre all → séances + temps actif seulement', () => {
    const summary = deriveWeeklySummary(weekNotes, 'all', FIXED)
    expect(summary.sessionCount).toBe(3)
    expect(summary.metrics[0].display).toBe('3')
    // Match : minutesPlayed=70 prioritaire sur durationMin=90 → 45+30+70
    expect(summary.metrics[1].display).toBe('145 min')
  })

  it('filtre musculation → exos/séries + durée', () => {
    const summary = deriveWeeklySummary(weekNotes, 'strength', FIXED)
    expect(summary.metrics[0].display).toBe('2/3')
    expect(summary.metrics[1].display).toBe('45 min')
  })

  it('filtre course → distance + allure agrégée durée totale/distance totale', () => {
    const twoRuns: WorkoutNote[] = [
      note({
        id: 'r1',
        title: 'Course A',
        sessionKind: 'endurance',
        durationMin: 30,
        dateKey: '2026-09-02',
        createdAt: new Date('2026-09-02T12:00:00').getTime(),
        exercises: [{ id: 'x', name: '5 km', sets: [{ reps: 30, weightKg: 0 }] }],
        details: { kind: 'endurance', distanceKm: 5 },
      }),
      note({
        id: 'r2',
        title: 'Course B',
        sessionKind: 'endurance',
        durationMin: 40,
        dateKey: '2026-09-03',
        createdAt: new Date('2026-09-03T12:00:00').getTime(),
        exercises: [{ id: 'x', name: '5 km', sets: [{ reps: 40, weightKg: 0 }] }],
        details: { kind: 'endurance', distanceKm: 5 },
      }),
    ]
    const summary = deriveWeeklySummary(twoRuns, 'endurance', FIXED)
    expect(summary.metrics[0].display).toContain('10')
    // 70 min / 10 km = 7:00 /km — pas moyenne des allures individuelles (6:00 et 8:00)
    expect(summary.metrics[1].display).toBe('7:00 /km')
  })

  it('filtre football → matchs/ent + minutes ; type inconnu = séance', () => {
    const summary = deriveWeeklySummary(weekNotes, 'team', FIXED)
    expect(summary.metrics[0].display.toLowerCase()).toContain('match')
    // minutesPlayed=70 prioritaire pour un match
    expect(summary.metrics[1].display).toBe('70 min')

    const unknown = deriveWeeklySummary(
      [
        note({
          id: 'tu',
          title: 'Collectif',
          sessionKind: 'team',
          durationMin: 45,
          dateKey: '2026-09-04',
          createdAt: FIXED.getTime(),
          exercises: [{ id: 'x', name: 'Team', sets: [{ reps: 45, weightKg: 0 }] }],
          details: { kind: 'team', sessionType: undefined as never },
        }),
      ],
      'team',
      FIXED,
    )
    expect(unknown.metrics[0].display.toLowerCase()).toContain('séance')
  })

  it('non-force sans durationMin → pas de durée fictive dans le résumé', () => {
    const partial: WorkoutNote[] = [
      note({
        id: 'p0',
        title: 'Yoga',
        sessionKind: 'generic',
        durationMin: undefined,
        dateKey: '2026-09-04',
        createdAt: FIXED.getTime(),
        exercises: [{ id: 'x', name: 'Yoga', sets: [{ reps: 40, weightKg: 0 }] }],
      }),
    ]
    const summary = deriveWeeklySummary(partial, 'other', FIXED)
    expect(summary.metrics[1].display).toBe('0 min')
  })

  it('données partielles sans distance → pas de 0 km fictif ni allure inventée', () => {
    const partial: WorkoutNote[] = [
      note({
        id: 'p1',
        title: 'Footing',
        sessionKind: 'endurance',
        durationMin: 25,
        dateKey: '2026-09-04',
        createdAt: FIXED.getTime(),
        exercises: [{ id: 'x', name: 'run', sets: [{ reps: 25, weightKg: 0 }] }],
      }),
    ]
    const summary = deriveWeeklySummary(partial, 'endurance', FIXED)
    expect(summary.metrics[0].display).not.toMatch(/0\s*km/i)
    expect(summary.metrics[1].display).not.toMatch(/\/km/)
    expect(summary.metrics[1].display).toBe('25 min')
  })

  it('historique vide → zéros propres', () => {
    const summary = deriveWeeklySummary([], 'all', FIXED)
    expect(summary.sessionCount).toBe(0)
    expect(summary.metrics[0].display).toBe('0')
    expect(summary.metrics[1].display).toBe('0 min')
  })
})

describe('formatSessionSummary — multisport', () => {
  it('musculation : exos / séries / durée', () => {
    expect(
      formatSessionSummary(
        note({
          id: '1',
          title: 'Push',
          sessionKind: 'strength',
          durationMin: 50,
          exercises: [
            { id: 'a', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }] },
          ],
        }),
      ),
    ).toBe('1 exo · 2 séries · 50 min')
  })

  it('course : durée + distance + allure si calculable', () => {
    expect(
      formatSessionSummary(
        note({
          id: '1',
          title: 'Course',
          sessionKind: 'endurance',
          durationMin: 30,
          details: { kind: 'endurance', distanceKm: 5 },
          exercises: [{ id: 'a', name: '5 km', sets: [{ reps: 30, weightKg: 0 }] }],
        }),
      ),
    ).toBe('30 min · 5 km · 6:00 /km')
  })

  it('course sans distance : pas d’allure inventée', () => {
    expect(
      formatSessionSummary(
        note({
          id: '1',
          title: 'Course',
          sessionKind: 'endurance',
          durationMin: 30,
          exercises: [{ id: 'a', name: 'run', sets: [{ reps: 30, weightKg: 0 }] }],
        }),
      ),
    ).toBe('30 min')
  })

  it('football entraînement vs match — minutesPlayed prioritaire ; poste absent', () => {
    expect(
      formatSessionSummary(
        note({
          id: '1',
          title: 'Football',
          sessionKind: 'team',
          durationMin: 60,
          details: { kind: 'team', sessionType: 'training' },
          exercises: [{ id: 'a', name: 'Football', sets: [{ reps: 60, weightKg: 0 }] }],
        }),
      ),
    ).toBe('Entraînement · 60 min')

    expect(
      formatSessionSummary(
        note({
          id: '2',
          title: 'Football',
          sessionKind: 'team',
          durationMin: 90,
          details: { kind: 'team', sessionType: 'match', minutesPlayed: 70, position: 'ailier' },
          exercises: [{ id: 'a', name: 'Football', sets: [{ reps: 90, weightKg: 0 }] }],
        }),
      ),
    ).toBe('Match · 70 min')
    expect(
      formatSessionSummary(
        note({
          id: '2b',
          title: 'Football',
          sessionKind: 'team',
          durationMin: 90,
          details: { kind: 'team', sessionType: 'match', position: 'ailier' },
          exercises: [{ id: 'a', name: 'Football', sets: [{ reps: 90, weightKg: 0 }] }],
        }),
      ),
    ).toBe('Match · 90 min')
    expect(
      formatSessionSummary(
        note({
          id: '2c',
          title: 'Football',
          sessionKind: 'team',
          durationMin: 90,
          details: { kind: 'team', sessionType: 'match', minutesPlayed: 70, position: 'ailier' },
          exercises: [{ id: 'a', name: 'Football', sets: [{ reps: 90, weightKg: 0 }] }],
        }),
      ),
    ).not.toContain('ailier')
    expect(
      hubActiveMinutes(
        note({
          id: '2d',
          title: 'Football',
          sessionKind: 'team',
          durationMin: 90,
          details: { kind: 'team', sessionType: 'match', minutesPlayed: 70 },
          exercises: [{ id: 'a', name: 'Football', sets: [{ reps: 90, weightKg: 0 }] }],
        }),
      ),
    ).toBe(70)
  })

  it('football type inconnu → Séance (pas entraînement inventé)', () => {
    expect(
      formatSessionSummary(
        note({
          id: '3',
          title: 'Collectif',
          sessionKind: 'team',
          durationMin: 40,
          details: { kind: 'team' } as never,
          exercises: [{ id: 'a', name: 'Team', sets: [{ reps: 40, weightKg: 0 }] }],
        }),
      ),
    ).toBe('Séance · 40 min')
  })

  it('autre sport : effort easy/hard explicite ; difficulty ok auto omis', () => {
    expect(
      formatSessionSummary(
        note({
          id: '1',
          title: 'Yoga',
          sessionKind: 'generic',
          sportId: 'yoga',
          durationMin: 40,
          exercises: [
            { id: 'a', name: 'Yoga', sets: [{ reps: 40, weightKg: 0, difficulty: 'easy' }] },
          ],
        }),
      ),
    ).toBe('Yoga · 40 min · Effort facile')

    expect(
      formatSessionSummary(
        note({
          id: '2',
          title: 'Yoga',
          sessionKind: 'generic',
          sportId: 'yoga',
          durationMin: 40,
          exercises: [
            { id: 'a', name: 'Yoga', sets: [{ reps: 40, weightKg: 0, difficulty: 'ok' }] },
          ],
        }),
      ),
    ).toBe('Yoga · 40 min')

    expect(
      formatSessionSummary(
        note({
          id: '3',
          title: 'Boxe',
          sessionKind: 'generic',
          durationMin: 45,
          exercises: [
            { id: 'a', name: 'Boxe', sets: [{ reps: 45, weightKg: 0, difficulty: 'hard' }] },
          ],
        }),
      ),
    ).toContain('Effort dur')
  })

  it('allure : arrondi en secondes totales → plage 00–59', () => {
    // Ancien bug : round(frac) isolé pouvait produire :60
    expect(formatPaceDisplay(59.7)).toBe('1:00 /km')
    expect(formatPaceDisplay(359.6)).toBe('6:00 /km')
    expect(formatPaceDisplay(360)).toBe('6:00 /km')
    expect(formatPaceDisplay(125.4)).toBe('2:05 /km')
  })
})

describe('deriveRecentSessions', () => {
  it('max 2 séances ; vide → []', () => {
    expect(deriveRecentSessions([], FIXED)).toEqual([])
    const items = deriveRecentSessions(
      [
        note({ id: '1', title: 'A', createdAt: 3, dateKey: '2026-09-04', routineId: 'a' }),
        note({ id: '2', title: 'B', createdAt: 2, dateKey: '2026-09-03', routineId: 'b' }),
        note({ id: '3', title: 'C', createdAt: 1, dateKey: '2026-09-02', routineId: 'c' }),
      ],
      FIXED,
      2,
    )
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('Bench')
  })

  it('déduplique les doublons proches même si IDs distincts (sync)', () => {
    const items = deriveRecentSessions(
      [
        note({
          id: 'dup-a',
          title: 'A',
          createdAt: 1000,
          dateKey: '2026-09-04',
          routineId: 'push',
          exercises: [{ id: 'e', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] }],
        }),
        note({
          id: 'dup-b',
          title: 'B',
          createdAt: 1500,
          dateKey: '2026-09-04',
          routineId: 'push',
          exercises: [{ id: 'e', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] }],
        }),
      ],
      FIXED,
      5,
    )
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('dup-b')
  })

  it('conserve deux séances réelles éloignées (>2 min) même jour/focus', () => {
    const items = deriveRecentSessions(
      [
        note({
          id: 'a',
          title: 'A',
          createdAt: 1_000_000,
          dateKey: '2026-09-04',
          routineId: 'push',
          exercises: [{ id: 'e', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] }],
        }),
        note({
          id: 'b',
          title: 'B',
          createdAt: 1_000_000 + 180_000,
          dateKey: '2026-09-04',
          routineId: 'push',
          exercises: [{ id: 'e', name: 'Bench', sets: [{ reps: 8, weightKg: 60 }] }],
        }),
      ],
      FIXED,
      5,
    )
    expect(items).toHaveLength(2)
  })
})
