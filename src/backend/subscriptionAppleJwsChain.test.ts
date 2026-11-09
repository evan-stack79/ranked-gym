/**
 * QA B1 — chaîne x5c Apple : chaque maillon signé, racine G3 épinglée.
 */
import { createPrivateKey, generateKeyPairSync, X509Certificate } from 'node:crypto'
import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import {
  APPLE_ROOT_CA_G3_FINGERPRINT_SHA256,
  APPLE_ROOT_CA_G3_PEM,
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
      /APPLE_CERT_CHAIN_(ISSUER_MISMATCH|SIGNATURE_INVALID)/,
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
    await expect(verifyAppleJwsSignature(jws)).rejects.toThrow(
      /APPLE_CERT_CHAIN_(ISSUER_MISMATCH|SIGNATURE_INVALID)/,
    )
  })

  it('accepte une chaîne valide Root→Inter→Leaf (empreinte racine de test)', () => {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    const fs = require('node:fs') as typeof import('node:fs')
    const os = require('node:os') as typeof import('node:os')
    const path = require('node:path') as typeof import('node:path')
    const crypto = require('node:crypto') as typeof import('node:crypto')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pro-chain-'))

    // Root
    execFileSync(
      'openssl',
      [
        'ecparam',
        '-name',
        'prime256v1',
        '-genkey',
        '-noout',
        '-out',
        path.join(dir, 'root.key'),
      ],
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
    // Intermediate
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
      ],
      { stdio: 'pipe' },
    )
    // Leaf
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
      ],
      { stdio: 'pipe' },
    )

    const leafDer = pemToDerB64(fs.readFileSync(path.join(dir, 'leaf.pem'), 'utf8'))
    const intDer = pemToDerB64(fs.readFileSync(path.join(dir, 'int.pem'), 'utf8'))
    const rootDer = pemToDerB64(fs.readFileSync(path.join(dir, 'root.pem'), 'utf8'))
    const rootCert = new X509Certificate(fs.readFileSync(path.join(dir, 'root.pem')))
    const pinned = crypto.createHash('sha256').update(rootCert.raw).digest('hex')

    expect(() =>
      verifyAppleX509Chain([leafDer, intDer, rootDer], { pinnedRootFingerprintSha256: pinned }),
    ).not.toThrow()
  })

  it('refuse une chaîne invalide (maillon non signé par le suivant)', () => {
    const a = buildSelfSignedEcCertPem('a')
    const b = buildSelfSignedEcCertPem('b')
    const aDer = pemToDerB64(a.certPem)
    const bDer = pemToDerB64(b.certPem)
    const bCert = new X509Certificate(b.certPem)
    const pinned = require('node:crypto').createHash('sha256').update(bCert.raw).digest('hex')
    expect(() =>
      verifyAppleX509Chain([aDer, bDer], { pinnedRootFingerprintSha256: pinned }),
    ).toThrow(/APPLE_CERT_CHAIN_(ISSUER_MISMATCH|SIGNATURE_INVALID)/)
  })
})
