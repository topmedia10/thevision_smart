"use client";

/** Desktop-only live preview of a push notification on a phone lock screen. */
export function PushPreview({
  appName,
  title,
  body,
}: {
  appName: string;
  title: string;
  body: string;
}) {
  return (
    <div className="hidden lg:flex flex-col items-center">
      <div
        className="w-[300px] rounded-[2.5rem] p-2 shadow-soft"
        style={{ background: "#05070c", border: "1px solid var(--border)" }}
      >
        <div className="h-6 flex items-center justify-center">
          <div className="h-1.5 w-16 rounded-full" style={{ background: "var(--surface-3)" }} />
        </div>
        <div
          className="rounded-[1.9rem] min-h-[460px] p-3 flex flex-col"
          style={{
            background:
              "linear-gradient(180deg, #1b2440, #0e1322)",
          }}
        >
          <div className="text-center mt-6 mb-8">
            <div className="text-white/90 text-5xl font-light">9:41</div>
            <div className="text-white/60 text-sm mt-1">יום ראשון, 28 ביוני</div>
          </div>
          {/* notification card */}
          <div
            className="rounded-2xl p-3 backdrop-blur"
            style={{ background: "rgba(255,255,255,0.14)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="grid h-6 w-6 place-items-center rounded-md text-white text-xs font-bold"
                style={{ background: "linear-gradient(180deg,var(--brand),var(--brand-2))" }}
              >
                S
              </span>
              <span className="text-white/80 text-xs font-medium">
                {appName || "The Vision"}
              </span>
              <span className="text-white/50 text-xs mr-auto">עכשיו</span>
            </div>
            <div className="text-white font-semibold text-sm break-words">
              {title || "כותרת ההתראה"}
            </div>
            <div className="text-white/85 text-sm break-words whitespace-pre-wrap">
              {body || "תוכן ההתראה יופיע כאן..."}
            </div>
          </div>
        </div>
      </div>
      <div className="faint text-xs mt-2">תצוגה מקדימה</div>
    </div>
  );
}
