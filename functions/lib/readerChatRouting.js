"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderChatRoutingFailure = exports.ReaderChatAttemptFailure = exports.READER_CHAT_ROUTING_POLICY_VERSION = void 0;
exports.parseReaderChatModelChoice = parseReaderChatModelChoice;
exports.initialReaderChatRoute = initialReaderChatRoute;
exports.objectiveFallbackRoute = objectiveFallbackRoute;
exports.executeReaderChatRoute = executeReaderChatRoute;
exports.readerChatRouteLabel = readerChatRouteLabel;
const modelRegistry_1 = require("./modelRegistry");
exports.READER_CHAT_ROUTING_POLICY_VERSION = "reader-chat-routing-v1";
class ReaderChatAttemptFailure extends Error {
    failureReason;
    attempt;
    status;
    constructor(message, failureReason, attempt, status) {
        super(message);
        this.failureReason = failureReason;
        this.attempt = attempt;
        this.status = status;
    }
}
exports.ReaderChatAttemptFailure = ReaderChatAttemptFailure;
class ReaderChatRoutingFailure extends Error {
    cause;
    route;
    attempts;
    constructor(cause, route, attempts) {
        super(cause.message);
        this.cause = cause;
        this.route = route;
        this.attempts = attempts;
    }
    get status() {
        return this.cause.status;
    }
    get failureReason() {
        return this.cause.failureReason;
    }
}
exports.ReaderChatRoutingFailure = ReaderChatRoutingFailure;
function parseReaderChatModelChoice(value) {
    if (value === undefined || value === null || value === "") {
        return modelRegistry_1.READER_CHAT_DEFAULT_CHOICE;
    }
    if (value === "auto" || value === "opus" || value === "fable")
        return value;
    throw new Error("Reader Chat model choice is not recognized.");
}
function initialReaderChatRoute(choice, deepReview = false) {
    if (deepReview) {
        return {
            requestedChoice: "fable",
            modelId: modelRegistry_1.READER_CHAT_MODELS.fable,
            effort: modelRegistry_1.READER_CHAT_EFFORT,
            reason: "producer_deep_review",
        };
    }
    if (choice === "fable") {
        return {
            requestedChoice: choice,
            modelId: modelRegistry_1.READER_CHAT_MODELS.fable,
            effort: modelRegistry_1.READER_CHAT_EFFORT,
            reason: "producer_selected_fable",
        };
    }
    return {
        requestedChoice: choice,
        modelId: modelRegistry_1.READER_CHAT_MODELS.opus,
        effort: modelRegistry_1.READER_CHAT_EFFORT,
        reason: choice === "auto" ? "auto_default_opus" : "producer_selected_opus",
    };
}
function objectiveFallbackRoute(choice, failure) {
    if (choice !== "auto")
        return null;
    const reasons = {
        refusal: "objective_fallback_refusal",
        invalid_grounded_answer: "objective_fallback_invalid_grounded_answer",
    };
    const reason = reasons[failure];
    if (!reason)
        return null;
    return {
        requestedChoice: choice,
        modelId: modelRegistry_1.READER_CHAT_MODELS.fable,
        effort: modelRegistry_1.READER_CHAT_EFFORT,
        reason,
        fallbackFrom: modelRegistry_1.READER_CHAT_MODELS.opus,
    };
}
async function executeReaderChatRoute(input) {
    let route = initialReaderChatRoute(input.choice, input.deepReview === true);
    const attempts = [];
    try {
        const result = await input.attempt(route);
        attempts.push(result.attempt);
        return { value: result.value, route, attempts };
    }
    catch (error) {
        if (!(error instanceof ReaderChatAttemptFailure))
            throw error;
        attempts.push(error.attempt);
        const fallback = objectiveFallbackRoute(input.choice, error.failureReason);
        if (!fallback)
            throw new ReaderChatRoutingFailure(error, route, attempts);
        route = fallback;
    }
    try {
        const result = await input.attempt(route);
        attempts.push(result.attempt);
        return { value: result.value, route, attempts };
    }
    catch (error) {
        if (!(error instanceof ReaderChatAttemptFailure))
            throw error;
        attempts.push(error.attempt);
        throw new ReaderChatRoutingFailure(error, route, attempts);
    }
}
function readerChatRouteLabel(reason) {
    const labels = {
        auto_default_opus: "Auto selected Opus 5",
        producer_selected_opus: "You selected Opus 5",
        producer_selected_fable: "You selected Fable 5",
        producer_deep_review: "You requested a Fable deep review",
        objective_fallback_refusal: "Escalated after Opus declined to answer",
        objective_fallback_invalid_grounded_answer: "Escalated after Opus returned an invalid grounded answer",
    };
    return labels[reason];
}
//# sourceMappingURL=readerChatRouting.js.map