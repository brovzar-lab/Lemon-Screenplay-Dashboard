export function canRetryQueueJob(job: Record<string, unknown>): boolean {
  return job.status === "failed" && job.retryable !== false;
}
