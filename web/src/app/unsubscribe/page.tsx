"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { unsubscribeAction } from "./actions";

declare global {
  interface Window {
    grecaptcha?: {
      render: (el: HTMLElement, opts: { sitekey: string }) => number;
      getResponse: (id?: number) => string;
      reset: (id?: number) => void;
    };
  }
}

export default function UnsubscribePage() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      if (window.grecaptcha && captchaRef.current && widgetId.current === null && siteKey) {
        widgetId.current = window.grecaptcha.render(captchaRef.current, {
          sitekey: siteKey,
        });
      }
    }, 300);
    return () => clearInterval(t);
  }, [siteKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const token =
      siteKey && window.grecaptcha ? window.grecaptcha.getResponse(widgetId.current ?? undefined) : "test";
    const fd = new FormData();
    fd.set("phone", phone);
    fd.set("recaptcha", token);
    const r = await unsubscribeAction(fd);
    setBusy(false);
    if (r.ok) setStatus("done");
    else {
      setError(r.error);
      setStatus("error");
      if (window.grecaptcha) window.grecaptcha.reset(widgetId.current ?? undefined);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Script src="https://www.google.com/recaptcha/api.js" async defer />
      <div className="card w-full max-w-md">
        <div className="text-center mb-5">
          <div className="text-2xl font-bold text-brand-600">הסרה מרשימת התפוצה</div>
        </div>
        {status === "done" ? (
          <p className="text-center text-green-600">
            הבקשה התקבלה. אם המספר קיים ברשימה, הוא הוסר בהצלחה.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-gray-600">
              אנא הזינו את מספר הטלפון הנייד שלכם לצורך הסרה מרשימת התפוצה
            </p>
            <input
              className="input text-left"
              dir="ltr"
              type="tel"
              inputMode="tel"
              placeholder="05X-XXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {siteKey && <div ref={captchaRef} />}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "מעבד..." : "הסרה"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
