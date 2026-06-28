"use client";
import { useRef, useState } from "react";
import { PERSONAL_TOKENS, EMPLOYEE_TOKENS } from "@/lib/vars";

export interface BusinessInfo {
  businessName?: string;
  businessAddress?: string;
  bookingLink?: string;
  googleReviewLink?: string;
  smsUnsubscribeLink?: string;
}

const SEGMENT = 201; // provider rule: every 201 chars = +1 billed message
const EMOJIS = [
  "😀","😁","😍","🥳","😎","👍","🙏","💪","🎉","✨","🔥","💈","💇","💇‍♀️","💅","✂️",
  "📅","📍","📞","💬","⭐","❤️","🎁","🚀","👇","✅","🟢","🕒","🆕","💯",
];

export function SmsTextarea({
  value,
  onChange,
  business,
  rows = 7,
}: {
  value: string;
  onChange: (v: string) => void;
  business: BusinessInfo;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [dir, setDir] = useState<"rtl" | "ltr">("rtl");
  const [showEmoji, setShowEmoji] = useState(false);

  const chars = value.length;
  const messages = Math.max(1, Math.ceil(chars / SEGMENT));
  const cap = messages * SEGMENT;
  const overOne = messages > 1;

  function insertAtCursor(text: string) {
    const el = ref.current;
    if (!el) {
      onChange(value + text);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    // restore caret after the inserted text
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-2">
        <ToolSelect
          placeholder="פנייה אישית"
          options={PERSONAL_TOKENS.map((t) => ({ label: t.label, value: t.token }))}
          onPick={(v) => insertAtCursor(v)}
        />
        <ToolSelect
          placeholder="איש צוות"
          options={EMPLOYEE_TOKENS.map((t) => ({ label: t.label, value: t.token }))}
          onPick={(v) => insertAtCursor(v)}
        />
        <ToolSelect
          placeholder="פרטי העסק"
          options={[
            { label: "שם העסק", value: business.businessName || "" },
            {
              label: "כתובת",
              value: business.businessAddress
                ? `${business.businessAddress} 📍`
                : "",
            },
          ]}
          onPick={(v) => v && insertAtCursor(v)}
        />
        <button
          type="button"
          className="toolbtn"
          onClick={() =>
            business.bookingLink &&
            insertAtCursor(`קבע תור עכשיו 👇\n${business.bookingLink}`)
          }
          disabled={!business.bookingLink}
        >
          קישור לקביעת תור
        </button>
        <button
          type="button"
          className="toolbtn"
          onClick={() =>
            business.googleReviewLink &&
            insertAtCursor(business.googleReviewLink)
          }
          disabled={!business.googleReviewLink}
        >
          קישור לביקורת גוגל
        </button>
        <button
          type="button"
          className="toolbtn"
          onClick={() =>
            business.smsUnsubscribeLink &&
            insertAtCursor(`\n\nהסרה\n${business.smsUnsubscribeLink}`)
          }
          disabled={!business.smsUnsubscribeLink}
        >
          הסרה
        </button>
        <div className="relative">
          <button
            type="button"
            className="toolbtn"
            onClick={() => setShowEmoji((s) => !s)}
          >
            😊 אימוג'י
          </button>
          {showEmoji && (
            <div className="absolute top-full right-0 z-30 mt-1 flex w-72 max-h-56 flex-wrap gap-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl leading-none hover:bg-gray-100"
                  onClick={() => {
                    insertAtCursor(e);
                    setShowEmoji(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* textarea */}
      <textarea
        ref={ref}
        dir={dir}
        rows={rows}
        className="w-full resize-y px-3 py-2 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="כתבו כאן את תוכן ההודעה..."
      />

      {/* footer: direction + counter */}
      <div className="flex items-center justify-between border-t border-gray-100 p-2">
        <div className="flex gap-1">
          <button
            type="button"
            className={`toolbtn ${dir === "rtl" ? "bg-brand-50 text-brand-700" : ""}`}
            onClick={() => setDir("rtl")}
            title="ימין לשמאל"
          >
            ⇥
          </button>
          <button
            type="button"
            className={`toolbtn ${dir === "ltr" ? "bg-brand-50 text-brand-700" : ""}`}
            onClick={() => setDir("ltr")}
            title="שמאל לימין"
          >
            ⇤
          </button>
        </div>
        <div className={`text-sm ${overOne ? "text-red-600 font-medium" : "text-gray-500"}`}>
          {chars}/{cap} · ההודעה תחוייב ב- {messages} הודעות
        </div>
      </div>
    </div>
  );
}

function ToolSelect({
  placeholder,
  options,
  onPick,
}: {
  placeholder: string;
  options: { label: string; value: string }[];
  onPick: (value: string) => void;
}) {
  return (
    <select
      className="toolbtn appearance-none"
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
        e.target.value = "";
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o, i) => (
        <option key={i} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
