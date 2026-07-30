export function canRetryQueueJob(job: Record<string, unknown>): boolean {
  return job.status === "failed" && job.retryable !== false;
}

export function canDismissQueueJob(job: Record<string, unknown>): boolean {
  return ["failed", "skipped", "needs_review"].includes(String(job.status));
}
