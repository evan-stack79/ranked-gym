/**
 * Vérification JWS Apple avec chaîne x5c complète (QA B1).
 * "use node" : X509Certificate (Node crypto) pour signature de chaque maillon
 * + empreinte SHA-256 épinglée d'Apple Root CA - G3.
 */
'use node'

import { createHash, X509Certificate } from 'node:crypto'
import { compactVerify, importX509, type CompactVerifyResult } from 'jose'
import { readSubscriptionEnv } from './subscriptionEnv'
import {
  decodeJwsHeaderUnsafe,
} from './appleJws'

/** Empreinte SHA-256 (minuscules, sans ':') — Apple Root CA - G3 (apple.com/certificateauthority). */
export const APPLE_ROOT_CA_G3_FINGERPRINT_SHA256 =
  '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179'

/**
 * OID feuille App Store receipt signing — Apple CPS WWDR §4.11.10 /
 * app-store-server-library (QA M4).
 */
export const APPLE_LEAF_RECEIPT_OID = '1.2.840.113635.100.6.11.1'

/**
 * OID intermédiaire Apple Worldwide Developer Relations (QA M4).
 */
export const APPLE_WWDR_INTERMEDIATE_OID = '1.2.840.113635.100.6.2.1'

/** PEM officiel Apple Root CA - G3 — ancré dans le code (pas seulement via env). */
export const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`

function derB64ToCert(derB64: string): X509Certificate {
  return new X509Certificate(Buffer.from(derB64, 'base64'))
}

function fingerprintSha256Hex(cert: X509Certificate): string {
  return createHash('sha256').update(cert.raw).digest('hex')
}

function assertCertCurrentlyValid(cert: X509Certificate, now = new Date()): void {
  const from = new Date(cert.validFrom)
  const to = new Date(cert.validTo)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('APPLE_CERT_DATES_INVALID')
  }
  if (now < from || now > to) {
    throw new Error('APPLE_CERT_NOT_YET_VALID_OR_EXPIRED')
  }
}

/** Encode le contenu OBJECT IDENTIFIER (sans tag/longueur) en DER. */
export function encodeOidDerContent(oid: string): Buffer {
  const parts = oid.split('.').map((p) => Number(p))
  if (parts.length < 2 || parts.some((n) => !Number.isInteger(n) || n < 0 || Number.isNaN(n))) {
    throw new Error('APPLE_OID_INVALID')
  }
  const first = parts[0]!
  const second = parts[1]!
  if (first > 2 || second >= 40) {
    throw new Error('APPLE_OID_INVALID')
  }
  const body: number[] = [40 * first + second]
  for (const n of parts.slice(2)) {
    if (n < 0x80) {
      body.push(n)
      continue
    }
    const stack: number[] = []
    let v = n
    stack.push(v & 0x7f)
    v >>= 7
    while (v > 0) {
      stack.push((v & 0x7f) | 0x80)
      v >>= 7
    }
    for (let i = stack.length - 1; i >= 0; i -= 1) body.push(stack[i]!)
  }
  return Buffer.from(body)
}

/** Présence de l’extension/attribut OID Apple dans le DER du certificat. */
export function certHasAppleOid(cert: X509Certificate, oid: string): boolean {
  const content = encodeOidDerContent(oid)
  if (content.length > 127) throw new Error('APPLE_OID_TOO_LONG')
  const tagged = Buffer.concat([Buffer.from([0x06, content.length]), content])
  return cert.raw.includes(tagged)
}

function assertAppleChainOids(leaf: X509Certificate, intermediate: X509Certificate): void {
  if (!certHasAppleOid(leaf, APPLE_LEAF_RECEIPT_OID)) {
    throw new Error('APPLE_LEAF_OID_MISSING')
  }
  if (!certHasAppleOid(intermediate, APPLE_WWDR_INTERMEDIATE_OID)) {
    throw new Error('APPLE_INTERMEDIATE_OID_MISSING')
  }
}

/**
 * Vérifie chaque maillon (feuille ← inter ← racine), épingle l'empreinte racine,
 * et exige les OID Apple receipt/WWDR (QA M4).
 * Un certificat auto-signé suivi de la racine Apple est REFUSÉ (pas d'émission).
 */
export function verifyAppleX509Chain(
  x5cDerB64: string[],
  opts?: {
    pinnedRootFingerprintSha256?: string
    now?: Date
  },
): X509Certificate {
  // Chaîne App Store Server : leaf + intermediate + root (bibliothèque Apple officielle).
  if (!x5cDerB64 || x5cDerB64.length !== 3) {
    throw new Error('APPLE_CERT_CHAIN_LENGTH_INVALID')
  }
  const pinned = (
    opts?.pinnedRootFingerprintSha256 ?? APPLE_ROOT_CA_G3_FINGERPRINT_SHA256
  ).toLowerCase()
  const now = opts?.now ?? new Date()
  const certs = x5cDerB64.map(derB64ToCert)

  const leaf = certs[0]!
  const intermediate = certs[1]!
  const root = certs[2]!
  const rootFp = fingerprintSha256Hex(root)
  if (rootFp !== pinned) {
    throw new Error('APPLE_ROOT_FINGERPRINT_MISMATCH')
  }
  // Racine doit être auto-signée.
  if (!root.verify(root.publicKey)) {
    throw new Error('APPLE_ROOT_NOT_SELF_SIGNED')
  }
  assertCertCurrentlyValid(root, now)

  for (let i = 0; i < certs.length - 1; i += 1) {
    const subject = certs[i]!
    const issuer = certs[i + 1]!
    assertCertCurrentlyValid(subject, now)
    if (!subject.checkIssued(issuer)) {
      throw new Error('APPLE_CERT_CHAIN_ISSUER_MISMATCH')
    }
    if (!subject.verify(issuer.publicKey)) {
      throw new Error('APPLE_CERT_CHAIN_SIGNATURE_INVALID')
    }
  }

  assertAppleChainOids(leaf, intermediate)

  return leaf
}

function derToPem(derB64: string): string {
  const lines = derB64.match(/.{1,64}/g) ?? [derB64]
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`
}

