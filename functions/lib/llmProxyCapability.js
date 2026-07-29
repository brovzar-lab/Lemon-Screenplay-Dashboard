"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRUST_CONTRACT_VERSION = void 0;
exports.buildTrustCapability = buildTrustCapability;
exports.TRUST_CONTRACT_VERSION = "lemon-trust-manifest-v1";
function buildTrustCapability() {
    return {
        service: "llmProxy",
        trust_contract_version: exports.TRUST_CONTRACT_VERSION,
        response_id_supported: true,
    };
}
//# sourceMappingURL=llmProxyCapability.js.map