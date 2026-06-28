import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from "@aws-sdk/client-sqs";
import { config } from "./config";
import { log } from "./logger";
import { sendSms } from "./globalSms";
import { alreadySent, markSent, writeActivityLog } from "./ddb";

interface SmsJob {
  to: string;
  body: string;
  dedupKey: string;
  source: string;
  batchId?: string;
}

const sqs = new SQSClient({ region: config.region });
let running = true;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function deleteMessage(receiptHandle: string) {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: config.queueUrl,
      ReceiptHandle: receiptHandle,
    }),
  );
}

/**
 * Process one message. Returns true if the SQS message should be deleted.
 * On a send failure we return false so the message becomes visible again and
 * eventually lands in the DLQ after maxReceiveCount.
 */
async function processMessage(msg: Message): Promise<boolean> {
  if (!msg.Body) return true; // malformed → drop
  let job: SmsJob;
  try {
    job = JSON.parse(msg.Body);
  } catch {
    log.error("worker: unparseable message body, dropping", { body: msg.Body });
    return true;
  }

  if (!job.to || !job.body || !job.dedupKey) {
    log.error("worker: incomplete job, dropping", { job });
    return true;
  }

  // Idempotency: skip if already sent (SQS is at-least-once).
  if (await alreadySent(job.dedupKey)) {
    log.info("worker: duplicate, skipping", { dedupKey: job.dedupKey });
    return true;
  }

  const result = await sendSms(job.to, job.body);
  if (!result.ok) {
    log.warn("worker: send failed, will retry", {
      dedupKey: job.dedupKey,
      error: result.error,
    });
    return false; // keep message → redeliver → DLQ after N
  }

  // Success: record idempotency + activity log, then allow deletion.
  try {
    await markSent(job.dedupKey);
  } catch (e) {
    // Conditional-put race (another worker marked it) — safe to continue.
    log.info("worker: markSent race", { dedupKey: job.dedupKey });
  }
  await writeActivityLog({
    message: job.body,
    to: job.to,
    credits: result.credits,
    source: job.source,
    batchId: job.batchId,
  });
  log.info("worker: sent", {
    dedupKey: job.dedupKey,
    credits: result.credits,
    source: job.source,
  });
  return true;
}

async function loop() {
  log.info("SQS worker started", { queue: config.queueUrl });
  while (running) {
    let messages: Message[] = [];
    try {
      const res = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: config.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // long polling
          VisibilityTimeout: 60,
        }),
      );
      messages = res.Messages ?? [];
    } catch (e) {
      log.error("worker: receive error", { error: String(e) });
      await sleep(2000);
      continue;
    }

    // Process sequentially to respect the Global SMS rate limit.
    for (const msg of messages) {
      if (!running) break;
      try {
        const shouldDelete = await processMessage(msg);
        if (shouldDelete && msg.ReceiptHandle) {
          await deleteMessage(msg.ReceiptHandle);
        }
      } catch (e) {
        log.error("worker: processing error", { error: String(e) });
        // leave message for redelivery
      }
      await sleep(config.interSendDelayMs);
    }
  }
  log.info("SQS worker stopped");
}

function shutdown(sig: string) {
  log.info("worker: shutdown signal", { sig });
  running = false;
  setTimeout(() => process.exit(0), 3000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

loop().catch((e) => {
  log.error("worker: fatal", { error: String(e) });
  process.exit(1);
});
