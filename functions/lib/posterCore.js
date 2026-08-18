"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSTER_MODELS = exports.POSTER_LEASE_MS = void 0;
exports.normalizePosterModel = normalizePosterModel;
exports.normalizePosterVerdict = normalizePosterVerdict;
exports.isPosterEligible = isPosterEligible;
exports.posterDisposition = posterDisposition;
exports.isPosterAdmin = isPosterAdmin;
exports.isPosterVersionCurrent = isPosterVersionCurrent;
exports.canClaimPosterRequest = canClaimPosterRequest;
exports.isCurrentV9Analysis = isCurrentV9Analysis;
exports.POSTER_LEASE_MS = 10 * 60 * 1000;
exports.POSTER_MODELS = {
    economy: { id: 'gemini-3.1-flash-lite-image', costMicrousd: 33_600 },
    studio: { id: 'gemini-3.1-flash-image', costMicrousd: 67_000 },
    premium: { id: 'gemini-3-pro-image', costMicrousd: 134_000 },
};
function normalizePosterModel(value) {
    return value === 'economy' || value === 'studio' || value === 'premium' ? value : null;
}
function normalizePosterVerdict(value) {
    const normalized = String(value ?? '')
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    if (normalized === 'pass' || normalized === 'consider' || normalized === 'recommend') {
        return normalized;
    }
    return normalized === 'film_now' ? 'film_now' : null;
}
function isPosterEligible(verdict) {
    return verdict !== null && verdict !== 'pass';
}
function posterDisposition(verdict) {
    if (verdict === 'pass')
        return 'withhold';
    return isPosterEligible(verdict) ? 'generate' : 'skip';
}
function isPosterAdmin(email) {
    return typeof email === 'string' && email.toLowerCase() === 'billy@lemonfilms.com';
}
function isPosterVersionCurrent(latestVersion, expectedVersion) {
    return latestVersion === expectedVersion;
}
function canClaimPosterRequest(input) {
    if (input.priorJobExists || !isPosterVersionCurrent(input.currentVersion, input.expectedVersion))
        return false;
    const activeLease = input.posterStatus === 'generating' &&
        input.posterVersion === input.expectedVersion &&
        input.posterRequestedAtMs !== null &&
        input.nowMs - input.posterRequestedAtMs < exports.POSTER_LEASE_MS;
    return !activeLease;
}
function isCurrentV9Analysis(value) {
    return value === 'v9_archaeology';
}
//# sourceMappingURL=posterCore.js.map