#!/usr/bin/env python3
"""
Lemon Firestore Admin Script
1. Finds and resets stuck 'queued' jobs → 'pending'
2. Lists all uploaded_analyses documents with version info
3. Patches collection field for docs missing it
"""
import firebase_admin
from firebase_admin import credentials, firestore
import sys

# Init Firebase
cred = credentials.Certificate("/opt/lemon-ingest/service-account.json")
try:
    app = firebase_admin.get_app()
except ValueError:
    app = firebase_admin.initialize_app(cred)

db = firestore.client()

# === 1. Find and reset stuck queued jobs ===
print("=== STUCK JOBS (status=queued) ===")
queued = db.collection("ingest-queue").where("status", "==", "queued").get()
if not queued:
    print("  No stuck jobs found.")
else:
    for doc in queued:
        d = doc.to_dict()
        title = d.get("title", "unknown")
        print(f"  Resetting: {doc.id} ({title}) queued -> pending")
        db.collection("ingest-queue").document(doc.id).update({
            "status": "pending",
            "error": None,
            "worker_id": None,
            "heartbeat": None,
        })
        print(f"    DONE")

# === 2. List all uploaded_analyses ===
print()
print("=== UPLOADED_ANALYSES DOCS ===")
docs = db.collection("uploaded_analyses").get()
for doc in docs:
    d = doc.to_dict()
    av = d.get("analysis_version", "?")
    title = d.get("title", "?")
    coll_id = d.get("collection_id", "?")
    coll = d.get("collection", "MISSING")
    print(f"  {doc.id} | v={av} | coll_id={coll_id} | collection={coll} | {title}")
print(f"  Total: {len(docs)}")

# === 3. Patch collection field where missing ===
print()
print("=== PATCHING MISSING 'collection' FIELD ===")
patched = 0
for doc in docs:
    d = doc.to_dict()
    if "collection" not in d and "collection_id" in d:
        cid = d["collection_id"]
        print(f"  Patching {doc.id}: collection <- {cid}")
        db.collection("uploaded_analyses").document(doc.id).update({
            "collection": cid,
        })
        patched += 1
print(f"  Patched {patched} documents")

print()
print("DONE")
