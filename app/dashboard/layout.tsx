import type { ReactNode } from "react";
import Image from "next/image";

import creditAppLogo from "@/components/creditapp.png";
import { GlobalCartWidget } from "@/components/global-cart-widget";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <>
      <div className="pointer-events-none fixed right-4 top-4 z-30 sm:right-6 sm:top-6">
        <Image
          src={creditAppLogo}
          alt="Credit App"
          priority
          className="h-16 w-auto drop-shadow-sm sm:h-20"
        />
      </div>
      <GlobalCartWidget />
      {children}
    </>
  );
}
