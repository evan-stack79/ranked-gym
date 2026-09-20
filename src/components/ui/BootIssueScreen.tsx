import {
  USER_BLOCKING_LOAD_BODY,
  USER_BLOCKING_LOAD_TITLE,
  USER_RECOVERABLE_LOAD_BODY,
  USER_RETRY_LABEL,
} from '../../boot/bootUiCopy'
import type { BootIssueKind } from '../../boot/bootStatus'

export function BootIssueScreen({
  kind,
  onRetry,
}: {
  kind: BootIssueKind
  onRetry: () => void
}) {
  const title = kind === 'blocking' ? USER_BLOCKING_LOAD_TITLE : 'Mise à jour impossible'
  const body = kind === 'blocking' ? USER_BLOCKING_LOAD_BODY : USER_RECOVERABLE_LOAD_BODY

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-2 text-center" data-boot-issue={kind}>
      <p className="text-[22px] font-bold tracking-tight text-white">{title}</p>
      <p className="max-w-sm text-[15px] leading-relaxed text-[#8E8E93]">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn-brand ios-press mt-2 min-h-11 rounded-2xl border border-white/15 px-5 py-2.5 text-[15px] font-semibold text-white"
      >
        {USER_RETRY_LABEL}
      </button>
    </div>
  )
}

export function RecoverableRetryBar({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1C1C1E]/80 px-3.5 py-2.5"
      role="status"
      data-boot-retry-bar="1"
    >
      <p className="min-w-0 text-[13px] leading-snug text-[#AEAEB2]">{USER_RECOVERABLE_LOAD_BODY}</p>
      <button
        type="button"
        onClick={onRetry}
        className="ios-press shrink-0 rounded-xl border border-white/15 bg-white/8 px-3 py-1.5 text-[13px] font-semibold text-white"
      >
        {USER_RETRY_LABEL}
      </button>
    </div>
  )
}
