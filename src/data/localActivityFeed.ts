export interface LocalActivityItem {
  id: string
  user: string
  /** Action sans mention de lieu (base). */
  action: string
  /** L'activité référence-t-elle un lieu ? */
  hasLocation: boolean
  /** Style de suffixe lieu quand hasLocation && !ghost */
  locationStyle?: 'near' | 'zone'
  isGhostModeEnabled: boolean
  xp: string
  time: string
  isPr: boolean
  hot: boolean
}

export function buildLocalActivityFeed(areaName: string): LocalActivityItem[] {
  void areaName
  return [
    {
      id: '1',
      user: 'IronMike',
      action: 'a battu son PR développé couché',
      hasLocation: true,
      locationStyle: 'zone',
      isGhostModeEnabled: false,
      xp: '+250 XP',
      time: '2 min',
      isPr: true,
      hot: true,
    },
    {
      id: '2',
      user: 'FlexQueen',
      action: 'a monté en rang Diamant',
      hasLocation: false,
      isGhostModeEnabled: false,
      xp: '+500 XP',
      time: '15 min',
      isPr: false,
      hot: false,
    },
    {
      id: '3',
      user: 'PaceRunner',
      action: 'a fini un 10 km sous 45 min',
      hasLocation: true,
      locationStyle: 'near',
      isGhostModeEnabled: true,
      xp: '+180 XP',
      time: '32 min',
      isPr: true,
      hot: true,
    },
    {
      id: '4',
      user: 'BeastMode92',
      action: 'a enchaîné 7 jours de feu',
      hasLocation: false,
      isGhostModeEnabled: false,
      xp: '+120 XP',
      time: '1 h',
      isPr: false,
      hot: true,
    },
  ]
}
