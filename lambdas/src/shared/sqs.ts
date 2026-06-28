import {
  SQSClient,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";

const client = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL!;

export interface SmsJob {
  to: string;
  body: string;
  dedupKey: string;
  source: "manual" | "welcome" | "review" | "weekly" | "otp" | "test" | "alert";
  /** Optional campaign id used to group activity-log rows (manual/weekly). */
  batchId?: string;
}

/** Enqueue SMS jobs to the outbox in batches of 10 (SQS batch limit). */
export async function enqueueSms(jobs: SmsJob[]): Promise<void> {
  for (let i = 0; i < jobs.length; i += 10) {
    const slice = jobs.slice(i, i + 10);
    const entries: SendMessageBatchRequestEntry[] = slice.map((job, idx) => ({
      Id: String(idx),
      MessageBody: JSON.stringify(job),
    }));
    const res = await client.send(
      new SendMessageBatchCommand({ QueueUrl: QUEUE_URL, Entries: entries }),
    );
    if (res.Failed && res.Failed.length) {
      console.error("SQS batch partial failure", JSON.stringify(res.Failed));
      throw new Error(`Failed to enqueue ${res.Failed.length} SMS jobs`);
    }
  }
}
