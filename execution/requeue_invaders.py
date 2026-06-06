#!/usr/bin/env python3
"""Find queue job for INVADERS and re-queue it for V9 re-analysis."""
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("/opt/lemon-ingest/service-account.json")
try:
    app = firebase_admin.get_app()
except ValueError:
    app = firebase_admin.initialize_app(cred)

db = firestore.client()

# Find the INVADERS job
from google.cloud.firestore_v1.base_query import FieldFilter
docs = db.collection("ingest-queue").where(filter=FieldFilter("status", "==", "complete")).get()

target = None
for doc in docs:
    d = doc.to_dict()
    sp = str(d.get("storage_path", ""))
    if "INVADER" in sp.upper():
        target = (doc.id, d)
        print("Found: " + doc.id + " -> " + sp)
        break

if not target:
    print("INVADERS not found in completed jobs. Listing all completed:")
    for doc in docs:
        d = doc.to_dict()
        sp = str(d.get("storage_path", ""))
        print("  " + doc.id + " -> " + sp)
    exit(1)

doc_id = target[0]
print("Re-queuing " + doc_id + " for V9 re-analysis...")

db.collection("ingest-queue").document(doc_id).update({
    "status": "pending",
    "content_hash": None,
    "error": None,
    "worker_id": None,
    "heartbeat": None,
    "started_at": None,
    "completed_at": None,
    "telemetry": None,
})

print("DONE - daemon will pick up within ~10s")
print("Monitor: tail -f /var/log/lemon-daemon/daemon.log")
