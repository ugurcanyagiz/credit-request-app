import type { ReactNode } from "react";
import Image from "next/image";

import creditAppLogo from "@/components/creditapp.png";
import { GlobalCartWidget } from "@/components/global-cart-widget";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen">
      <header className="flex w-full justify-end px-4 pt-4 sm:px-6 sm:pt-6">
        <Image
          src={creditAppLogo}
          alt="Credit App"
          priority
          className="h-16 w-auto drop-shadow-sm sm:h-20"
        />
      </header>
      <GlobalCartWidget />
      {children}
    </div>
  );
}
