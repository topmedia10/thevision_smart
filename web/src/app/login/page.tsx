"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestOtpAction, verifyOtpAction } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    const fd = new FormData();
    fd.set("phone", phone);
    const res = await requestOtpAction(null, fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else setStep("otp");
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    const fd = new FormData();
    fd.set("phone", phone);
    fd.set("code", code);
    const res = await verifyOtpAction(null, fd);
    setLoading(false);
    if (res.step === "done") router.replace("/");
    else setError(res.error || "קוד שגוי");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-brand-600">סמארט</div>
          <div className="text-sm text-gray-500 mt-1">כניסה למערכת הניהול</div>
        </div>

        {step === "phone" ? (
          <form onSubmit={submitPhone} className="space-y-4">
            <div>
              <label className="label">מספר טלפון</label>
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
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "שולח..." : "שליחת קוד"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <p className="text-sm text-gray-600">
              נשלח קוד בן 6 ספרות למספר {phone}
            </p>
            <div>
              <label className="label">קוד אימות</label>
              <input
                className="input text-center tracking-widest text-lg"
                dir="ltr"
                inputMode="numeric"
                maxLength={6}
                placeholder="------"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "מאמת..." : "כניסה"}
            </button>
            <button
              type="button"
              className="text-sm text-gray-500 hover:underline w-full"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(undefined);
              }}
            >
              חזרה
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
