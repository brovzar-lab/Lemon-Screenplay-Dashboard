import { buildVerifiedIdentity } from '@/lib/analysisIdentity';

/** Find the display name of an analysis with the same verified PDF bytes. */
export async function findAnalysisByContentHash(hash: string): Promise<string | null> {
  buildVerifiedIdentity(hash);

  try {
    const { collection, getDocs, limit, query, where } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    for (const collectionId of ['uploaded_analyses', 'coverage_v1_reports']) {
      const snapshot = await getDocs(
      query(
        collection(db, collectionId),
        where('content_hash', '==', hash),
        limit(1),
      ),
    );
      if (snapshot.empty) continue;

    const document = snapshot.docs[0];
    const data = document.data() as Record<string, unknown>;
    const analysis = (data.analysis as Record<string, unknown>) || {};
    return (
      (analysis.title as string) ||
      (data.title as string) ||
      (data.source_file as string) ||
      document.id
    );
    }
    return null;
  } catch (error) {
    console.warn('[upload] content-hash dedup check failed:', error);
    return null;
  }
}
