import { readFileSync, existsSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  SLEEP_ALARM_SOUND_FILE,
  SLEEP_ALARM_SOUND_LABEL,
} from '../../services/sleepAlarmStorage'

describe('AlarmKit Petits oiseaux sound contract', () => {
  it('JS passes the exact .caf bundle name to AlarmKit', () => {
    expect(SLEEP_ALARM_SOUND_FILE).toBe('PetitsOiseaux.caf')
    expect(SLEEP_ALARM_SOUND_LABEL).toBe('Petits oiseaux')
  })

  it('source caf is PCM, bundled, and listed in Copy Bundle Resources', () => {
    const caf = 'ios/App/App/Sounds/PetitsOiseaux.caf'
    expect(existsSync(caf)).toBe(true)
    expect(statSync(caf).size).toBeGreaterThan(1000)
    expect(existsSync('ios/App/App/Sounds/PetitsOiseaux.wav')).toBe(false)

    const probe = spawnSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=codec_name',
        '-of',
        'default=nw=1:nk=1',
        caf,
      ],
      { encoding: 'utf8' },
    )
    if (probe.status === 0) {
      expect(probe.stdout.trim()).toBe('pcm_s16le')
    }

    const pbx = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8')
    expect(pbx).toMatch(/PetitsOiseaux\.caf in Resources/)
    expect(pbx).not.toMatch(/PetitsOiseaux\.wav/)
    expect(pbx).toMatch(/RankedAlarmStopIntent\.swift in Sources/)
  })
})
