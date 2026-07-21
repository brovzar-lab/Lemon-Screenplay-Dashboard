import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import cors from "cors";
import { authenticateProxyRequest } from "./proxyAuth";
import { buildReanalysisCopyPlan } from "./reanalysisQueue";
import type { IngestModel } from "./ingestQueue";

const corsMiddleware = cors({
  origin: [
    "https://lemon-screenplay-dashboard.web.app",
    "https://lemon-screenplay-dashboard.firebaseapp.com",
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
});

type QueueAction = "retry" | "dismiss" | "analyze_anyway" | "reanalyze";
const MODELS = new Set(["haiku", "sonnet", "opus", "hybrid", "auto"]);
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET
  ?? "lemon-screenplay-dashboard.firebasestorage.app";

export const queueManager = onRequest(
  { region: "us-central1", timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => {
    corsMiddleware(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed." });
        return;
      }

      const auth = await authenticateProxyRequest(req, "");
      if (!auth.ok || auth.kind !== "user") {
        res.status(auth.ok ? 403 : auth.status).json({ error: "Admin sign-in required." });
        return;
      }

      const db = getFirestore();
      const profile = await db.collection("users").doc(auth.uid).get();
      if (!profile.exists || profile.get("role") !== "admin") {
        res.status(403).json({ error: "Admin access required." });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const action = body.action as QueueAction;
      const jobIds = Array.isArray(body.jobIds)
        ? body.jobIds.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 100)
        : [];
      const model = typeof body.model === "string" && MODELS.has(body.model) ? body.model : "sonnet";

      if (action === "reanalyze") {
        const screenplayIds = Array.isArray(body.screenplayIds)
          ? body.screenplayIds
            .filter((id): id is string => typeof id === "string" && id.length > 0)
            .slice(0, 25)
          : [];
        if (!screenplayIds.length) {
          res.status(400).json({ error: "At least one screenplay is required for re-analysis." });
          return;
        }

        const refs = screenplayIds.map((id) => db.collection("uploaded_analyses").doc(id));
        const snapshots = await db.getAll(...refs);
        const storage = getStorage();
        const queued: Array<{ screenplayId: string; storagePath: string }> = [];
        const failed: Array<{ screenplayId: string; error: string }> = [];

        for (const snapshot of snapshots) {
          try {
            if (!snapshot.exists) throw new Error("Screenplay project not found.");
            const plan = buildReanalysisCopyPlan({
              screenplayId: snapshot.id,
              screenplay: snapshot.data() ?? {},
              requestedModel: model as IngestModel,
              uploadId: randomUUID(),
              destinationBucket: STORAGE_BUCKET,
            });
            const sourceBucket = storage.bucket(plan.source.bucket);
            const sourceFile = sourceBucket.file(plan.source.objectName, {
              generation: plan.source.generation,
            });
            const destinationBucket = storage.bucket(plan.destination.bucket);
            const destinationFile = destinationBucket.file(plan.destination.objectName);
            await sourceFile.copy(destinationFile, {
              contentType: "application/pdf",
              metadata: plan.destination.metadata,
              preconditionOpts: { ifGenerationMatch: 0 },
            });
            queued.push({
              screenplayId: snapshot.id,
              storagePath: `gs://${plan.destination.bucket}/${plan.destination.objectName}`,
            });
          } catch (error) {
            failed.push({
              screenplayId: snapshot.id,
              error: error instanceof Error ? error.message : "Re-analysis could not be queued.",
            });
          }
        }

        res.status(queued.length ? 200 : 400).json({ queued, failed });
        return;
      }

      if (!jobIds.length || !["retry", "dismiss", "analyze_anyway"].includes(action)) {
        res.status(400).json({ error: "A valid action and at least one job are required." });
        return;
      }

      const refs = jobIds.map((id) => db.collection("ingest-queue").doc(id));
      const snapshots = await db.getAll(...refs);
      const batch = db.batch();
      let updated = 0;

      snapshots.forEach((snapshot) => {
        if (!snapshot.exists) return;
        const data = snapshot.data() ?? {};
        const status = data.status as string;
        const reason = data.skip_reason as string;

        if (action === "retry" && status === "failed") {
          batch.update(snapshot.ref, {
            status: "pending",
            attempt_count: 0,
            requested_model: model,
            last_error: null,
            worker_id: null,
            processing_started_at: null,
            processing_completed_at: null,
            last_heartbeat_at: null,
            resolution_dismissed: false,
            resolution_updated_at: FieldValue.serverTimestamp(),
          });
          updated += 1;
        } else if (action === "dismiss" && ["failed", "skipped"].includes(status)) {
          batch.update(snapshot.ref, {
            resolution_dismissed: true,
            resolution_updated_at: FieldValue.serverTimestamp(),
          });
          updated += 1;
        } else if (
          action === "analyze_anyway" &&
          status === "skipped" &&
          ["tmdb_already_produced", "already_complete"].includes(reason)
        ) {
          batch.update(snapshot.ref, {
            status: "pending",
            attempt_count: 0,
            requested_model: model,
            last_error: null,
            worker_id: null,
            processing_started_at: null,
            processing_completed_at: null,
            last_heartbeat_at: null,
            resolution_dismissed: false,
            bypass_tmdb: reason === "tmdb_already_produced",
            bypass_duplicate: reason === "already_complete",
            resolution_updated_at: FieldValue.serverTimestamp(),
          });
          updated += 1;
        }
      });

      if (updated) await batch.commit();
      res.status(200).json({ updated });
    });
  },
);
