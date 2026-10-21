import 'dotenv/config'

import { getQueueConnection, JUDGE_QUEUE, type JudgeJob } from '@koarena/queue'
import { Worker } from 'bullmq'

import { judgeSubmission } from './judge'
import { markSubmissionFailed, reapStaleSubmissions } from './reaper'

/**
 * The judging worker.
 *
 * It runs on the host that can reach the sandbox — a small machine separate
 * from the web app. It shares the database and the queue with the app, so a
 * submission submitted in one place is judged in the other.
 */

// A worker pointed at the wrong database fails every job with "submission
// does not exist", which looks exactly like a broken app. Say it plainly
// instead.
const missing = ['DATABASE_URL', 'REDIS_URL'].filter(
  (name) => !process.env[name],
)

if (missing.length > 0) {
  console.error(
    `[judge] ${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set.\n` +
      '        Copy apps/judge/.env.example to apps/judge/.env and point it at the\n' +
      '        same database and Redis as apps/web/.env.',
  )
  process.exit(1)
}

const concurrency = Number(process.env.JUDGE_CONCURRENCY ?? 4)

const worker = new Worker<JudgeJob>(
  JUDGE_QUEUE,
  async (job) => {
    await judgeSubmission(job.data)
  },
  {
    connection: getQueueConnection(),
    concurrency,
  },
)

worker.on('completed', (job) => {
  console.log(`[judge] submission ${job.data.submissionId} judged`)
})

worker.on('failed', (job, error) => {
  console.error(
    `[judge] submission ${job?.data.submissionId ?? 'unknown'} failed: ${error.message}`,
  )

  // The last attempt: the submission must not stay QUEUED forever.
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    void markSubmissionFailed(
      job.data.submissionId,
      'The judge could not run this submission. Ask the organizer to re-run it.',
    )
  }
})

worker.on('error', (error) => {
  console.error('[judge] worker error:', error.message)
})

console.log(`[judge] listening on ${JUDGE_QUEUE} (concurrency ${concurrency})`)

// Sweep for submissions whose job was lost. A row stuck in QUEUED is worse
// than one that says it failed.
const reaper = setInterval(() => {
  void reapStaleSubmissions()
    .then((count) => {
      if (count > 0) console.error(`[judge] reaped ${count} stale submissions`)
    })
    .catch((error: unknown) => {
      console.error('[judge] reaper failed:', (error as Error).message)
    })
}, 60_000)

async function shutdown(signal: string) {
  console.log(`[judge] ${signal} received, closing`)
  clearInterval(reaper)
  await worker.close()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
