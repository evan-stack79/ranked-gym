import { readFileSync, existsSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SLEEP_ALARM_SOUND_FILE } from '../../services/sleepAlarmStorage'

describe('AlarmKit roar sound contract', () => {
  it('JS passes the exact .caf bundle name to AlarmKit', () => {
    expect(SLEEP_ALARM_SOUND_FILE).toBe('RugissementRankedGym.caf')
  })

  it('source caf exists and is listed in App Copy Bundle Resources', () => {
    const caf = 'ios/App/App/Sounds/RugissementRankedGym.caf'
    expect(existsSync(caf)).toBe(true)
    expect(statSync(caf).size).toBeGreaterThan(1000)
    const pbx = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8')
    expect(pbx).toMatch(/RugissementRankedGym\.caf in Resources/)
    expect(pbx).toMatch(/RankedAlarmStopIntent\.swift in Sources/)
  })
})
