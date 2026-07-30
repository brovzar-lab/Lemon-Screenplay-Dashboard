"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canRetryQueueJob = canRetryQueueJob;
exports.canDismissQueueJob = canDismissQueueJob;
function canRetryQueueJob(job) {
    return job.status === "failed" && job.retryable !== false;
}
function canDismissQueueJob(job) {
    return ["failed", "skipped", "needs_review"].includes(String(job.status));
}
//# sourceMappingURL=queueActions.js.map