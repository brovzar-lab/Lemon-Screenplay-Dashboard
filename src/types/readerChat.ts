export type PrivateReaderKey =
  | 'structure'
  | 'character'
  | 'craft'
  | 'concept'
  | 'emotion';

export type PrivateReaderPosition = 'unchanged' | 'clarified' | 'reconsidered';
export type PrivateReaderModelChoice = 'auto' | 'opus' | 'fable';

export interface PrivateReaderModelUsage {
  input_tokens?: number;
  output_tokens?: number;
  actual_cost_microusd?: number;
  actual_cost_usd?: number;
}

export interface PrivateReaderModelAttempt {
  modelId: string;
  outcome: 'success' | 'failed';
  failureReason?: string;
  responseId?: string;
  usage?: PrivateReaderModelUsage;
}

export interface PrivateReaderRoutingAudit {
  id: string;
  requestedModelChoice?: PrivateReaderModelChoice;
  routeReason?: string;
  routeLabel?: string;
  failureReason?: string;
  error?: string;
  modelAttempts: PrivateReaderModelAttempt[];
  createdAt: string | null;
}

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
  modelId?: string;
  modelResponseId?: string | null;
  effort?: string;
  requestedModelChoice?: PrivateReaderModelChoice;
  routeReason?: string;
  routeLabel?: string;
  fallbackFrom?: string;
  routingPolicyVersion?: string;
  modelAttempts?: PrivateReaderModelAttempt[];
  usage?: PrivateReaderModelUsage;
  simulated?: boolean;
  createdAt: string | null;
}

export interface PrivateReaderConversation {
  threadId: string;
  exists: boolean;
  messages: PrivateReaderMessage[];
  routingAudits?: PrivateReaderRoutingAudit[];
  provenance: {
    charterVersion?: string;
    charterSha256?: string;
    modelId?: string;
    effort?: string;
    requestedModelChoice?: PrivateReaderModelChoice;
    routeReason?: string;
    routeLabel?: string;
    fallbackFrom?: string;
    routingPolicyVersion?: string;
    modelAttempts?: PrivateReaderModelAttempt[];
    modelRegistryVerifiedAt?: string;
    sealedProjectId?: string;
    sealedVersionId?: string;
  } | null;
}
