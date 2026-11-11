import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
})

vi.mock('./cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

describe('sleep alarm status copy', () => {
  it('uses exact confirmation wording', async () => {
    const { formatAlarmScheduledMessage, syncFailureMessage } = await import(
      './sleepAlarmService'
    )
    expect(formatAlarmScheduledMessage('21:00')).toBe('Réveil prévu à 21:00')
    expect(formatAlarmScheduledMessage('07:05')).toMatch(/^Réveil prévu à /)
    expect(syncFailureMessage('PERMISSION_DENIED')).toBe(
      'Autorise les alarmes pour Ranked Gym dans Réglages',
    )
  })
})