/**
 * Vérifie signature JWS ES256 + chaîne x5c ancrée sur Apple Root CA G3.
 */
export async function verifyAppleJwsSignature(jws: string): Promise<{
  payload: Record<string, unknown>
  protectedHeader: CompactVerifyResult['protectedHeader']
}> {
  const header = decodeJwsHeaderUnsafe(jws)
  if (header.alg !== 'ES256') throw new Error('JWS_ALG_UNSUPPORTED')
  const x5c = header.x5c
  if (!x5c || x5c.length === 0) throw new Error('JWS_MISSING_X5C')

  // Chaîne complète obligatoire (refuse feuille seule / auto-signé + racine collée).
  verifyAppleX509Chain(x5c)

  // Env optionnelle : doit aussi contenir G3 si fournie (défense en profondeur).
  const rootsEnv = (readSubscriptionEnv('APPLE_ROOT_CA_PEMS') ?? '').trim()
  if (rootsEnv) {
    const normalizedEnv = rootsEnv.replace(/\s+/g, '')
    const normalizedPinned = APPLE_ROOT_CA_G3_PEM.replace(/\s+/g, '')
    if (!normalizedEnv.includes(normalizedPinned)) {
      throw new Error('APPLE_ROOT_CA_PEMS_MISSING_G3')
    }
  }

  const leafPem = derToPem(x5c[0]!)
  const key = await importX509(leafPem, 'ES256')
  const { payload, protectedHeader } = await compactVerify(jws, key)
  const text = new TextDecoder().decode(payload)
  return { payload: JSON.parse(text) as Record<string, unknown>, protectedHeader }
}
