export const TRUST_CONTRACT_VERSION = "lemon-trust-manifest-v1";

export function buildTrustCapability() {
  return {
    service: "llmProxy",
    trust_contract_version: TRUST_CONTRACT_VERSION,
    response_id_supported: true,
  } as const;
}
