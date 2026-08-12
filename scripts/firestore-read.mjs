#!/usr/bin/env node
// firestore-read.mjs — read recent documents from a Firestore collection
//
// Usage:
//   firestore-read.mjs --collection <name> [--since <hours>] [--limit <n>]
//
// Defaults: --since 48 (past 48 hours), --limit 50
// Filters by `createdAt` field >= (now - sinceHours).
// Prints a JSON array of documents to stdout. Exits 1 on failure.
//
// Reads GOOGLE_APPLICATION_CREDENTIALS_JSON env var for auth.

import crypto from 'crypto'

async function getFirestoreToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(serviceAccount.private_key, 'base64url')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${signature}`,
    }),
  })
  if (!res.ok) throw new Error(`Firestore auth failed: ${await res.text()}`)
  return (await res.json()).access_token
}

function fromFirestoreValue(val) {
  if ('nullValue' in val) return null
  if ('booleanValue' in val) return val.booleanValue
  if ('integerValue' in val) return parseInt(val.integerValue, 10)
  if ('doubleValue' in val) return val.doubleValue
  if ('timestampValue' in val) return val.timestampValue
  if ('stringValue' in val) return val.stringValue
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue)
  if ('mapValue' in val) return fromFirestoreFields(val.mapValue.fields || {})
  return null
}

function fromFirestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromFirestoreValue(v)]))
}

async function main() {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null }

  const collection = get('--collection')
  const sinceHours = parseInt(get('--since') || '48', 10)
  const limit = parseInt(get('--limit') || '50', 10)

  if (!collection) {
    console.error('Usage: firestore-read.mjs --collection <name> [--since <hours>] [--limit <n>]')
    process.exit(1)
  }

  const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!saJson) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set')
    process.exit(1)
  }

  let serviceAccount
  try {
    serviceAccount = JSON.parse(saJson)
  } catch (e) {
    console.error(`JSON parse error: ${e.message}`)
    process.exit(1)
  }

  const token = await getFirestoreToken(serviceAccount)
  const projectId = serviceAccount.project_id

  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString()

  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'createdAt' },
          op: 'GREATER_THAN_OR_EQUAL',
          value: { timestampValue: since },
        },
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit,
    },
  }

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody),
    }
  )

  if (!res.ok) {
    console.error(`Firestore read failed: ${await res.text()}`)
    process.exit(1)
  }

  const results = await res.json()
  const docs = results
    .filter(r => r.document)
    .map(r => ({
      id: r.document.name.split('/').pop(),
      ...fromFirestoreFields(r.document.fields || {}),
    }))

  console.log(JSON.stringify(docs, null, 2))
}

main().catch(e => { console.error(e.message); process.exit(1) })
