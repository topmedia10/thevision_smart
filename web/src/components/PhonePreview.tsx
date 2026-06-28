"use client";

/** Desktop-only live preview of the SMS on a dark phone screen. */
export function PhonePreview({
  sender,
  message,
}: {
  sender: string;
  message: string;
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
          style={{ background: "linear-gradient(180deg, #1b2440, #0e1322)" }}
        >
          <div className="text-center text-white/60 text-xs mb-4 mt-1">
            {sender || "The Vision"}
          </div>
          <div className="flex">
            <div
              className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm whitespace-pre-wrap break-words text-right text-white"
              style={{ background: "rgba(255,255,255,0.14)" }}
            >
              {message || "תצוגה מקדימה של ההודעה תופיע כאן..."}
            </div>
          </div>
        </div>
      </div>
      <div className="faint text-xs mt-2">תצוגה מקדימה</div>
    </div>
  );
}
