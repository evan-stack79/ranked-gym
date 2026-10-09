import { describe, expect, it } from 'vitest'
import { resolveTrainStartSessionAction } from './trainStartSession'

describe('resolveTrainStartSessionAction', () => {
  it('resumes an active draft — same as ▶', () => {
    expect(resolveTrainStartSessionAction(true)).toBe('resume-draft')
  })

  it('opens the activity sheet when there is no draft — same as ▶', () => {
    expect(resolveTrainStartSessionAction(false)).toBe('open-activity-sheet')
  })
})
