import type { SleepAlarmUiStatus } from '../../services/sleepAlarmService'
import {
  formatAlarmScheduledMessage,
  openSleepAlarmSettings,
} from '../../services/sleepAlarmService'

const GRAY = '#ACB4BA'
const RED = '#ff0702'

interface SleepAlarmStatusBannerProps {
  status: SleepAlarmUiStatus
  /** Compact line under Accueil night card. */
  compact?: boolean
}

/**
 * Visible réveil feedback — marketing grey on near-black, red only for CTA.
 * Scheduled copy is exact: « Réveil prévu à HH:MM ».
 */
export function SleepAlarmStatusBanner({ status, compact }: SleepAlarmStatusBannerProps) {
  if (status.kind === 'off') return null

  if (status.kind === 'scheduled') {
    return (
      <p
        className={compact ? 'text-[13px] text-[#ACB4BA]' : 'px-1 text-[13px] text-[#ACB4BA]'}
        data-sleep-alarm-status="scheduled"
      >
        {formatAlarmScheduledMessage(status.timeHm)}
        {!compact && status.summary ? (
          <span className="text-[#636366]"> · {status.summary}</span>
        ) : null}
      </p>
    )
  }

  if (status.kind === 'permission') {
    return (
      <div
        className={compact ? 'space-y-2' : 'space-y-2 px-1'}
        data-sleep-alarm-status="permission"
      >
        <p className="text-[13px]" style={{ color: GRAY }}>
          Autorise les alarmes pour Ranked Gym dans Réglages
        </p>
        <button
          type="button"
          onClick={() => void openSleepAlarmSettings()}
          className="ios-press text-[14px] font-semibold"
          style={{ color: RED }}
          data-sleep-alarm-open-settings
        >
          Ouvrir Réglages
        </button>
      </div>
    )
  }

  return (
    <p
      className={compact ? 'text-[13px] text-[#FF907F]' : 'px-1 text-[13px] text-[#FF907F]'}
      data-sleep-alarm-status="error"
    >
      {status.message}
    </p>
  )
}
