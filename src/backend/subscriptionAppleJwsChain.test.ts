/**
 * QA B1 — chaîne x5c Apple : chaque maillon signé, racine G3 épinglée.
 * QA M4 — OID feuille 1.2.840.113635.100.6.11.1 + OID inter 1.2.840.113635.100.6.2.1.
 */
import { createPrivateKey, generateKeyPairSync, X509Certificate } from 'node:crypto'
import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import {
  APPLE_LEAF_RECEIPT_OID,
  APPLE_ROOT_CA_G3_FINGERPRINT_SHA256,
  APPLE_ROOT_CA_G3_PEM,
  APPLE_WWDR_INTERMEDIATE_OID,
  certHasAppleOid,
  encodeOidDerContent,
  verifyAppleJwsSignature,
  verifyAppleX509Chain,
} from '../../convex/lib/appleJwsVerify'

function pemToDerB64(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '')
}

function buildSelfSignedEcCertPem(cn: string): { certPem: string; privateKeyPem: string } {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
  const fs = require('node:fs') as typeof import('node:fs')
  const os = require('node:os') as typeof import('node:os')
  const path = require('node:path') as typeof import('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pro-jws-'))
  const keyPath = path.join(dir, 'key.pem')
  const certPath = path.join(dir, 'cert.pem')
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }))
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-new',
      '-key',
      keyPath,
      '-out',
      certPath,
      '-days',
      '2',
      '-subj',
      `/CN=${cn}`,
      '-nodes',
    ],
    { stdio: 'pipe' },
  )
  const certPem = fs.readFileSync(certPath, 'utf8')
  const privateKeyPem = fs.readFileSync(keyPath, 'utf8')
  return { certPem, privateKeyPem }
}

async function signEs256Jws(args: {
  payload: Record<string, unknown>
  privateKeyPem: string
  x5c: string[]
}): Promise<string> {
  const key = createPrivateKey(args.privateKeyPem)
  return await new SignJWT(args.payload)
    .setProtectedHeader({ alg: 'ES256', x5c: args.x5c })
    .sign(key)
}

/** Chaîne EC de test leaf→inter→root, avec ou sans OID Apple. */
function buildTestChain(opts: { withAppleOids: boolean }): {
  leafDer: string
  intDer: string
  rootDer: string
  leafKeyPem: string
  pinned: string
  dir: string
} {
  const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
  const fs = require('node:fs') as typeof import('node:fs')
  const os = require('node:os') as typeof import('node:os')
  const path = require('node:path') as typeof import('node:path')
  const crypto = require('node:crypto') as typeof import('node:crypto')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pro-chain-'))

  execFileSync(
    'openssl',
    ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', path.join(dir, 'root.key')],
    { stdio: 'pipe' },
  )
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-new',
      '-key',
      path.join(dir, 'root.key'),
      '-out',
      path.join(dir, 'root.pem'),
      '-days',
      '30',
      '-subj',
      '/CN=Test Root',
    ],
    { stdio: 'pipe' },
  )

  execFileSync(
    'openssl',
    ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', path.join(dir, 'int.key')],
    { stdio: 'pipe' },
  )
  execFileSync(
    'openssl',
    [
      'req',
      '-new',
      '-key',
      path.join(dir, 'int.key'),
      '-out',
      path.join(dir, 'int.csr'),
      '-subj',
      '/CN=Test Inter',
    ],
    { stdio: 'pipe' },
  )
  const intExt = path.join(dir, 'int.ext')
  fs.writeFileSync(
    intExt,
    opts.withAppleOids
      ? `basicConstraints=CA:TRUE\n1.2.840.113635.100.6.2.1=DER:05:00\n`
      : `basicConstraints=CA:TRUE\n`,
  )
  execFileSync(
    'openssl',
    [
      'x509',
      '-req',
      '-in',
      path.join(dir, 'int.csr'),
      '-CA',
      path.join(dir, 'root.pem'),
      '-CAkey',
      path.join(dir, 'root.key'),
      '-CAcreateserial',
      '-out',
      path.join(dir, 'int.pem'),
      '-days',
      '30',
      '-extfile',
      intExt,
    ],
    { stdio: 'pipe' },
  )

  execFileSync(
    'openssl',
    ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', path.join(dir, 'leaf.key')],
    { stdio: 'pipe' },
  )
  execFileSync(
    'openssl',
    [
      'req',
      '-new',
      '-key',
      path.join(dir, 'leaf.key'),
      '-out',
      path.join(dir, 'leaf.csr'),
      '-subj',
      '/CN=Test Leaf',
    ],
    { stdio: 'pipe' },
  )
  const leafExt = path.join(dir, 'leaf.ext')
  fs.writeFileSync(
    leafExt,
    opts.withAppleOids ? `1.2.840.113635.100.6.11.1=DER:05:00\n` : `\n`,
  )
  execFileSync(
    'openssl',
    [
      'x509',
      '-req',
      '-in',
      path.join(dir, 'leaf.csr'),
      '-CA',
      path.join(dir, 'int.pem'),
      '-CAkey',
      path.join(dir, 'int.key'),
      '-CAcreateserial',
      '-out',
      path.join(dir, 'leaf.pem'),
      '-days',
      '30',
      '-extfile',
      leafExt,
    ],
    { stdio: 'pipe' },
  )

  const leafDer = pemToDerB64(fs.readFileSync(path.join(dir, 'leaf.pem'), 'utf8'))
  const intDer = pemToDerB64(fs.readFileSync(path.join(dir, 'int.pem'), 'utf8'))
  const rootDer = pemToDerB64(fs.readFileSync(path.join(dir, 'root.pem'), 'utf8'))
  const rootCert = new X509Certificate(fs.readFileSync(path.join(dir, 'root.pem')))
  const pinned = crypto.createHash('sha256').update(rootCert.raw).digest('hex')
  const leafKeyPem = fs.readFileSync(path.join(dir, 'leaf.key'), 'utf8')
  return { leafDer, intDer, rootDer, leafKeyPem, pinned, dir }
}

