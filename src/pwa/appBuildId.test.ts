import { describe, expect, it } from 'vitest'
import { formatAppVersionLabel, getAppBuildId } from './appBuildId'

describe('appBuildId', () => {
  it('utilise la valeur injectée', () => {
    expect(getAppBuildId('c809daa')).toBe('c809daa')
    expect(formatAppVersionLabel('c809daa')).toBe('Version c809daa')
  })

  it('retombe sur dev si vide', () => {
    expect(getAppBuildId('')).toBe('dev')
    expect(getAppBuildId('   ')).toBe('dev')
    expect(getAppBuildId(undefined)).toBe('dev')
  })

  it('libelle simple sans jargon', () => {
    const label = formatAppVersionLabel('abc1234')
    expect(label).toContain('Version')
    expect(label).not.toContain('RPE')
    expect(label).not.toContain('SHA')
    expect(label).not.toContain('service worker')
  })
})
