"use client";

/** Desktop-only live preview of the SMS inside a simple phone mockup. */
export function PhonePreview({
  sender,
  message,
}: {
  sender: string;
  message: string;
}) {
  return (
    <div className="hidden lg:flex flex-col items-center">
      <div className="w-[300px] rounded-[2.5rem] border-8 border-gray-900 bg-gray-900 shadow-xl">
        <div className="h-6 flex items-center justify-center">
          <div className="h-1.5 w-16 rounded-full bg-gray-700" />
        </div>
        <div className="bg-gray-50 rounded-b-[1.8rem] min-h-[460px] p-3">
          <div className="text-center text-xs text-gray-400 mb-3">
            {sender || "TheVision"}
          </div>
          <div className="flex">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-white shadow-sm px-3 py-2 text-sm whitespace-pre-wrap break-words text-right">
              {message || "תצוגה מקדימה של ההודעה תופיע כאן..."}
            </div>
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-2">תצוגה מקדימה</div>
    </div>
  );
}
