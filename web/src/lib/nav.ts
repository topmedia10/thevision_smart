export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  children?: NavItem[];
}

export const NAV: NavItem[] = [
  { href: "/", label: "מבט מהיר", icon: "📊" },
  {
    href: "/sms",
    label: "שליחת SMS",
    icon: "✉️",
    children: [
      { href: "/sms", label: "שליחת SMS" },
      { href: "/sms/saved", label: "הודעות שמורות" },
    ],
  },
  { href: "/report", label: "דוח פעילות SMS", icon: "📈" },
  { href: "/push", label: "שליחת פוש", icon: "🔔" },
  { href: "/automation/welcome", label: "אוטומציית ברוך הבא", icon: "👋" },
  { href: "/automation/reviews", label: "אוטומציית ביקורות", icon: "⭐" },
  { href: "/automation/weekly-sms", label: "אוטומציית SMS שבועי", icon: "📅" },
  { href: "/automation/weekly-push", label: "אוטומציית פוש שבועי", icon: "📲" },
  { href: "/employees", label: "אנשי צוות", icon: "👥" },
  { href: "/settings", label: "הגדרות", icon: "⚙️" },
];
