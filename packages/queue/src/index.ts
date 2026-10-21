import { Queue } from 'bullmq'
import Redis from 'ioredis'

/**
 * The judging queue.
 *
 * The app enqueues a submission; the worker — which lives on a host that can
 * reach the sandbox — picks it up. The job carries only an id: everything
 * else is read from the database, so the database stays the source of truth and
 * a job can be replayed by hand.
 */

export const JUDGE_QUEUE = 'koarena-judge'

export interface JudgeJob {
  submissionId: string
}

export interface QueueEnvironment {
  REDIS_URL?: string
}

let queue: Queue<JudgeJob> | undefined
let connection: Redis | undefined

function redisUrl(env: QueueEnvironment = process.env): string {
  const url = env.REDIS_URL
  if (!url) {
    throw new Error(
      'REDIS_URL is not set. The judging queue needs a Redis with blocking commands.',
    )
  }
  return url
}

/** The Redis connection the queue uses. */
export function getQueueConnection(env: QueueEnvironment = process.env): Redis {
  if (!connection) {
    connection = new Redis(redisUrl(env), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
    connection.on('error', () => {
      // A transient Redis failure must not take the request down; the job stays
      // in the queue and the client retries.
    })
  }
  return connection
}

/** The producer side of the judging queue. */
export function getJudgeQueue(
  env: QueueEnvironment = process.env,
): Queue<JudgeJob> {
  if (!queue) {
    queue = new Queue<JudgeJob>(JUDGE_QUEUE, {
      connection: getQueueConnection(env),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        // A submission that is judged twice must not score twice; the score
        // event's idempotency key is the real guard, this one just avoids
        // wasting runs.
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    })
  }
  return queue
}

export async function closeJudgeQueue(): Promise<void> {
  await queue?.close()
  queue = undefined
  await connection?.quit().catch(() => undefined)
  connection = undefined
}
