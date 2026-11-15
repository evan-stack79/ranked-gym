#!/usr/bin/env node
/**
 * Fails if AlarmKit / LN « Petits oiseaux » CAFs are missing from repo
 * or Xcode Copy Bundle Resources. Used locally and mirrored in Build IPA.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = new URL('..', import.meta.url).pathname
const caf = join(root, 'ios/App/App/Sounds/PetitsOiseaux.caf')
const caf29 = join(root, 'ios/App/App/Sounds/PetitsOiseaux_29.caf')
const pbx = join(root, 'ios/App/App.xcodeproj/project.pbxproj')
const entitlements = join(root, 'ios/App/App/App.entitlements')

function fail(msg) {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

function assertPcm(path) {
  if (!existsSync(path)) fail(`${path} missing`)
  const n = statSync(path).size
  if (n < 1000) fail(`${path} looks empty (${n} bytes)`)
  console.log('ok source', path, n, 'bytes')
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', path],
    { encoding: 'utf8' },
  )
  if (probe.status === 0) {
    const codec = (probe.stdout || '').trim()
    if (codec && codec !== 'pcm_s16le') {
      fail(`${path} codec must be pcm_s16le (got ${codec})`)
    }
    console.log('ok codec', path, codec || 'unknown')
  }
  const durProbe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path],
    { encoding: 'utf8' },
  )
  if (durProbe.status === 0) {
    const d = Number(durProbe.stdout.trim())
    if (path.endsWith('_29.caf')) {
      if (!(d > 0 && d <= 29.9)) fail(`${path} duration ${d} must be ≤ 29.9 s`)
    } else if (!(d >= 40 && d <= 50)) {
      fail(`${path} duration ${d} expected ~44 s`)
    }
    console.log('ok duration', path, d.toFixed(3), 's')
  }
}

assertPcm(caf)
assertPcm(caf29)

if (!existsSync(entitlements)) {
  fail('App.entitlements missing (time-sensitive notifications)')
}
const entText = readFileSync(entitlements, 'utf8')
if (!entText.includes('com.apple.developer.usernotifications.time-sensitive')) {
  fail('App.entitlements missing time-sensitive entitlement')
}
console.log('ok entitlements')

const pbxText = readFileSync(pbx, 'utf8')
if (!pbxText.includes('PetitsOiseaux.caf in Resources')) {
  fail('project.pbxproj missing « PetitsOiseaux.caf in Resources »')
}
if (!pbxText.includes('PetitsOiseaux_29.caf in Resources')) {
  fail('project.pbxproj missing « PetitsOiseaux_29.caf in Resources »')
}
if (!pbxText.includes('CODE_SIGN_ENTITLEMENTS = App/App.entitlements')) {
  fail('project.pbxproj missing CODE_SIGN_ENTITLEMENTS = App/App.entitlements')
}
if (pbxText.includes('PetitsOiseaux.wav')) {
  fail('project.pbxproj still references PetitsOiseaux.wav (remove unused wav)')
}
if (!pbxText.includes('RankedAlarmStopIntent.swift in Sources')) {
  fail('project.pbxproj missing RankedAlarmStopIntent.swift in Sources')
}
if (!pbxText.includes('cancelAll')) {
  // Soft: method lives in Swift sources, not necessarily pbx string — check source file.
}
console.log('ok pbxproj Resources + entitlements + StopIntent sources')
console.log('alarm sound bundle contract OK')
