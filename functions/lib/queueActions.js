"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canRetryQueueJob = canRetryQueueJob;
function canRetryQueueJob(job) {
    return job.status === "failed" && job.retryable !== false;
}
//# sourceMappingURL=queueActions.js.map