export const LEGAL_TERMS_PATH = '/legal/conditions'
export const LEGAL_PRIVACY_PATH = '/legal/confidentialite'

export type LegalDocumentKind = 'terms' | 'privacy'

export function legalKindFromPath(pathname: string): LegalDocumentKind | null {
  if (pathname === LEGAL_TERMS_PATH) return 'terms'
  if (pathname === LEGAL_PRIVACY_PATH) return 'privacy'
  return null
}
