import type { ReactNode } from "react";
import { TopHeader } from "./TopHeader";
import { BottomNav } from "./BottomNav";
import { QuickAdd } from "@/components/QuickAdd";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopHeader />
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 pb-28">{children}</main>
      <QuickAdd />
      <BottomNav />
    </div>
  );
}
