import { getSecretString } from "./secrets";

/**
 * Lambdas have no whitelisted IP at Global SMS, so they read the SMS balance
 * through the EC2 HTTP API (whose Elastic IP is whitelisted).
 */
export async function getSmsBalance(): Promise<number> {
  const base = process.env.EC2_API_BASE!;
  const tokenArn = process.env.EC2_API_TOKEN_ARN!;
  const token = await getSecretString(tokenArn);

  const res = await fetch(`${base}/balance`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`EC2 /balance HTTP ${res.status}`);
  }
  const data = (await res.json()) as { ok: boolean; balance?: number; error?: string };
  if (!data.ok || typeof data.balance !== "number") {
    throw new Error(`EC2 /balance error: ${data.error ?? "unknown"}`);
  }
  return data.balance;
}