describe('QA B1 — Apple JWS certificate chain', () => {
  it('épingle Apple Root CA G3 (empreinte constante)', () => {
    const root = new X509Certificate(APPLE_ROOT_CA_G3_PEM)
    const fp = require('node:crypto')
      .createHash('sha256')
      .update(root.raw)
      .digest('hex')
    expect(fp).toBe(APPLE_ROOT_CA_G3_FINGERPRINT_SHA256)
  })

  it('refuse auto-signé + racine Apple collée (attaque PoC QA)', async () => {
    const attacker = buildSelfSignedEcCertPem('attacker')
    const attackerDer = pemToDerB64(attacker.certPem)
    const appleRootDer = pemToDerB64(APPLE_ROOT_CA_G3_PEM)
    await expect(() => verifyAppleX509Chain([attackerDer, appleRootDer])).toThrow(
      /APPLE_CERT_CHAIN_LENGTH_INVALID/,
    )

    const jws = await signEs256Jws({
      payload: {
        transactionId: 'fake-tx',
        originalTransactionId: 'fake-orig',
        bundleId: 'com.rankedgym.app',
        productId: 'ranked.pro.solo.yearly',
        environment: 'Production',
        expiresDate: Date.now() + 365 * 86400000,
      },
      privateKeyPem: attacker.privateKeyPem,
      x5c: [attackerDer, appleRootDer],
    })
    await expect(verifyAppleJwsSignature(jws)).rejects.toThrow(/APPLE_CERT_CHAIN_LENGTH_INVALID/)
  })

  it('accepte une chaîne valide Root→Inter→Leaf avec OID Apple (empreinte racine de test)', () => {
    const { leafDer, intDer, rootDer, pinned } = buildTestChain({ withAppleOids: true })
    expect(() =>
      verifyAppleX509Chain([leafDer, intDer, rootDer], { pinnedRootFingerprintSha256: pinned }),
    ).not.toThrow()
  })

  it('refuse une chaîne invalide (maillon non signé par le suivant)', () => {
    const a = buildSelfSignedEcCertPem('a')
    const b = buildSelfSignedEcCertPem('b')
    const c = buildSelfSignedEcCertPem('c')
    const aDer = pemToDerB64(a.certPem)
    const bDer = pemToDerB64(b.certPem)
    const cDer = pemToDerB64(c.certPem)
    const cCert = new X509Certificate(c.certPem)
    const pinned = require('node:crypto').createHash('sha256').update(cCert.raw).digest('hex')
    expect(() =>
      verifyAppleX509Chain([aDer, bDer, cDer], { pinnedRootFingerprintSha256: pinned }),
    ).toThrow(/APPLE_CERT_CHAIN_(ISSUER_MISMATCH|SIGNATURE_INVALID)/)
  })
})

