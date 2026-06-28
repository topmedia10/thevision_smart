import { requireAdmin } from "@/lib/auth";
import { getSettings, BusinessSettings } from "@/lib/settings";
import { listSavedMessages } from "@/lib/savedMessages";
import { SavedManager } from "@/components/SavedManager";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  await requireAdmin();
  const [saved, business] = await Promise.all([
    listSavedMessages(),
    getSettings<BusinessSettings>("business"),
  ]);
  return (
    <SavedManager
      initial={saved.map((s) => ({ id: s.id, title: s.title, body: s.body }))}
      business={business}
    />
  );
}
