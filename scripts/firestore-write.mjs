#!/usr/bin/env node
/**
 * Writes a JSON document to a Firestore collection.
 *
 * Usage:
 *   node scripts/firestore-write.mjs \
 *     --collection <name> \
 *     --data '{"field":"value",...}' \
 *     [--id <docId>]          # optional — auto-generated if omitted
 *
 * Required env:
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON  — full service account JSON (stringified)
 *   VITE_FIREBASE_PROJECT_ID             — Firebase project ID (or set FIREBASE_PROJECT_ID)
 *
 * Exit codes: 0 = success, 1 = error. Prints the document ID to stdout on success.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// ── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(`--${name}`)
  return i !== -1 ? args[i + 1] : null
}

const collection = flag('collection')
const id = flag('id')          // optional
const rawData = flag('data')

if (!collection || !rawData) {
  console.error('Usage: node scripts/firestore-write.mjs --collection <name> --data \'{"k":"v"}\' [--id <docId>]')
  process.exit(1)
}

let data
try {
  data = JSON.parse(rawData)
} catch {
  console.error('--data must be valid JSON')
  process.exit(1)
}

// ── Firebase Admin init ───────────────────────────────────────────────────────
const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
if (!credJson) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON env var is required')
  process.exit(1)
}

let serviceAccount
try {
  serviceAccount = JSON.parse(credJson)
} catch {
  console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON')
  process.exit(1)
}

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  serviceAccount.project_id

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId })
}

const db = getFirestore()

// ── Write ─────────────────────────────────────────────────────────────────────
try {
  let ref
  if (id) {
    ref = db.collection(collection).doc(id)
    await ref.set(data, { merge: true })
  } else {
    ref = await db.collection(collection).add(data)
  }
  console.log(ref.id)
  process.exit(0)
} catch (err) {
  console.error('Firestore write failed:', err.message)
  process.exit(1)
}
