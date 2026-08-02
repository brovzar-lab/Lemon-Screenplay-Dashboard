export type PrivateReaderKey =
  | 'structure'
  | 'character'
  | 'craft'
  | 'concept'
  | 'emotion';

export type PrivateReaderPosition = 'unchanged' | 'clarified' | 'reconsidered';

export interface PrivateReaderCitation {
  page: number;
  note: string;
}

export interface PrivateReaderMessage {
  id: string;
  role: 'producer' | 'reader';
  text: string;
  citations: PrivateReaderCitation[];
  position?: PrivateReaderPosition;
  reconsideredPosition?: {
    summary: string;
    suggestedScore?: number;
  };
  createdAt: string | null;
}

export interface PrivateReaderConversation {
  threadId: string;
  exists: boolean;
  messages: PrivateReaderMessage[];
  provenance: {
    charterVersion?: string;
    charterSha256?: string;
    modelId?: string;
    modelRegistryVerifiedAt?: string;
    sealedProjectId?: string;
    sealedVersionId?: string;
  } | null;
}
