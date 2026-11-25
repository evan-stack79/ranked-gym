import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HV_FEATURE_NAME, HV_FEATURE_TITLE } from './constants'
import { HV_LEGACY_NAME, containsForbiddenHvCopy } from './phrases'

const ROOT = join(import.meta.dirname, '../..')

describe('HV rename contract', () => {
  it('feature name is Emploi du temps variable; titles use Mon planning', () => {
    expect(HV_FEATURE_NAME).toBe('Emploi du temps variable')
    expect(HV_FEATURE_TITLE).toBe('Mon planning')
    expect(containsForbiddenHvCopy(HV_LEGACY_NAME)).toBe(true)
  })

  it('SleepAlarmSheet + SleepView use titles, not legacy', () => {
    const alarm = readFileSync(
      join(ROOT, 'src/components/home/SleepAlarmSheet.tsx'),
      'utf8',
    )
    const sleep = readFileSync(join(ROOT, 'src/components/home/SleepView.tsx'), 'utf8')
    expect(alarm).toContain('HV_FEATURE_TITLE')
    expect(sleep).toContain('HV_FEATURE_TITLE')
    expect(sleep).toContain('HV_FEATURE_NAME')
    expect(alarm).not.toContain('Horaires qui changent')
    expect(sleep).not.toContain('Horaires qui changent')
  })
})
