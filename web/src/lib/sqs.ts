import "server-only";
import {
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";
import { sqs } from "./aws/clients";
import { QUEUE_URL } from "./constants";

export interface SmsJob {
  to: string;
  body: string;
  dedupKey: string;
  source: "manual" | "welcome" | "review" | "weekly" | "otp" | "test" | "alert";
  batchId?: string;
}

/** Enqueue SMS jobs in batches of 10 (SQS limit). */
export async function enqueueSms(jobs: SmsJob[]): Promise<void> {
  for (let i = 0; i < jobs.length; i += 10) {
    const slice = jobs.slice(i, i + 10);
    const entries: SendMessageBatchRequestEntry[] = slice.map((job, idx) => ({
      Id: String(idx),
      MessageBody: JSON.stringify(job),
    }));
    const res = await sqs.send(
      new SendMessageBatchCommand({ QueueUrl: QUEUE_URL, Entries: entries }),
    );
    if (res.Failed && res.Failed.length) {
      throw new Error(`Failed to enqueue ${res.Failed.length} SMS jobs`);
    }
  }
}
