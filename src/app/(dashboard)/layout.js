export const dynamic = "force-dynamic";

import { DashboardLayout } from "@/shared/components";

export default function DashboardRootLayout({ children }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

