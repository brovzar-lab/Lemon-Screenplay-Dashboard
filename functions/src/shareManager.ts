import cors from "cors";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";

import { authenticateProxyRequest } from "./proxyAuth";
import {
  buildShareAuthorityRecord,
  buildSharedViewRecord,
  resolveAuthoritativeShare,
} from "./shareCore";

const corsMiddleware = cors({
  origin: [
    "https://lemon-screenplay-dashboard.web.app",
    "https://lemon-screenplay-dashboard.firebaseapp.com",
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
});

type UnknownRecord = Record<string, unknown>;

function documentId(value: unknown, label: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.includes("/") || normalized.length > 500) {
    throw Object.assign(new Error(`${label} is not a valid document ID.`), {
      status: 400,
    });
  }
  return normalized;
}

async function requireLemonUser(
  req: Parameters<typeof authenticateProxyRequest>[0],
): Promise<void> {
  const auth = await authenticateProxyRequest(req, "");
  if (!auth.ok || auth.kind !== "user") {
    throw Object.assign(new Error("Lemon sign-in required."), { status: 401 });
  }
  if (!auth.emailVerified || !auth.email.toLowerCase().endsWith("@lemonfilms.com")) {
    throw Object.assign(new Error("A verified Lemon Studios account is required."), {
      status: 403,
    });
  }
  const profile = await getFirestore().collection("users").doc(auth.uid).get();
  const bootstrapAdmin = auth.email.toLowerCase() === "billy@lemonfilms.com";
  if (
    !bootstrapAdmin
    && (!profile.exists || !["admin", "reader"].includes(profile.get("role")))
  ) {
    throw Object.assign(new Error("Lemon team access required."), { status: 403 });
  }
}

async function resolveShareRecord(
  db: ReturnType<typeof getFirestore>,
  token: string,
  knownShare?: UnknownRecord,
): Promise<UnknownRecord> {
  const [shareSnapshot, shareAuthoritySnapshot] = await Promise.all([
    knownShare
      ? Promise.resolve(undefined)
      : db.collection("shared_views").doc(token).get(),
    db.collection("share_authorities").doc(token).get(),
  ]);
  const share = knownShare ?? shareSnapshot?.data();
  if (!share || !shareAuthoritySnapshot.exists) {
    throw Object.assign(new Error("Share link not found."), { status: 404 });
  }
  const shareAuthority = shareAuthoritySnapshot.data() as UnknownRecord;
  const projectId = documentId(shareAuthority.projectId, "Project");
  const versionId = documentId(shareAuthority.versionId, "Analysis version");
  const parentRef = db.collection("uploaded_analyses").doc(projectId);
  const [parentSnapshot, versionSnapshot, versionAuthoritySnapshot] = await Promise.all([
    parentRef.get(),
    parentRef.collection("versions").doc(versionId).get(),
    parentRef.collection("version_authorities").doc(versionId).get(),
  ]);
  if (!parentSnapshot.exists || !versionSnapshot.exists || !versionAuthoritySnapshot.exists) {
    throw Object.assign(new Error("Canonical analysis not found."), { status: 404 });
  }
  return resolveAuthoritativeShare({
    token,
    share,
    authority: shareAuthority,
    parent: parentSnapshot.data(),
    version: versionSnapshot.data(),
    versionAuthority: versionAuthoritySnapshot.data(),
  });
}

