#!/usr/bin/env python3
"""
Re-queue a single screenplay for V9 re-analysis.
Resets the content hash in the queue so the daemon doesn't skip it.

Usage: python3 requeue_one.py <doc_id>
  If no doc_id given, picks the first one alphabetically.
"""
import firebase_admin
from firebase_admin import credentials, firestore
import sys

cred = credentials.Certificate("/opt/lemon-ingest/service-account.json")
try:
    app = firebase_admin.get_app()
except ValueError:
    app = firebase_admin.initialize_app(cred)

db = firestore.client()

# Find the original queue job for this screenplay
queue_docs = db.collection("ingest-queue").get()

# Pick one to re-analyze — prefer one that has interesting content
# Let's use INVADERS (original, not a produced film)
target_title = sys.argv[1] if len(sys.argv) > 1 else None

chosen = None
for doc in queue_docs:
    d = doc.to_dict()
    if target_title and target_title.lower() in doc.id.lower():
        chosen = (doc.id, d)
        break
    if not target_title and d.get("status") == "complete":
        # Pick first completed one
        if chosen is None:
            chosen = (doc.id, d)

if not chosen:
    print("No suitable job found to re-queue.")
    print("Available jobs:")
    for doc in queue_docs:
        d = doc.to_dict()
        print(f"  {doc.id} | status={d.get('status')} | title={d.get('title','?')}")
    sys.exit(1)

doc_id, data = chosen
print(f"Re-queuing: {doc_id}")
print(f"  Title: {data.get('title', '?')}")
print(f"  Storage: {data.get('storage_path', '?')}")
print(f"  Previous status: {data.get('status')}")

# Reset the job so daemon re-processes it
# Clear content_hash so idempotency check won't skip it
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

print(f"  -> Reset to 'pending' with cleared content_hash")
print(f"  Daemon will pick this up within ~10 seconds")
print()
print("Monitor with: tail -f /var/log/lemon-daemon/daemon.log")
