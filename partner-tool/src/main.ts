/**
 * Partner caisse SPA — talks only to Convex HTTPS.
 * Interdits UI: Force, Discipline, ligue, €, boutique joueur, solde pts.
 */
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import {
  escapeAttr,
  escapeHtml,
  renderHistoryItemsHtml,
  sanitizePartnerCode,
} from './htmlSafety'

type Screen = 'login' | 'invite' | 'caisse' | 'result' | 'history' | 'confirm'

type Account = {
  accountId: string
  email: string
  partnerId: string
  role: 'partner_staff' | 'partner_admin' | 'rg_admin'
  active: boolean
}

type LookupOk = {
  ok: true
  status: string
  code: string
  itemTitle: string
  partnerName: string
  partnerId: string
  redemptionId: string
  expiresAt: number
  actionable: boolean
}

const STOCK_BANNER =
  'Ranked Gym ne rembourse pas le stock ; le cadeau est offert par la marque / la salle.'

const SESSION_KEY = 'rg_partner_session_mem'
/** Bearer in memory only (ARCHI §3.2) — sessionStorage cleared on tab close; never localStorage. */
let memoryToken: string | null = null

const api = anyApi as any

function convexUrl(): string {
  const url = (import.meta as any).env?.VITE_CONVEX_URL as string | undefined
  if (!url) {
    throw new Error('VITE_CONVEX_URL manquant (env VPS / .env.local partenaire)')
  }
  return url
}

function client(): ConvexHttpClient {
  return new ConvexHttpClient(convexUrl())
}

function getToken(): string | null {
  if (memoryToken) return memoryToken
  try {
    memoryToken = sessionStorage.getItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  return memoryToken
}

function setToken(token: string | null) {
  memoryToken = token
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'created':
    case 'shown':
      return 'Valide'
    case 'consumed':
      return 'Déjà utilisé'
    case 'expired':
      return 'Expiré'
    case 'partner_refused':
    case 'invalidated':
      return 'Refusé / invalidé'
    default:
      return status
  }
}

function errorLabel(error: string): string {
  const map: Record<string, string> = {
    PARTNER_AUTH_REQUIRED: 'Session expirée — reconnecte-toi.',
    PARTNER_INVALID_CREDENTIALS: 'E-mail ou mot de passe incorrect.',
    PARTNER_PLAYER_AUTH_REJECTED: 'Compte joueur refusé — utilise un compte partenaire.',
    PARTNER_ADMIN_CONFIRM_REQUIRED: 'Confirmation admin requise (« Je confirme »).',
    PARTNER_ITEM_FORBIDDEN: 'Ce code appartient à une autre marque.',
    REWARDS_CODE_NOT_FOUND: 'Code inconnu.',
    REWARDS_CODE_ALREADY_CONSUMED: 'Code déjà utilisé.',
    REWARDS_CODE_EXPIRED: 'Code expiré.',
    REWARDS_CODE_INVALID: 'Code invalidé.',
    REWARDS_CODE_NOT_CONSUMABLE: 'Code non consommable.',
    REWARDS_CODE_NOT_REFUSABLE: 'Code non refusables.',
    PARTNER_INVITE_INVALID: 'Invitation invalide ou expirée.',
    PARTNER_PASSWORD_POLICY: 'Mot de passe trop court (8 caractères min.).',
    PARTNER_INACTIVE: 'Cette marque est désactivée — accès caisse fermé.',
    PARTNER_ROLE_FORBIDDEN: 'Rôle non autorisé pour cette action.',
    REWARDS_CODE_INVALID_FORMAT: 'Code invalide (format / caractères non autorisés).',
  }
  return map[error] ?? error
}

function msgError(): string {
  return state.error ? `<div class="msg error">${escapeHtml(state.error)}</div>` : ''
}

function msgOk(): string {
  return state.message ? `<div class="msg ok">${escapeHtml(state.message)}</div>` : ''
}

const state: {
  screen: Screen
  account: Account | null
  partnerName: string | null
  lookup: LookupOk | null
  pendingAction: 'consume' | 'refuse' | null
  refuseReason: string
  message: string | null
  error: string | null
  inviteToken: string
  history: Array<{
    code: string
    action: string
    result: string
    errorCode: string | null
    reason: string | null
    createdAt: number
  }>
} = {
  screen: 'login',
  account: null,
  partnerName: null,
  lookup: null,
  pendingAction: null,
  refuseReason: '',
  message: null,
  error: null,
  inviteToken: '',
  history: [],
}

