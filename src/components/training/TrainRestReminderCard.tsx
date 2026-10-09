import { X } from 'lucide-react'
import { REST_REMINDER_TEXT } from '../../services/trainRestReminder'

export function TrainRestReminderCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside
      className="relative rounded-3xl border border-white/10 bg-[#141416] px-4 py-3.5"
      data-testid="train-rest-reminder"
      role="status"
    >
      <p className="pr-10 text-[14px] leading-relaxed text-[#E5E5EA]">{REST_REMINDER_TEXT}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="ios-press absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full text-[#8E8E93]"
        aria-label="Masquer le rappel"
        data-testid="train-rest-reminder-dismiss"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  )
}
