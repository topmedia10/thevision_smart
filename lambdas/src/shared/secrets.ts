import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({});
const cache = new Map<string, string>();

/** Fetch a secret string by ARN or name, cached for the warm container. */
export async function getSecretString(arnOrName: string): Promise<string> {
  const cached = cache.get(arnOrName);
  if (cached) return cached;
  const res = await client.send(
    new GetSecretValueCommand({ SecretId: arnOrName }),
  );
  const value = res.SecretString;
  if (!value) throw new Error(`Secret ${arnOrName} has no string value`);
  cache.set(arnOrName, value);
  return value;
}

export async function getSecretJson<T = Record<string, unknown>>(
  arnOrName: string,
): Promise<T> {
  return JSON.parse(await getSecretString(arnOrName)) as T;
}