function el(html: string): string {
  return html
}

function banner(): string {
  return `<div class="banner" role="note">${escapeHtml(STOCK_BANNER)}</div>`
}

function renderLogin(): string {
  return el(`
    ${banner()}
    <main class="shell">
      <p class="brand">Ranked Gym</p>
      <p class="sub">Caisse partenaire — connexion employé</p>
      <form id="login-form" class="card-less">
        <label>E-mail
          <input name="email" type="email" autocomplete="username" required />
        </label>
        <label>Mot de passe
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        ${msgError()}
        <div class="btn-row">
          <button class="btn-primary" type="submit">Se connecter</button>
          <button class="btn-ghost" type="button" data-go="invite">J’ai une invitation</button>
        </div>
      </form>
    </main>
  `)
}

function renderInvite(): string {
  return el(`
    ${banner()}
    <main class="shell">
      <p class="brand">Ranked Gym</p>
      <p class="sub">Activer mon compte partenaire</p>
      <form id="invite-form" class="card-less">
        <label>Jeton d’invitation
          <input name="token" type="text" required value="${escapeAttr(state.inviteToken)}" />
        </label>
        <label>E-mail
          <input name="email" type="email" autocomplete="username" required />
        </label>
        <label>Choisir un mot de passe
          <input name="password" type="password" autocomplete="new-password" minlength="8" required />
        </label>
        ${msgError()}
        <div class="btn-row">
          <button class="btn-primary" type="submit">Activer</button>
          <button class="btn-ghost" type="button" data-go="login">Retour</button>
        </div>
      </form>
    </main>
  `)
}

function nav(): string {
  const role = state.account?.role ?? ''
  return `
    <div class="nav">
      <button class="btn-ghost ${state.screen === 'caisse' || state.screen === 'result' || state.screen === 'confirm' ? 'active' : ''}" type="button" data-go="caisse">Caisse</button>
      <button class="btn-ghost ${state.screen === 'history' ? 'active' : ''}" type="button" data-go="history">Historique</button>
      <button class="btn-ghost" type="button" id="logout-btn">Déconnexion</button>
    </div>
    <p class="meta">${escapeHtml(state.partnerName ?? 'Partenaire')} · ${escapeHtml(state.account?.email ?? '')} · ${escapeHtml(role)}</p>
  `
}

function renderCaisse(): string {
  return el(`
    ${banner()}
    <main class="shell">
      ${nav()}
      <h1 class="brand" style="font-size:1.35rem">Accueil caisse</h1>
      <p class="sub">Saisis le code cadeau du client, puis vérifie.</p>
      <form id="lookup-form" class="card-less">
        <label>Code cadeau
          <input class="code-input" name="code" type="text" autocomplete="off" spellcheck="false" maxlength="64" pattern="[A-Za-z0-9][A-Za-z0-9._-]{3,63}" required />
        </label>
        ${msgError()}
        ${msgOk()}
        <button class="btn-primary" type="submit">Vérifier</button>
      </form>
    </main>
  `)
}

function renderResult(): string {
  const L = state.lookup
  if (!L) return renderCaisse()
  return el(`
    ${banner()}
    <main class="shell">
      ${nav()}
      <span class="status-pill">${escapeHtml(statusLabel(L.status))}</span>
      <h1 class="result-title">${escapeHtml(L.itemTitle)}</h1>
      <p class="meta">${escapeHtml(L.partnerName)} · <span class="code-input" style="font-size:0.9rem">${escapeHtml(L.code)}</span></p>
      ${msgError()}
      ${msgOk()}
      ${
        L.actionable
          ? `<div class="btn-row" style="margin-top:1rem">
              <button class="btn-ok" type="button" id="btn-consume">Oui, donné</button>
              <button class="btn-danger" type="button" id="btn-refuse">Non, rupture</button>
            </div>
            <label style="margin-top:0.75rem">Motif rupture (optionnel)
              <input id="refuse-reason" type="text" maxlength="200" value="${escapeAttr(state.refuseReason)}" />
            </label>`
          : `<p class="sub">Aucune action possible sur ce code.</p>
             <button class="btn-ghost" type="button" data-go="caisse">Nouveau code</button>`
      }
    </main>
  `)
}

