import { getPrisma, SubmissionStatus } from '@koarena/db'

/**
 * The submission reaper.
 *
 * A submission can get stuck: the worker crashes, the queue is drained, the
 * job is discarded after its last attempt. A row that says QUEUED forever is
 * worse than one that says it failed, so anything that has been waiting too
 * long is marked as an error.
 */

/** How long a submission may wait before it is considered abandoned. */
const STALE_AFTER_MS = 5 * 60 * 1000

export async function reapStaleSubmissions(): Promise<number> {
  const prisma = getPrisma()

  const cutoff = new Date(Date.now() - STALE_AFTER_MS)

  const stale = await prisma.submission.findMany({
    where: {
      status: { in: [SubmissionStatus.QUEUED, SubmissionStatus.RUNNING] },
      submittedAt: { lt: cutoff },
    },
    select: { id: true },
  })

  if (stale.length === 0) return 0

  await prisma.submission.updateMany({
    where: { id: { in: stale.map((submission) => submission.id) } },
    data: {
      status: SubmissionStatus.ERROR,
      verdict: 'INTERNAL_ERROR',
      stderr:
        'The judge never returned a verdict for this submission. Ask the organizer to re-run it.',
      judgedAt: new Date(),
    },
  })

  return stale.length
}

/** Mark one submission as failed — used when a job runs out of attempts. */
export async function markSubmissionFailed(
  submissionId: string,
  reason: string,
): Promise<void> {
  const prisma = getPrisma()

  await prisma.submission.updateMany({
    where: { id: submissionId, status: SubmissionStatus.QUEUED },
    data: {
      status: SubmissionStatus.ERROR,
      verdict: 'INTERNAL_ERROR',
      stderr: reason,
      judgedAt: new Date(),
    },
  })
}
