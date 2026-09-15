import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('Android MASVS backup posture', () => {
  const manifest = readFileSync(resolve(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8')
  const backupRules = readFileSync(resolve(root, 'android/app/src/main/res/xml/backup_rules.xml'), 'utf8')
  const extraction = readFileSync(
    resolve(root, 'android/app/src/main/res/xml/data_extraction_rules.xml'),
    'utf8',
  )

  it('sets allowBackup false and does not leave true', () => {
    expect(manifest).toMatch(/android:allowBackup="false"/)
    expect(manifest).not.toMatch(/android:allowBackup="true"/)
  })

  it('wires fullBackupContent and dataExtractionRules excludes', () => {
    expect(manifest).toMatch(/android:fullBackupContent="@xml\/backup_rules"/)
    expect(manifest).toMatch(/android:dataExtractionRules="@xml\/data_extraction_rules"/)
    expect(backupRules).toMatch(/<exclude domain="sharedpref"/)
    expect(backupRules).toMatch(/<exclude domain="file"/)
    expect(extraction).toMatch(/<cloud-backup>/)
    expect(extraction).toMatch(/<device-transfer>/)
    expect(extraction).toMatch(/<exclude domain="sharedpref"/)
  })
})

describe('iOS backup posture (no allowBackup equivalent)', () => {
  const plist = readFileSync(resolve(root, 'ios/App/App/Info.plist'), 'utf8')
  const plugin = readFileSync(resolve(root, 'ios/App/App/Plugins/SecureStoragePlugin.swift'), 'utf8')

  it('does not enable iTunes file sharing', () => {
    expect(plist).not.toMatch(/<key>UIFileSharingEnabled<\/key>\s*<true\/>/)
  })

  it('stores native secrets with ThisDeviceOnly Keychain accessibility', () => {
    expect(plugin).toMatch(/kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/)
  })
})