function renderConfirm(): string {
  const action = state.pendingAction === 'consume' ? 'Oui, donné' : 'Non, rupture'
  return el(`
    ${banner()}
    <main class="shell">
      ${nav()}
      <div class="confirm-box card-less">
        <h1 class="result-title" style="font-size:1.2rem">Confirmation admin</h1>
        <p class="sub">Tu es <strong>rg_admin</strong>. Confirme explicitement l’action « ${escapeHtml(action)} » sur le code ${escapeHtml(state.lookup?.code ?? '')}.</p>
        ${msgError()}
        <div class="btn-row">
          <button class="btn-primary" type="button" id="btn-admin-confirm">Je confirme</button>
          <button class="btn-ghost" type="button" data-go="result">Annuler</button>
        </div>
      </div>
    </main>
  `)
}

function renderHistory(): string {
  return el(`
    ${banner()}
    <main class="shell">
      ${nav()}
      <h1 class="result-title">Historique</h1>
      <p class="sub">Actions de ce partenaire uniquement.</p>
      ${msgError()}
      <ul class="history-list">${renderHistoryItemsHtml(state.history)}</ul>
    </main>
  `)
}

function render() {
  const root = document.getElementById('app')
  if (!root) return
  let html = ''
  switch (state.screen) {
    case 'login':
      html = renderLogin()
      break
    case 'invite':
      html = renderInvite()
      break
    case 'caisse':
      html = renderCaisse()
      break
    case 'result':
      html = renderResult()
      break
    case 'confirm':
      html = renderConfirm()
      break
    case 'history':
      html = renderHistory()
      break
  }
  root.innerHTML = html
  bind()
}

async function bootstrapSession() {
  const token = getToken()
  if (!token) {
    state.screen = 'login'
    render()
    return
  }
  try {
    const me = await client().query(api.partnerAuth.me, { partnerSessionToken: token })
    if (!me?.ok) {
      setToken(null)
      state.screen = 'login'
      render()
      return
    }
    state.account = me.account
    state.partnerName = me.partner?.name ?? null
    state.screen = 'caisse'
    render()
  } catch (e) {
    state.error = e instanceof Error ? e.message : 'Erreur réseau'
    state.screen = 'login'
    render()
  }
}

async function runAction(kind: 'consume' | 'refuse', adminConfirmed: boolean) {
  const token = getToken()
  const L = state.lookup
  if (!token || !L) return
  state.error = null
  state.message = null
  try {
    if (kind === 'consume') {
      const res = await client().mutation(api.rewards.markConsumed, {
        partnerSessionToken: token,
        code: L.code,
        adminConfirmed: adminConfirmed || undefined,
      })
      if (!res.ok) {
        state.error = errorLabel(res.error)
        render()
        return
      }
      state.message = 'Cadeau marqué comme donné.'
      state.lookup = { ...L, status: 'consumed', actionable: false }
      state.screen = 'result'
      state.pendingAction = null
      render()
      return
    }
    const res = await client().mutation(api.rewards.partnerRefuse, {
      partnerSessionToken: token,
      code: L.code,
      reason: state.refuseReason || undefined,
      adminConfirmed: adminConfirmed || undefined,
    })
    if (!res.ok) {
      state.error = errorLabel(res.error)
      render()
      return
    }
    state.message = 'Rupture enregistrée — points recrédités au joueur.'
    state.lookup = { ...L, status: 'invalidated', actionable: false }
    state.screen = 'result'
    state.pendingAction = null
    render()
  } catch (e) {
    state.error = e instanceof Error ? e.message : 'Erreur'
    render()
  }
}

function maybeNeedAdminConfirm(kind: 'consume' | 'refuse') {
  if (state.account?.role === 'rg_admin') {
    state.pendingAction = kind
    state.screen = 'confirm'
    state.error = null
    render()
    return true
  }
  return false
}

