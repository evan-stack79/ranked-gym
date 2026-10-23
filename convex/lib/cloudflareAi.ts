import { env } from '../_generated/server'

/** Convex dashboard env (CF_*) — même accès runtime que `process.env` côté actions. */
export function readConvexEnv(name: string): string {
  const fromTyped = (env as Record<string, string | undefined>)[name]
  if (typeof fromTyped === 'string' && fromTyped.trim()) return fromTyped.trim()
  const fromProcess = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.[name]
  if (typeof fromProcess === 'string' && fromProcess.trim()) return fromProcess.trim()
  return ''
}

export type WorkersAiChatResult =
  | { ok: true; text: string }
  | { ok: false; code: 'AI_CONFIG_MISSING' | 'AI_HTTP_ERROR' | 'AI_EMPTY' | 'AI_NETWORK'; error: string }

/**
 * Appelle Cloudflare Workers AI (Llama 3.1 8B) avec CF_ACCOUNT_ID / CF_API_TOKEN.
 * Même jeton que `askRankedIntelligence`.
 */
export async function runWorkersAiChat(input: {
  system: string
  user: string
}): Promise<WorkersAiChatResult> {
  const accountId = readConvexEnv('CF_ACCOUNT_ID')
  const apiToken = readConvexEnv('CF_API_TOKEN')
  if (!accountId || !apiToken) {
    return {
      ok: false,
      code: 'AI_CONFIG_MISSING',
      error: 'Workers AI non configuré (CF_ACCOUNT_ID / CF_API_TOKEN).',
    }
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[cloudflareAi] HTTP', response.status, detail.slice(0, 300))
      return {
        ok: false,
        code: 'AI_HTTP_ERROR',
        error: 'Le coach IA est temporairement indisponible — réessaie plus tard.',
      }
    }
    const payload = (await response.json()) as {
      result?: { response?: unknown }
    }
    const text = typeof payload?.result?.response === 'string' ? payload.result.response.trim() : ''
    if (!text) {
      return { ok: false, code: 'AI_EMPTY', error: 'Réponse IA vide — réessaie.' }
    }
    return { ok: true, text }
  } catch (error) {
    console.error('[cloudflareAi] fetch failed', error)
    return {
      ok: false,
      code: 'AI_NETWORK',
      error: 'Impossible de joindre Workers AI — réessaie.',
    }
  }
}
