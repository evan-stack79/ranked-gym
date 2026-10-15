import { describe, expect, it } from 'vitest'
import {
  formatAppVersionLabel,
  formatParisBuildStamp,
  getAppBuildId,
  getAppBuildTimeIso,
  pickShortCommitSha,
} from './appBuildId'

describe('appBuildId', () => {
  it('préfère WORKERS_CI_COMMIT_SHA (Workers Builds) puis Pages / GitHub', () => {
    expect(
      pickShortCommitSha({
        WORKERS_CI_COMMIT_SHA: '840af178cbed32b463588c41445ae7e534e52831',
        CF_PAGES_COMMIT_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).toBe('840af17')

    expect(
      pickShortCommitSha({
        CF_PAGES_COMMIT_SHA: '9e38059abcdef0123456789',
      }),
    ).toBe('9e38059')

    expect(pickShortCommitSha({ GITHUB_SHA: 'deadbeefcafe' })).toBe('deadbee')
    expect(pickShortCommitSha({})).toBeNull()
    expect(pickShortCommitSha({ WORKERS_CI_COMMIT_SHA: '   ' })).toBeNull()
  })

  it('formate la date/heure en Europe/Paris (YYYY-MM-DD HH:mm)', () => {
    // 2026-10-05 22:05 UTC = 2026-10-06 00:05 Europe/Paris (CEST, UTC+2)
    expect(formatParisBuildStamp('2026-10-05T22:05:00.000Z')).toBe('2026-10-06 00:05')
  })

  it('libellé prod : Version <Paris> · <short SHA>', () => {
    expect(formatAppVersionLabel('840af17', '2026-10-05T22:05:00.000Z')).toBe(
      'Version 2026-10-06 00:05 · 840af17',
    )
  })

  it('libellé local : Version <Paris> · local (jamais local-YYYY-MM-DD)', () => {
    const label = formatAppVersionLabel('local', '2026-10-05T10:00:00.000Z')
    expect(label).toMatch(/^Version \d{4}-\d{2}-\d{2} \d{2}:\d{2} · local$/)
    expect(label).not.toContain('local-')
    expect(label).not.toContain('RPE')
    expect(label).not.toContain('SHA')
    expect(label).not.toContain('service worker')
  })

  it('utilise les valeurs injectées (vitest = test + time fixe)', () => {
    expect(getAppBuildId('c809daa')).toBe('c809daa')
    expect(getAppBuildId('')).toBe('dev')
    expect(getAppBuildId('   ')).toBe('dev')
    expect(getAppBuildId()).toBe('test')
    expect(getAppBuildTimeIso()).toBe('2026-10-06T00:05:00.000Z')
    expect(formatAppVersionLabel()).toBe('Version 2026-10-06 02:05 · test')
  })
})
