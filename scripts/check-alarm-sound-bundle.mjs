#!/usr/bin/env node
/**
 * Fails if AlarmKit « Petits oiseaux » CAF is missing from repo
 * or Xcode Copy Bundle Resources. Used locally and mirrored in Build IPA.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = new URL('..', import.meta.url).pathname
const caf = join(root, 'ios/App/App/Sounds/PetitsOiseaux.caf')
const pbx = join(root, 'ios/App/App.xcodeproj/project.pbxproj')

function fail(msg) {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

if (!existsSync(caf)) {
  fail('PetitsOiseaux.caf missing under ios/App/App/Sounds/ (required for AlarmKit)')
}
const n = statSync(caf).size
if (n < 1000) fail(`${caf} looks empty (${n} bytes)`)
console.log('ok source', caf, n, 'bytes')

// Prefer PCM (not IMA4) — decode artifacts made the previous roar-replacement harsh.
const probe = spawnSync(
  'ffprobe',
  ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', caf],
  { encoding: 'utf8' },
)
if (probe.status === 0) {
  const codec = (probe.stdout || '').trim()
  if (codec && codec !== 'pcm_s16le') {
    fail(`PetitsOiseaux.caf codec must be pcm_s16le (got ${codec})`)
  }
  console.log('ok codec', codec || 'unknown')
} else {
  console.log('warn: ffprobe unavailable — skip codec assert')
}

const pbxText = readFileSync(pbx, 'utf8')
if (!pbxText.includes('PetitsOiseaux.caf in Resources')) {
  fail('project.pbxproj missing « PetitsOiseaux.caf in Resources »')
}
if (pbxText.includes('PetitsOiseaux.wav')) {
  fail('project.pbxproj still references PetitsOiseaux.wav (remove unused wav)')
}
if (!pbxText.includes('RankedAlarmStopIntent.swift in Sources')) {
  fail('project.pbxproj missing RankedAlarmStopIntent.swift in Sources')
}
console.log('ok pbxproj Resources + StopIntent sources')
console.log('alarm sound bundle contract OK')
