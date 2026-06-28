import { requireAdmin } from "@/lib/auth";
import { getSettings, BusinessSettings, ReviewsSettings } from "@/lib/settings";
import { ReviewsForm } from "@/components/AutomationForms";

export const dynamic = "force-dynamic";

export default async function ReviewsAutomationPage() {
  await requireAdmin();
  const [business, reviews] = await Promise.all([
    getSettings<BusinessSettings>("business"),
    getSettings<ReviewsSettings>("reviews"),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">אוטומציית ביקורות</h1>
      <ReviewsForm business={business} initial={reviews} />
    </div>
  );
}
