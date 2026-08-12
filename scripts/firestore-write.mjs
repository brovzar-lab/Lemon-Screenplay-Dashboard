#!/usr/bin/env node
// firestore-write.mjs — write/upsert a document to Firestore using service account auth
//
// Usage:
//   firestore-write.mjs --collection <name> [--id <docId>] --data <JSON>
//
// If --id is omitted, Firestore auto-generates a document ID (add mode).
// If --id is provided, the document is upserted (fields are merged via updateMask).
//
// Reads GOOGLE_APPLICATION_CREDENTIALS_JSON env var for auth.
// Prints the document ID to stdout on success. Exits 1 on failure.

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

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val }
  }
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return { timestampValue: val }
    return { stringValue: val }
  }
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } }
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, toFirestoreValue(v)])),
      },
    }
  }
  return { stringValue: String(val) }
}

function toFirestoreFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)]))
}

async function main() {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null }

  const collection = get('--collection')
  const id = get('--id')
  const dataStr = get('--data')

  if (!collection || !dataStr) {
    console.error('Usage: firestore-write.mjs --collection <name> [--id <docId>] --data <JSON>')
    process.exit(1)
  }

  const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!saJson) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set')
    process.exit(1)
  }

  let serviceAccount, data
  try {
    serviceAccount = JSON.parse(saJson)
    data = JSON.parse(dataStr)
  } catch (e) {
    console.error(`JSON parse error: ${e.message}`)
    process.exit(1)
  }

  const token = await getFirestoreToken(serviceAccount)
  const fields = toFirestoreFields(data)
  const projectId = serviceAccount.project_id
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

  let res
  if (id) {
    const fieldPaths = Object.keys(data)
      .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join('&')
    res = await fetch(`${baseUrl}/${collection}/${id}?${fieldPaths}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
  } else {
    res = await fetch(`${baseUrl}/${collection}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
  }

  if (!res.ok) {
    console.error(`Firestore write failed: ${await res.text()}`)
    process.exit(1)
  }

  const docData = await res.json()
  const docId = docData.name?.split('/').pop() || id || '(unknown)'
  console.log(docId)
}

main().catch(e => { console.error(e.message); process.exit(1) })
