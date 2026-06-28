/** Hebrew message variables — must match the Lambda implementation. */
export interface RenderContext {
  customerFirstName?: string;
  customerLastName?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
}

// Order matters: longer tokens that contain shorter ones run first.
const TOKENS: Array<[RegExp, keyof RenderContext]> = [
  [/שם_פרטי/g, "customerFirstName"],
  [/שם_משפחה_ספר/g, "employeeLastName"],
  [/שם_הספר/g, "employeeFirstName"],
  [/שם_משפחה/g, "customerLastName"],
];

export function renderMessage(template: string, ctx: RenderContext): string {
  let out = template;
  for (const [re, key] of TOKENS) out = out.replace(re, ctx[key] ?? "");
  return out;
}

/** Tokens offered by the SMS textarea "פנייה אישית" / "איש צוות" selects. */
export const PERSONAL_TOKENS = [
  { label: "שם פרטי", token: "שם_פרטי" },
  { label: "שם משפחה", token: "שם_משפחה" },
];
export const EMPLOYEE_TOKENS = [
  { label: "שם הספר", token: "שם_הספר" },
  { label: "שם משפחה ספר", token: "שם_משפחה_ספר" },
];