describe('QA M4 — OID Apple spécifiques chaîne JWS', () => {
  it('encode les OID Apple en DER stables', () => {
    expect(encodeOidDerContent(APPLE_LEAF_RECEIPT_OID).toString('hex')).toBe(
      '2a864886f76364060b01',
    )
    expect(encodeOidDerContent(APPLE_WWDR_INTERMEDIATE_OID).toString('hex')).toBe(
      '2a864886f76364060201',
    )
  })

  it('refuse une chaîne crypto-valide sans OID Apple', () => {
    const { leafDer, intDer, rootDer, pinned } = buildTestChain({ withAppleOids: false })
    expect(() =>
      verifyAppleX509Chain([leafDer, intDer, rootDer], { pinnedRootFingerprintSha256: pinned }),
    ).toThrow(/APPLE_(LEAF|INTERMEDIATE)_OID_MISSING/)
  })

  it('refuse une chaîne avec OID intermédiaire seulement (feuille sans OID)', () => {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const base = buildTestChain({ withAppleOids: true })
    // Remplace la feuille par une feuille sans OID, signée par la même inter.
    const dir = base.dir
    execFileSync(
      'openssl',
      ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', path.join(dir, 'leaf2.key')],
      { stdio: 'pipe' },
    )
    execFileSync(
      'openssl',
      [
        'req',
        '-new',
        '-key',
        path.join(dir, 'leaf2.key'),
        '-out',
        path.join(dir, 'leaf2.csr'),
        '-subj',
        '/CN=Test Leaf NoOid',
      ],
      { stdio: 'pipe' },
    )
    execFileSync(
      'openssl',
      [
        'x509',
        '-req',
        '-in',
        path.join(dir, 'leaf2.csr'),
        '-CA',
        path.join(dir, 'int.pem'),
        '-CAkey',
        path.join(dir, 'int.key'),
        '-CAcreateserial',
        '-out',
        path.join(dir, 'leaf2.pem'),
        '-days',
        '30',
      ],
      { stdio: 'pipe' },
    )
    const leafDer = pemToDerB64(fs.readFileSync(path.join(dir, 'leaf2.pem'), 'utf8'))
    const leafCert = new X509Certificate(fs.readFileSync(path.join(dir, 'leaf2.pem')))
    expect(certHasAppleOid(leafCert, APPLE_LEAF_RECEIPT_OID)).toBe(false)
    expect(() =>
      verifyAppleX509Chain([leafDer, base.intDer, base.rootDer], {
        pinnedRootFingerprintSha256: base.pinned,
      }),
    ).toThrow(/APPLE_LEAF_OID_MISSING/)
  })

  it('JWS avec chaîne sans OID est rejeté même si signature ES256 locale ok', async () => {
    const { leafDer, intDer, rootDer, leafKeyPem } = buildTestChain({ withAppleOids: false })
    // Empreinte racine de test ≠ G3 → mismatch racine avant OID, donc on épingle via verifyAppleX509Chain uniquement.
    const jws = await signEs256Jws({
      payload: { transactionId: 't1', originalTransactionId: 'o1' },
      privateKeyPem: leafKeyPem,
      x5c: [leafDer, intDer, rootDer],
    })
    await expect(verifyAppleJwsSignature(jws)).rejects.toThrow(
      /APPLE_ROOT_FINGERPRINT_MISMATCH|APPLE_(LEAF|INTERMEDIATE)_OID_MISSING/,
    )
  })
})
