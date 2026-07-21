import { buildVerifiedIdentity } from './analysisIdentity';

/** Find the display name of an analysis with the same verified PDF bytes. */
export async function findAnalysisByContentHash(hash: string): Promise<string | null> {
  buildVerifiedIdentity(hash);

  try {
    const { collection, getDocs, limit, query, where } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    const snapshot = await getDocs(
      query(
        collection(db, 'uploaded_analyses'),
        where('content_hash', '==', hash),
        limit(1),
      ),
    );
    if (snapshot.empty) return null;

    const document = snapshot.docs[0];
    const data = document.data() as Record<string, unknown>;
    const analysis = (data.analysis as Record<string, unknown>) || {};
    return (
      (analysis.title as string) ||
      (data.source_file as string) ||
      document.id
    );
  } catch (error) {
    console.warn('[upload] content-hash dedup check failed:', error);
    return null;
  }
}
