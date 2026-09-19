import { describe, expect, it } from 'vitest'
import {
  buildSessionId,
  parseLiveActivityDeepLink,
  sanitizeLiveActivityPayload,
  LiveActivityWeb,
} from './index'

describe('liveActivity bridge', () => {
  it('buildSessionId is stable from draft fields', () => {
    expect(buildSessionId('custom-biceps', 1_700_000_000_000)).toBe(
      'custom-biceps:1700000000000',
    )
  })

  it('sanitize rejects empty exercise / session', () => {
    expect(
      sanitizeLiveActivityPayload({
        sessionId: '',
        exerciseName: 'Curl',
        setCurrent: 1,
        setTotal: 4,
        restTotalSec: 90,
        paused: false,
        pausedRemainingSec: 90,
        sessionProgress: 0,
      }),
    ).toBeNull()
    expect(
      sanitizeLiveActivityPayload({
        sessionId: 'r:1',
        exerciseName: '  ',
        setCurrent: 1,
        setTotal: 4,
        restTotalSec: 90,
        paused: false,
        pausedRemainingSec: 90,
        sessionProgress: 0,
      }),
    ).toBeNull()
  })

  it('sanitize keeps real exercise name and endDate ms', () => {
    const ends = Date.now() + 90_000
    const clean = sanitizeLiveActivityPayload({
      sessionId: 'custom-biceps:100',
      exerciseName: 'Curl barre',
      setCurrent: 2,
      setTotal: 4,
      restEndsAtMs: ends,
      restTotalSec: 90,
      paused: false,
      pausedRemainingSec: 90,
      sessionProgress: 0.25,
    })
    expect(clean).toMatchObject({
      exerciseName: 'Curl barre',
      setCurrent: 2,
      setTotal: 4,
      restEndsAtMs: ends,
      paused: false,
    })
  })

  it('sanitize clears endDate when paused', () => {
    const clean = sanitizeLiveActivityPayload({
      sessionId: 'r:1',
      exerciseName: 'Squat',
      setCurrent: 1,
      setTotal: 3,
      restEndsAtMs: Date.now() + 30_000,
      restTotalSec: 60,
      paused: true,
      pausedRemainingSec: 33,
      sessionProgress: 0,
    })
    expect(clean?.restEndsAtMs).toBeNull()
    expect(clean?.pausedRemainingSec).toBe(33)
  })

  it('web stub is available:false no-op', async () => {
    const web = new LiveActivityWeb()
    const avail = await web.isAvailable()
    expect(avail.available).toBe(false)
    expect(avail.authorized).toBe(false)
    const started = await web.start({
      sessionId: 'r:1',
      exerciseName: 'Curl',
      setCurrent: 1,
      setTotal: 4,
      restTotalSec: 90,
      paused: false,
      pausedRemainingSec: 90,
      sessionProgress: 0,
    })
    expect(started.started).toBe(false)
    await expect(web.update({
      sessionId: 'r:1',
      exerciseName: 'Curl',
      setCurrent: 1,
      setTotal: 4,
      restTotalSec: 90,
      paused: false,
      pausedRemainingSec: 90,
      sessionProgress: 0,
    })).resolves.toBeUndefined()
    await expect(web.end()).resolves.toBeUndefined()
    expect((await web.pendingNativeActions()).actions).toEqual([])
  })

  it('parses session deep link', () => {
    expect(
      parseLiveActivityDeepLink('rankedgym://session/active?sessionId=r%3A1'),
    ).toEqual({ kind: 'session', sessionId: 'r:1' })
  })

  it('parses adjust / pause deep links', () => {
    expect(
      parseLiveActivityDeepLink(
        'rankedgym://live-activity?action=adjust&delta=-15&sessionId=r:1&token=t1',
      ),
    ).toEqual({
      kind: 'action',
      action: 'adjust',
      sessionId: 'r:1',
      deltaSec: -15,
      token: 't1',
    })
    expect(
      parseLiveActivityDeepLink(
        'rankedgym://live-activity?action=pause&sessionId=r:1&token=t2',
      ),
    ).toMatchObject({ kind: 'action', action: 'pause', sessionId: 'r:1' })
  })

  it('rejects foreign schemes', () => {
    expect(parseLiveActivityDeepLink('https://rankedgym.app/session')).toBeNull()
  })
})
