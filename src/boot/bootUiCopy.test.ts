import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { containsForbiddenBootCopy, FORBIDDEN_BOOT_UI_COPY } from './bootUiCopy'

const root = join(import.meta.dirname, '../..')
const uiRoots = [
  join(root, 'src/App.tsx'),
  join(root, 'src/components'),
  join(root, 'index.html'),
]

function walk(file: string, acc: string[]) {
  const stat = statSync(file)
  if (stat.isDirectory()) {
    for (const name of readdirSync(file)) {
      if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue
      walk(join(file, name), acc)
    }
    return
  }
  if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.html')) acc.push(file)
}

describe('copies techniques absentes de l’UI', () => {
  it('ne laisse aucun message de boot technique dans l’interface', () => {
    const files: string[] = []
    for (const start of uiRoots) walk(start, files)
    const hits: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      const hit = containsForbiddenBootCopy(text)
      if (hit) hits.push(`${file}: ${hit}`)
    }
    expect(hits, hits.join('\n')).toEqual([])
  })

  it('liste les libellés à bannir', () => {
    expect(FORBIDDEN_BOOT_UI_COPY.length).toBeGreaterThan(3)
  })
})
