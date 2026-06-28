import { config } from "./config";
import { log } from "./logger";

/**
 * Global SMS client using the SOAP web service (WsSMS.asmx).
 *
 * The REST endpoint (/api/restApiSms/*) returns IIS 403 on this account; the
 * SOAP service at /webServices/WsSMS.asmx is the supported one. SOAP namespace
 * is "apiGlobalSms"; each operation's result is a string carrying either a
 * number (balance / credits charged) or a textual error.
 */

export type BalanceResult =
  | { ok: true; balance: number }
  | { ok: false; error: string };

export type SendResult =
  | { ok: true; credits: number }
  | { ok: false; error: string };

const SOAP_NS = "apiGlobalSms";
const ENDPOINT = `${config.globalSms.host}/webServices/WsSMS.asmx`;

const ERROR_FRAGMENTS = [
  "invalid login",
  "e 1",
  "unapporved originator",
  "unapproved originator",
  "not enough credit",
];

function looksLikeError(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ERROR_FRAGMENTS.some((f) => t.includes(f));
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Extract <tag>...</tag> (ignoring any namespace prefix) from a SOAP response. */
function extractResult(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`);
  const m = xml.match(re);
  return m ? xmlUnescape(m[1]).trim() : null;
}

async function soapCall(
  action: string,
  bodyInner: string,
): Promise<{ ok: boolean; status: number; text: string }> {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <${action} xmlns="${SOAP_NS}">
${bodyInner}
    </${action}>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "text/xml",
      SOAPAction: `${SOAP_NS}/${action}`,
    },
    body: envelope,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function credsMissing(): string | null {
  if (!config.globalSms.apiKey) return "GLOBAL_SMS_API_KEY not configured";
  if (!config.globalSms.originator)
    return "GLOBAL_SMS_ORIGINATOR not configured";
  return null;
}

/** SOAP getBalance → remaining balance as a number, or a structured error. */
export async function getBalance(): Promise<BalanceResult> {
  if (!config.globalSms.apiKey)
    return { ok: false, error: "GLOBAL_SMS_API_KEY not configured" };

  let r: { ok: boolean; status: number; text: string };
  try {
    r = await soapCall(
      "getBalance",
      `      <ApiKey>${xmlEscape(config.globalSms.apiKey)}</ApiKey>`,
    );
  } catch (e) {
    log.error("globalSms.getBalance network error", { error: String(e) });
    return { ok: false, error: "network error contacting Global SMS" };
  }

  if (r.status === 401 || r.status === 403) {
    log.error("globalSms.getBalance forbidden", { status: r.status });
    return { ok: false, error: `IP not whitelisted / forbidden (${r.status})` };
  }
  const result = extractResult(r.text, "getBalanceResult");
  if (result === null) {
    return { ok: false, error: `unexpected SOAP response (HTTP ${r.status})` };
  }
  if (looksLikeError(result)) return { ok: false, error: result };
  const balance = Number(result);
  if (!Number.isFinite(balance)) {
    return { ok: false, error: `unexpected balance: "${result}"` };
  }
  return { ok: true, balance };
}

/** SOAP sendSmsToRecipients. Returns credits charged or a text error. */
export async function sendSms(to: string, body: string): Promise<SendResult> {
  const missing = credsMissing();
  if (missing) return { ok: false, error: missing };

  const inner = [
    `      <ApiKey>${xmlEscape(config.globalSms.apiKey)}</ApiKey>`,
    `      <txtOriginator>${xmlEscape(config.globalSms.originator)}</txtOriginator>`,
    `      <destinations>${xmlEscape(to)}</destinations>`,
    `      <txtSMSmessage>${xmlEscape(body)}</txtSMSmessage>`,
    `      <dteToDeliver></dteToDeliver>`,
    `      <txtAddInf>smart</txtAddInf>`,
  ].join("\n");

  let r: { ok: boolean; status: number; text: string };
  try {
    r = await soapCall("sendSmsToRecipients", inner);
  } catch (e) {
    log.error("globalSms.sendSms network error", { error: String(e), to });
    return { ok: false, error: "network error contacting Global SMS" };
  }

  if (r.status === 401 || r.status === 403) {
    return { ok: false, error: `IP not whitelisted / forbidden (${r.status})` };
  }
  const result = extractResult(r.text, "sendSmsToRecipientsResult");
  if (result === null) {
    return { ok: false, error: `unexpected SOAP response (HTTP ${r.status})` };
  }
  if (looksLikeError(result)) {
    log.warn("globalSms.sendSms provider error", { to, error: result });
    return { ok: false, error: result };
  }
  const credits = Number(result);
  if (!Number.isFinite(credits)) {
    const m = result.match(/-?\d+(\.\d+)?/);
    if (m) return { ok: true, credits: Number(m[0]) };
    return { ok: false, error: `unexpected send response: "${result}"` };
  }
  return { ok: true, credits };
}
