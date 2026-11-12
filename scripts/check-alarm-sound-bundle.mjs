#!/usr/bin/env node
/**
 * Fails if the AlarmKit « Petits oiseaux » sound is missing from repo
 * or Xcode Copy Bundle Resources. Used locally and mirrored in Build IPA.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const caf = join(root, 'ios/App/App/Sounds/PetitsOiseaux.caf')
const wav = join(root, 'ios/App/App/Sounds/PetitsOiseaux.wav')
const pbx = join(root, 'ios/App/App.xcodeproj/project.pbxproj')

function fail(msg) {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

if (!existsSync(caf) && !existsSync(wav)) {
  fail('neither PetitsOiseaux.caf nor .wav exists under ios/App/App/Sounds/')
}
if (!existsSync(caf)) {
  fail('PetitsOiseaux.caf missing under ios/App/App/Sounds/ (required for AlarmKit)')
}
for (const f of [caf, wav].filter((p) => existsSync(p))) {
  const n = statSync(f).size
  if (n < 1000) fail(`${f} looks empty (${n} bytes)`)
  console.log('ok source', f, n, 'bytes')
}

const pbxText = readFileSync(pbx, 'utf8')
if (!pbxText.includes('PetitsOiseaux.caf in Resources')) {
  fail('project.pbxproj missing « PetitsOiseaux.caf in Resources »')
}
if (!pbxText.includes('RankedAlarmStopIntent.swift in Sources')) {
  fail('project.pbxproj missing RankedAlarmStopIntent.swift in Sources')
}
console.log('ok pbxproj Resources + StopIntent sources')
console.log('alarm sound bundle contract OK')
