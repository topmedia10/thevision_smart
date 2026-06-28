/**
 * Server-side variable replacement applied to each message before queuing.
 * Tokens are Hebrew; see docs/CONVENTIONS.md.
 */
export interface RenderContext {
  customerFirstName?: string;
  customerLastName?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
}

const TOKENS: Array<[RegExp, keyof RenderContext]> = [
  [/שם_פרטי/g, "customerFirstName"],
  [/שם_משפחה_ספר/g, "employeeLastName"], // must run before שם_משפחה
  [/שם_הספר/g, "employeeFirstName"],
  [/שם_משפחה/g, "customerLastName"],
];

export function renderMessage(template: string, ctx: RenderContext): string {
  let out = template;
  for (const [re, key] of TOKENS) {
    out = out.replace(re, ctx[key] ?? "");
  }
  return out;
}
