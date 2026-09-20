export type BootIssueKind = 'recoverable' | 'blocking'

export function classifyHydrateFailure(input: {
  hasProfile: boolean
  hasLocalCache: boolean
}): BootIssueKind {
  if (input.hasProfile || input.hasLocalCache) return 'recoverable'
  return 'blocking'
}
