import type { Sport, SportCategory } from '../types/training'

export const SPORT_CATEGORY_LABELS: Record<SportCategory, string> = {
  popular: 'Populaires',
  strength: 'Force & musculation',
  cardio: 'Cardio',
  team: 'Sports collectifs',
  racket: 'Raquettes',
  combat: 'Combat',
  outdoor: 'Outdoor',
  water: 'Aquatique',
  other: 'Autres',
}

/** Popular first (high popularity), then a wide catalog for France / world. */
export const SPORTS: Sport[] = [
  // —— Les plus connus ——
  { id: 'musculation', name: 'Musculation', category: 'strength', popularity: 100, kcalPerHour: 400 },
  { id: 'course-a-pied', name: 'Course à pied', category: 'cardio', popularity: 99, tracksSteps: true, kcalPerHour: 650 },
  { id: 'marche', name: 'Marche / randonnée', category: 'cardio', popularity: 98, tracksSteps: true, kcalPerHour: 280 },
  { id: 'velo', name: 'Vélo', category: 'cardio', popularity: 97, kcalPerHour: 500 },
  { id: 'football', name: 'Football', category: 'team', popularity: 96, tracksSteps: true, kcalPerHour: 550 },
  { id: 'basketball', name: 'Basketball', category: 'team', popularity: 95, tracksSteps: true, kcalPerHour: 580 },
  { id: 'tennis', name: 'Tennis', category: 'racket', popularity: 94, kcalPerHour: 520 },
  { id: 'natation', name: 'Natation', category: 'water', popularity: 93, kcalPerHour: 600 },
  { id: 'crossfit', name: 'CrossFit / HIIT', category: 'strength', popularity: 92, kcalPerHour: 700 },
  { id: 'cardio-salle', name: 'Cardio (salle)', category: 'cardio', popularity: 91, kcalPerHour: 450 },
  { id: 'rugby', name: 'Rugby', category: 'team', popularity: 90, tracksSteps: true, kcalPerHour: 650 },
  { id: 'handball', name: 'Handball', category: 'team', popularity: 89, tracksSteps: true, kcalPerHour: 600 },
  { id: 'boxe', name: 'Boxe', category: 'combat', popularity: 88, kcalPerHour: 700 },
  { id: 'yoga', name: 'Yoga', category: 'other', popularity: 87, kcalPerHour: 220 },
  { id: 'pilates', name: 'Pilates', category: 'other', popularity: 86, kcalPerHour: 240 },
  { id: 'trail', name: 'Trail', category: 'outdoor', popularity: 85, tracksSteps: true, kcalPerHour: 700 },
  { id: 'escalade', name: 'Escalade', category: 'outdoor', popularity: 84, kcalPerHour: 550 },
  { id: 'badminton', name: 'Badminton', category: 'racket', popularity: 83, kcalPerHour: 480 },
  { id: 'padel', name: 'Padel', category: 'racket', popularity: 82, kcalPerHour: 500 },
  { id: 'volleyball', name: 'Volleyball', category: 'team', popularity: 81, kcalPerHour: 450 },

  // —— Force ——
  { id: 'powerlifting', name: 'Powerlifting', category: 'strength', popularity: 70, kcalPerHour: 350 },
  { id: 'halterophilie', name: 'Haltérophilie', category: 'strength', popularity: 68, kcalPerHour: 420 },
  { id: 'calisthenics', name: 'Street workout / callisthénie', category: 'strength', popularity: 72, kcalPerHour: 450 },
  { id: 'functional', name: 'Functional training', category: 'strength', popularity: 65, kcalPerHour: 480 },
  { id: 'bodybuilding', name: 'Culturisme', category: 'strength', popularity: 66, kcalPerHour: 380 },

  // —— Cardio ——
  { id: 'elliptique', name: 'Elliptique', category: 'cardio', popularity: 60, kcalPerHour: 500 },
  { id: 'rameur', name: 'Rameur', category: 'cardio', popularity: 62, kcalPerHour: 550 },
  { id: 'stairmaster', name: 'Stepper / StairMaster', category: 'cardio', popularity: 55, tracksSteps: true, kcalPerHour: 520 },
  { id: 'spinning', name: 'Spinning / RPM', category: 'cardio', popularity: 64, kcalPerHour: 580 },
  { id: 'danse', name: 'Danse', category: 'cardio', popularity: 70, tracksSteps: true, kcalPerHour: 400 },
  { id: 'zumba', name: 'Zumba', category: 'cardio', popularity: 58, kcalPerHour: 450 },
  { id: 'corde-a-sauter', name: 'Corde à sauter', category: 'cardio', popularity: 57, kcalPerHour: 650 },
  { id: 'roller', name: 'Roller / skate', category: 'cardio', popularity: 50, kcalPerHour: 420 },

  // —— Collectifs ——
  { id: 'futsal', name: 'Futsal', category: 'team', popularity: 74, tracksSteps: true, kcalPerHour: 580 },
  { id: 'hockey', name: 'Hockey', category: 'team', popularity: 48, kcalPerHour: 550 },
  { id: 'baseball', name: 'Baseball / softball', category: 'team', popularity: 40, kcalPerHour: 350 },
  { id: 'cricket', name: 'Cricket', category: 'team', popularity: 35, kcalPerHour: 320 },
  { id: 'american-football', name: 'Football américain', category: 'team', popularity: 45, kcalPerHour: 600 },
  { id: 'netball', name: 'Netball', category: 'team', popularity: 30, kcalPerHour: 450 },
  { id: 'ultimate', name: 'Ultimate frisbee', category: 'team', popularity: 42, tracksSteps: true, kcalPerHour: 500 },

  // —— Raquettes ——
  { id: 'squash', name: 'Squash', category: 'racket', popularity: 55, kcalPerHour: 650 },
  { id: 'ping-pong', name: 'Tennis de table', category: 'racket', popularity: 60, kcalPerHour: 280 },
  { id: 'pickleball', name: 'Pickleball', category: 'racket', popularity: 38, kcalPerHour: 350 },
  { id: 'pelote', name: 'Pelote basque', category: 'racket', popularity: 28, kcalPerHour: 450 },

  // —— Combat ——
  { id: 'judo', name: 'Judo', category: 'combat', popularity: 72, kcalPerHour: 550 },
  { id: 'jiujitsu', name: 'Jiu-jitsu / BJJ', category: 'combat', popularity: 68, kcalPerHour: 580 },
  { id: 'karate', name: 'Karaté', category: 'combat', popularity: 65, kcalPerHour: 500 },
  { id: ' taekwondo', name: 'Taekwondo', category: 'combat', popularity: 55, kcalPerHour: 520 },
  { id: 'mma', name: 'MMA', category: 'combat', popularity: 70, kcalPerHour: 720 },
  { id: 'kickboxing', name: 'Kickboxing / Muay Thai', category: 'combat', popularity: 66, kcalPerHour: 700 },
  { id: 'lutte', name: 'Lutte', category: 'combat', popularity: 45, kcalPerHour: 600 },
  { id: 'escrime', name: 'Escrime', category: 'combat', popularity: 40, kcalPerHour: 400 },
  { id: 'krav-maga', name: 'Krav maga', category: 'combat', popularity: 50, kcalPerHour: 550 },

  // —— Outdoor ——
  { id: 'ski', name: 'Ski alpin', category: 'outdoor', popularity: 70, kcalPerHour: 450 },
  { id: 'ski-fond', name: 'Ski de fond', category: 'outdoor', popularity: 55, kcalPerHour: 650 },
  { id: 'snowboard', name: 'Snowboard', category: 'outdoor', popularity: 58, kcalPerHour: 420 },
  { id: 'vtt', name: 'VTT', category: 'outdoor', popularity: 68, kcalPerHour: 550 },
  { id: 'golf', name: 'Golf', category: 'outdoor', popularity: 60, tracksSteps: true, kcalPerHour: 280 },
  { id: 'equitation', name: 'Équitation', category: 'outdoor', popularity: 52, kcalPerHour: 350 },
  { id: 'parkour', name: 'Parkour', category: 'outdoor', popularity: 48, tracksSteps: true, kcalPerHour: 600 },
  { id: 'orientation', name: 'Course d’orientation', category: 'outdoor', popularity: 35, tracksSteps: true, kcalPerHour: 500 },
  { id: 'athletisme', name: 'Athlétisme', category: 'outdoor', popularity: 62, tracksSteps: true, kcalPerHour: 550 },

  // —— Eau ——
  { id: 'surf', name: 'Surf', category: 'water', popularity: 58, kcalPerHour: 400 },
  { id: 'paddle', name: 'Paddle / SUP', category: 'water', popularity: 50, kcalPerHour: 350 },
  { id: 'kayak', name: 'Kayak / canoë', category: 'water', popularity: 48, kcalPerHour: 400 },
  { id: 'aviron', name: 'Aviron', category: 'water', popularity: 45, kcalPerHour: 550 },
  { id: 'waterpolo', name: 'Water-polo', category: 'water', popularity: 40, kcalPerHour: 650 },
  { id: 'plongee', name: 'Plongée', category: 'water', popularity: 42, kcalPerHour: 300 },
  { id: 'triathlon', name: 'Triathlon', category: 'water', popularity: 55, tracksSteps: true, kcalPerHour: 700 },

  // —— Autres ——
  { id: 'fitness', name: 'Fitness / cours collectifs', category: 'other', popularity: 75, kcalPerHour: 420 },
  { id: 'stretching', name: 'Stretching / mobilité', category: 'other', popularity: 50, kcalPerHour: 150 },
  { id: 'meditation-marche', name: 'Marche consciente', category: 'other', popularity: 40, tracksSteps: true, kcalPerHour: 180 },
  { id: 'patinage', name: 'Patinage artistique', category: 'other', popularity: 38, kcalPerHour: 450 },
  { id: 'gymnastique', name: 'Gymnastique', category: 'other', popularity: 45, kcalPerHour: 480 },
  { id: 'cirque', name: 'Arts du cirque', category: 'other', popularity: 32, kcalPerHour: 400 },
  { id: 'cheerleading', name: 'Cheerleading', category: 'other', popularity: 30, kcalPerHour: 420 },
  { id: 'bowling', name: 'Bowling', category: 'other', popularity: 28, kcalPerHour: 200 },
  { id: 'petanque', name: 'Pétanque', category: 'other', popularity: 35, kcalPerHour: 150 },
  { id: 'esport-actif', name: 'Exergaming / VR fitness', category: 'other', popularity: 34, kcalPerHour: 300 },
]

export function getSportById(id: string): Sport | undefined {
  return SPORTS.find((s) => s.id === id)
}

export function searchSports(query: string): Sport[] {
  const q = query.trim().toLowerCase()
  const list = [...SPORTS].sort((a, b) => b.popularity - a.popularity)
  if (!q) return list
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      SPORT_CATEGORY_LABELS[s.category].toLowerCase().includes(q),
  )
}
