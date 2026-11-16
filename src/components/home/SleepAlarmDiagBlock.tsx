import { useCallback, useEffect, useState } from 'react'
import {
  collectSleepAlarmDiagnostics,
  runOneMinuteAlarmTest,
  syncFailureMessage,
  type SleepAlarmDiagView,
} from '../../services/sleepAlarmService'

const GRAY = '#8E8E93'

function yn(v: boolean): string {
  return v ? 'oui' : 'non'
}

interface SleepAlarmDiagBlockProps {
  /** Force expanded (5 taps on title). */
  expanded: boolean
  open: boolean
}

/**
 * Beta diagnostics for réveil — small grey block at sheet bottom.
 * Shows build SHA, iOS, plugin availability, AlarmKit, auth, lastError, alarm count.
 */
export function SleepAlarmDiagBlock({ expanded, open }: SleepAlarmDiagBlockProps) {
  const [diag, setDiag] = useState<SleepAlarmDiagView | null>(null)
  const [busy, setBusy] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDiag(await collectSleepAlarmDiagnostics())
    } catch (err) {
      console.error('[sleep-alarm] diag', err)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setTestMsg(null)
      return
    }
    void refresh()
  }, [open, refresh])

  const onTest = async () => {
    setBusy(true)
    setTestMsg(null)
    const result = await runOneMinuteAlarmTest()
    setDiag(result.diagnostics)
    setBusy(false)
    if (result.ok) {
      setTestMsg(`Test OK — alarme dans 60 s (id ${result.id?.slice(0, 8) ?? '?'}…)`)
    } else {
      setTestMsg(syncFailureMessage(result.reason) + (result.reason ? ` (${result.reason})` : ''))
    }
  }

  if (!open) return null

  const lines = diag
    ? [
        `build ${diag.buildSha}`,
        `iOS ${diag.iosVersion}`,
        `plugin ${diag.pluginJsName}: ${yn(diag.pluginAvailable)}`,
        `AlarmKit: ${yn(diag.alarmKitAvailable)}`,
        `auth: ${diag.authorization}`,
        `alarmes: ${diag.alarmCount}`,
        `son: ${diag.soundResolvedName ?? '—'} (${yn(Boolean(diag.soundInBundle))})`,
        `erreur: ${diag.lastError ?? '—'}`,
      ]
    : ['diagnostic…']

  return (
    <div
      className="mt-2 space-y-1.5 border-t border-white/10 pt-2"
      data-sleep-alarm-diag
      data-sleep-alarm-diag-expanded={expanded ? '1' : '0'}
    >
      <p
        className="px-1 font-mono text-[9px] leading-snug"
        style={{ color: GRAY }}
        data-sleep-alarm-diag-lines
      >
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
        {expanded && diag ? (
          <>
            <span className="mt-1 block">native: {yn(diag.native)}</span>
            <span className="block">cap: {diag.platform}/{yn(diag.capacitorNative)}</span>
            <span className="block">NSAlarmKitUsageDescription: {yn(diag.hasUsageDescription)}</span>
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => void onTest()}
        disabled={busy}
        className="ios-press w-full rounded-xl px-3 py-2 text-left text-[11px] disabled:opacity-50"
        style={{ backgroundColor: '#1C1C1E', color: GRAY }}
        data-sleep-alarm-test-1min
      >
        {busy ? 'Test en cours…' : 'Tester dans 1 min'}
      </button>
      {testMsg ? (
        <p className="px-1 text-[11px]" style={{ color: GRAY }} data-sleep-alarm-test-msg>
          {testMsg}
        </p>
      ) : null}
    </div>
  )
}
