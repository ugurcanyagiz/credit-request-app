import type { ReactNode } from "react";
import { GlobalCartWidget } from "@/components/global-cart-widget";
import { NavigationModalCleanup } from "@/components/navigation-modal-cleanup";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen">
      <NavigationModalCleanup />
      <GlobalCartWidget />
      {children}
    </div>
  );
}