function shareMetadata(record: UnknownRecord): UnknownRecord {
  return {
    authorityVersion: record.authorityVersion,
    token: record.token,
    screenplayId: record.screenplayId,
    screenplayTitle: record.screenplayTitle,
    includeNotes: record.includeNotes,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

export const shareManager = onRequest(
  { region: "us-central1", timeoutSeconds: 30, memory: "256MiB" },
  (req, res) => corsMiddleware(req, res, async () => {
    try {
      if (req.method === "GET") {
        const db = getFirestore();
        if (req.query.token !== undefined) {
          const token = documentId(req.query.token, "Share token");
          const record = await resolveShareRecord(db, token);
          res.set("Cache-Control", "private, no-store");
          res.status(200).json(record);
          return;
        }
        await requireLemonUser(req);
        const screenplayId = req.query.screenplayId === undefined
          ? undefined
          : documentId(req.query.screenplayId, "Screenplay");
        const collection = db.collection("shared_views");
        const snapshots = screenplayId
          ? await collection.where("screenplayId", "==", screenplayId).get()
          : await collection.get();
        const resolved = await Promise.all(snapshots.docs.map(async (snapshot) => {
          try {
            return await resolveShareRecord(
              db,
              snapshot.id,
              snapshot.data() as UnknownRecord,
            );
          } catch {
            return null;
          }
        }));
        const views = resolved
          .filter((record): record is UnknownRecord => record !== null)
          .map(shareMetadata);
        res.set("Cache-Control", "private, no-store");
        res.status(200).json({ views });
        return;
      }
      if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
        res.status(405).json({ error: "Method not allowed." });
        return;
      }
      await requireLemonUser(req);
      const body = (req.body ?? {}) as UnknownRecord;

      if (req.method === "DELETE") {
        const token = documentId(body.token, "Share token");
        const screenplayId = documentId(body.screenplayId, "Screenplay");
        const db = getFirestore();
        const shareRef = db.collection("shared_views").doc(token);
        const authorityRef = db.collection("share_authorities").doc(token);
        await db.runTransaction(async (transaction) => {
          const shareSnapshot = await transaction.get(shareRef);
          if (shareSnapshot.exists && shareSnapshot.get("screenplayId") !== screenplayId) {
            throw Object.assign(new Error("The share does not belong to this screenplay."), {
              status: 409,
            });
          }
          transaction.delete(shareRef);
          transaction.delete(authorityRef);
        });
        res.status(204).send("");
        return;
      }

      if (req.method === "PATCH") {
        const token = documentId(body.token, "Share token");
        const screenplayId = documentId(body.screenplayId, "Screenplay");
        const db = getFirestore();
        const shareRef = db.collection("shared_views").doc(token);
        const authorityRef = db.collection("share_authorities").doc(token);
        const result = await db.runTransaction(async (transaction) => {
          const [shareSnapshot, authoritySnapshot] = await Promise.all([
            transaction.get(shareRef),
            transaction.get(authorityRef),
          ]);
          if (!shareSnapshot.exists || !authoritySnapshot.exists) {
            throw Object.assign(new Error("Share link not found."), { status: 404 });
          }
          const authority = authoritySnapshot.data() as UnknownRecord;
          const projectId = documentId(authority.projectId, "Project");
          const versionId = documentId(authority.versionId, "Analysis version");
          const parentRef = db.collection("uploaded_analyses").doc(projectId);
          const versionRef = parentRef.collection("versions").doc(versionId);
          const versionAuthorityRef = parentRef
            .collection("version_authorities")
            .doc(versionId);
          const [parentSnapshot, versionSnapshot, versionAuthoritySnapshot] = await Promise.all([
            transaction.get(parentRef),
            transaction.get(versionRef),
            transaction.get(versionAuthorityRef),
          ]);
          if (!parentSnapshot.exists || !versionSnapshot.exists || !versionAuthoritySnapshot.exists) {
            throw Object.assign(new Error("Canonical analysis not found."), { status: 404 });
          }
          resolveAuthoritativeShare({
            token,
            share: shareSnapshot.data(),
            authority,
            parent: parentSnapshot.data(),
            version: versionSnapshot.data(),
            versionAuthority: versionAuthoritySnapshot.data(),
          });
          if (shareSnapshot.get("screenplayId") !== screenplayId) {
            throw Object.assign(new Error("The share does not belong to this screenplay."), {
              status: 409,
            });
          }
          const createdAt = typeof authority.createdAt === "string"
            ? new Date(authority.createdAt)
            : new Date(Number.NaN);
          const record = buildSharedViewRecord({
            projectId,
            versionId,
            screenplayId,
            parent: parentSnapshot.data(),
            version: versionSnapshot.data(),
            versionAuthority: versionAuthoritySnapshot.data(),
            includeNotes: body.includeNotes === true,
            notes: body.notes,
            now: createdAt,
            token,
          });
          if (record.expiresAtMillis !== authority.expiresAtMillis) {
            throw new Error("The share authority expiry changed during update.");
          }
          transaction.set(shareRef, record);
          return record;
        });
        res.status(200).json({ includeNotes: result.includeNotes });
        return;
      }

      const projectId = documentId(body.projectId, "Project");
      const versionId = documentId(body.versionId, "Analysis version");
      const screenplayId = documentId(body.screenplayId, "Screenplay");
      const db = getFirestore();
      const parentRef = db.collection("uploaded_analyses").doc(projectId);
      const versionRef = parentRef.collection("versions").doc(versionId);
      const versionAuthorityRef = parentRef
        .collection("version_authorities")
        .doc(versionId);
      const result = await db.runTransaction(async (transaction) => {
        const [parentSnapshot, versionSnapshot, versionAuthoritySnapshot] = await Promise.all([
          transaction.get(parentRef),
          transaction.get(versionRef),
          transaction.get(versionAuthorityRef),
        ]);
        if (!parentSnapshot.exists || !versionSnapshot.exists || !versionAuthoritySnapshot.exists) {
          throw Object.assign(new Error("The exact analysis version does not exist."), {
            status: 404,
          });
        }
        const record = buildSharedViewRecord({
          projectId,
          versionId,
          screenplayId,
          parent: parentSnapshot.data(),
          version: versionSnapshot.data(),
          versionAuthority: versionAuthoritySnapshot.data(),
          includeNotes: body.includeNotes === true,
          notes: body.notes,
        });
        transaction.create(
          db.collection("shared_views").doc(String(record.token)),
          record,
        );
        transaction.create(
          db.collection("share_authorities").doc(String(record.token)),
          buildShareAuthorityRecord({ record, projectId, versionId, version: versionSnapshot.data() }),
        );
        return record;
      });
      res.status(200).json({
        token: result.token,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      const status = typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : 400;
      res.status(status).json({
        error: error instanceof Error ? error.message : "Share request failed.",
      });
    }
  }),
);
