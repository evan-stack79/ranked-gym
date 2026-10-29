import { describe, expect, it, vi } from 'vitest'
import {
  SURVEILLANCE_FITNESS_CHURN_DAYS,
  SURVEILLANCE_FITNESS_WEBHOOK_KEY_ENV,
  SURVEILLANCE_FITNESS_WEBHOOK_URL_ENV,
  buildSurveillanceFitnessWebhookBody,
  daysSince,
  postSurveillanceFitnessWebhook,
  readSurveillanceFitnessWebhookConfig,
  toIsoUtcZ,
  type SurveillanceFitnessWebhookPayload,
} from '../../convex/lib/surveillanceFitnessWebhook'

const samplePayload: SurveillanceFitnessWebhookPayload = {
  type: 'test',
  email: 'athlete@example.com',
  last_active_days: 0,
  action_count: 1,
  plan: 'unknown',
  occurred_at: '2026-10-29T12:00:00.000Z',
  user_id: 'user-abc',
}

describe('surveillanceFitnessWebhook helper', () => {
  it('expose le seuil churn documenté (14 jours)', () => {
    expect(SURVEILLANCE_FITNESS_CHURN_DAYS).toBe(14)
  })

  it('produit un JSON avec les clés minimum + user_id optionnel', () => {
    const body = buildSurveillanceFitnessWebhookBody(samplePayload)
    expect(JSON.parse(body)).toEqual({
      type: 'test',
      email: 'athlete@example.com',
      last_active_days: 0,
      action_count: 1,
      plan: 'unknown',
      occurred_at: '2026-10-29T12:00:00.000Z',
      user_id: 'user-abc',
    })

    const withoutUser = buildSurveillanceFitnessWebhookBody({
      ...samplePayload,
      user_id: undefined,
    })
    expect(JSON.parse(withoutUser)).not.toHaveProperty('user_id')
  })

  it('lit la config env sans exposer de secret en dur', () => {
    const env: Record<string, string | undefined> = {
      [SURVEILLANCE_FITNESS_WEBHOOK_URL_ENV]: ' https://hooks.example/sf ',
      [SURVEILLANCE_FITNESS_WEBHOOK_KEY_ENV]: ' secret-key ',
    }
    expect(readSurveillanceFitnessWebhookConfig((name) => env[name])).toEqual({
      url: 'https://hooks.example/sf',
      key: 'secret-key',
    })
    expect(readSurveillanceFitnessWebhookConfig(() => undefined)).toEqual({
      url: null,
      key: null,
    })
  })

  it('soft-skip si env absente (pas de fetch)', async () => {
    const fetchImpl = vi.fn()
    const result = await postSurveillanceFitnessWebhook(samplePayload, {
      fetchImpl,
      envReader: () => undefined,
    })
    expect(result).toEqual({ ok: false, configured: false })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('POST Bearer + JSON quand env posée (mock fetch, sans réseau)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const env: Record<string, string | undefined> = {
      [SURVEILLANCE_FITNESS_WEBHOOK_URL_ENV]: 'https://hooks.example/sf',
      [SURVEILLANCE_FITNESS_WEBHOOK_KEY_ENV]: 'key-test',
    }
    const result = await postSurveillanceFitnessWebhook(samplePayload, {
      fetchImpl,
      envReader: (name) => env[name],
    })
    expect(result).toEqual({ ok: true, configured: true, status: 200 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith('https://hooks.example/sf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer key-test',
      },
      body: buildSurveillanceFitnessWebhookBody(samplePayload),
    })
  })

  it('retourne configured:true + error si fetch jette', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    const env: Record<string, string | undefined> = {
      [SURVEILLANCE_FITNESS_WEBHOOK_URL_ENV]: 'https://hooks.example/sf',
      [SURVEILLANCE_FITNESS_WEBHOOK_KEY_ENV]: 'key-test',
    }
    const result = await postSurveillanceFitnessWebhook(samplePayload, {
      fetchImpl,
      envReader: (name) => env[name],
    })
    expect(result.configured).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('network down')
  })

  it('daysSince / toIsoUtcZ utilitaires', () => {
    const day = 24 * 60 * 60 * 1000
    expect(daysSince(0, 3 * day)).toBe(3)
    expect(daysSince(1000, 500)).toBe(0)
    expect(toIsoUtcZ(0)).toBe('1970-01-01T00:00:00.000Z')
  })
})
