import express, { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { config } from "./config";
import { log } from "./logger";
import { getBalance, sendSms } from "./globalSms";

/** Constant-time bearer-token check against EC2_API_TOKEN. */
function authGuard(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(config.apiToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  next();
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "64kb" }));

  // Health check (no auth) — for nginx / uptime probes.
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Balance — proxied because only this instance's IP is whitelisted.
  app.get("/balance", authGuard, async (_req, res) => {
    const result = await getBalance();
    res.status(result.ok ? 200 : 502).json(result);
  });

  // Synchronous single SMS (login OTP). Does NOT go through SQS.
  app.post("/send-otp", authGuard, async (req, res) => {
    const { phone, message } = req.body ?? {};
    if (typeof phone !== "string" || typeof message !== "string") {
      res.status(400).json({ ok: false, error: "phone and message required" });
      return;
    }
    const result = await sendSms(phone, message);
    if (result.ok) {
      log.info("otp sent", { phone, credits: result.credits });
      res.json({ ok: true, credits: result.credits });
    } else {
      log.warn("otp send failed", { phone, error: result.error });
      res.status(502).json(result);
    }
  });

  return app;
}