function bind() {
  document.querySelectorAll('[data-go]').forEach((node) => {
    node.addEventListener('click', () => {
      const go = (node as HTMLElement).dataset.go as Screen
      state.error = null
      state.message = null
      if (go === 'history') {
        void loadHistory()
        return
      }
      state.screen = go
      render()
    })
  })

  const logout = document.getElementById('logout-btn')
  logout?.addEventListener('click', async () => {
    const token = getToken()
    if (token) {
      try {
        await client().mutation(api.partnerAuth.logout, { partnerSessionToken: token })
      } catch {
        /* ignore */
      }
    }
    setToken(null)
    state.account = null
    state.lookup = null
    state.screen = 'login'
    render()
  })

  const loginForm = document.getElementById('login-form') as HTMLFormElement | null
  loginForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const fd = new FormData(loginForm)
    state.error = null
    try {
      const res = await client().mutation(api.partnerAuth.login, {
        email: String(fd.get('email') ?? ''),
        password: String(fd.get('password') ?? ''),
      })
      if (!res.ok) {
        state.error = errorLabel(res.error)
        render()
        return
      }
      setToken(res.partnerSessionToken)
      state.account = res.account
      await bootstrapSession()
    } catch (e) {
      state.error = e instanceof Error ? e.message : 'Erreur'
      render()
    }
  })

  const inviteForm = document.getElementById('invite-form') as HTMLFormElement | null
  inviteForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const fd = new FormData(inviteForm)
    state.error = null
    try {
      const res = await client().mutation(api.partnerAuth.acceptInvite, {
        token: String(fd.get('token') ?? ''),
        email: String(fd.get('email') ?? ''),
        password: String(fd.get('password') ?? ''),
      })
      if (!res.ok) {
        state.error = errorLabel(res.error)
        render()
        return
      }
      setToken(res.partnerSessionToken)
      state.account = res.account
      await bootstrapSession()
    } catch (e) {
      state.error = e instanceof Error ? e.message : 'Erreur'
      render()
    }
  })

  const lookupForm = document.getElementById('lookup-form') as HTMLFormElement | null
  lookupForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const token = getToken()
    if (!token) return
    const fd = new FormData(lookupForm)
    const rawCode = String(fd.get('code') ?? '')
    const sanitized = sanitizePartnerCode(rawCode)
    state.error = null
    state.message = null
    if (!sanitized.ok) {
      state.error = errorLabel(sanitized.error)
      render()
      return
    }
    const code = sanitized.code
    try {
      const res = await client().mutation(api.rewards.partnerLookupCodeLogged, {
        partnerSessionToken: token,
        code,
      })
      if (!res.ok) {
        state.error = errorLabel(res.error)
        state.lookup = null
        render()
        return
      }
      state.lookup = res as LookupOk
      state.refuseReason = ''
      state.screen = 'result'
      render()
    } catch (e) {
      state.error = e instanceof Error ? e.message : 'Erreur'
      render()
    }
  })

  document.getElementById('btn-consume')?.addEventListener('click', () => {
    if (maybeNeedAdminConfirm('consume')) return
    void runAction('consume', false)
  })

  document.getElementById('btn-refuse')?.addEventListener('click', () => {
    const reasonInput = document.getElementById('refuse-reason') as HTMLInputElement | null
    state.refuseReason = reasonInput?.value?.trim() ?? ''
    if (maybeNeedAdminConfirm('refuse')) return
    void runAction('refuse', false)
  })

  document.getElementById('btn-admin-confirm')?.addEventListener('click', () => {
    if (!state.pendingAction) return
    void runAction(state.pendingAction, true)
  })

  document.getElementById('refuse-reason')?.addEventListener('input', (ev) => {
    state.refuseReason = (ev.target as HTMLInputElement).value
  })
}

async function loadHistory() {
  const token = getToken()
  if (!token) return
  state.error = null
  try {
    const res = await client().query(api.rewards.listPartnerActionLog, {
      partnerSessionToken: token,
      limit: 50,
    })
    if (!res.ok) {
      state.error = errorLabel(res.error)
      state.history = []
    } else {
      state.history = res.actions
    }
    state.screen = 'history'
    render()
  } catch (e) {
    state.error = e instanceof Error ? e.message : 'Erreur'
    state.screen = 'history'
    render()
  }
}

const params = new URLSearchParams(location.search)
const invite = params.get('invite')
if (invite) {
  state.inviteToken = invite
  state.screen = 'invite'
}

void bootstrapSession()
