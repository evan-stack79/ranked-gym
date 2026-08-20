/**
 * Health / steps helpers for the PWA.
 * Reminder notifications live in reminderService.ts
 */

import { requestReminderPermission } from './reminderService'

export async function connectHealthIntent(): Promise<{ ok: boolean; message: string }> {
  const notifOk = await requestReminderPermission()
  return {
    ok: true,
    message: notifOk
      ? 'Rappels OK. Les pas se saisissent ici (Santé Apple / Google Fit en app native plus tard).'
      : 'Tu peux entrer tes pas à la main. Active les notifs pour les rappels de séance.',
  }
}

export async function pullStepsFromOS(): Promise<number | null> {
  return null
}
