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
  onRearm?: () => void
}

/**
 * Visible réveil feedback — marketing grey on near-black, red only for CTA.
 */
export function SleepAlarmStatusBanner({
  status,
  compact,
  onRearm,
}: SleepAlarmStatusBannerProps) {
  if (status.kind === 'off') return null

  if (status.kind === 'scheduled') {
    return (
      <p
        className={compact ? 'text-[13px] text-[#ACB4BA]' : 'px-1 text-[13px] text-[#ACB4BA]'}
        data-sleep-alarm-status="scheduled"
      >
        {status.readback || formatAlarmScheduledMessage(status.timeHm)}
        {!compact && status.summary ? (
          <span className="text-[#636366]"> · {status.summary}</span>
        ) : null}
      </p>
    )
  }

  if (status.kind === 'mismatch') {
    return (
      <div
        className={compact ? 'space-y-2' : 'space-y-2 px-1'}
        data-sleep-alarm-status="mismatch"
      >
        <p className="text-[13px] font-medium text-[#FF907F]">{status.message}</p>
        {onRearm ? (
          <button
            type="button"
            onClick={onRearm}
            className="ios-press text-[14px] font-semibold"
            style={{ color: RED }}
            data-sleep-alarm-rearm
          >
            Réarmer le réveil
          </button>
        ) : null}
      </div>
    )
  }

  if (status.kind === 'permission') {
    return (
      <div
        className={
          compact
            ? 'space-y-2 rounded-2xl border border-[#ff0702]/40 bg-[#1C1C1E] p-3'
            : 'space-y-2 rounded-2xl border border-[#ff0702]/40 bg-[#1C1C1E] px-3 py-3'
        }
        data-sleep-alarm-status="permission"
      >
        <p className="text-[15px] font-semibold text-white">
          Autorise les alarmes pour Ranked Gym
        </p>
        <p className="text-[13px]" style={{ color: GRAY }}>
          Sans cette autorisation, le réveil ne peut pas sonner.
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
    <div
      className={
        compact
          ? 'space-y-2 rounded-2xl border border-[#FF907F]/35 bg-[#1C1C1E] p-3'
          : 'space-y-2 rounded-2xl border border-[#FF907F]/35 bg-[#1C1C1E] px-3 py-3'
      }
      data-sleep-alarm-status="error"
    >
      <p className="text-[14px] font-medium text-[#FF907F]">{status.message}</p>
      {status.openSettings !== false ? (
        <button
          type="button"
          onClick={() => void openSleepAlarmSettings()}
          className="ios-press text-[14px] font-semibold"
          style={{ color: RED }}
          data-sleep-alarm-open-settings
        >
          Ouvrir Réglages
        </button>
      ) : null}
    </div>
  )
}
