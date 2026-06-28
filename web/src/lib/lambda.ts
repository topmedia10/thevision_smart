import "server-only";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { lambda } from "./aws/clients";
import { SEND_PUSH_FUNCTION_NAME } from "./constants";

export interface PushResult {
  ok: boolean;
  successCount?: number;
  failureCount?: number;
  error?: string;
}

/** Invoke the shared sendPush Lambda (manual push). */
export async function invokeSendPush(
  title: string,
  body: string,
): Promise<PushResult> {
  try {
    const res = await lambda.send(
      new InvokeCommand({
        FunctionName: SEND_PUSH_FUNCTION_NAME,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(
          JSON.stringify({ trigger: "manual", title, body }),
        ),
      }),
    );
    if (res.FunctionError) {
      return { ok: false, error: res.FunctionError };
    }
    const payload = res.Payload
      ? JSON.parse(Buffer.from(res.Payload).toString())
      : {};
    return {
      ok: payload.ok ?? true,
      successCount: payload.successCount,
      failureCount: payload.failureCount,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
