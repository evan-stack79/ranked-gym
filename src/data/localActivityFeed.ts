export interface LocalActivityItem {
  id: string
  user: string
  action: string
  xp: string
  time: string
  isPr: boolean
  hot: boolean
}

export function buildLocalActivityFeed(areaName: string): LocalActivityItem[] {
  const zone = areaName.trim() || 'ta zone'
  return [
    {
      id: '1',
      user: 'IronMike',
      action: `a battu son PR développé couché · ${zone}`,
      xp: '+250 XP',
      time: '2 min',
      isPr: true,
      hot: true,
    },
    {
      id: '2',
      user: 'FlexQueen',
      action: 'a monté en rang Diamant',
      xp: '+500 XP',
      time: '15 min',
      isPr: false,
      hot: false,
    },
    {
      id: '3',
      user: 'PaceRunner',
      action: `a fini un 10 km sous 45 min près de ${zone}`,
      xp: '+180 XP',
      time: '32 min',
      isPr: true,
      hot: true,
    },
    {
      id: '4',
      user: 'BeastMode92',
      action: 'a enchaîné 7 jours de feu',
      xp: '+120 XP',
      time: '1 h',
      isPr: false,
      hot: true,
    },
  ]
}
