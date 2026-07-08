"use client";

import { AppProvider } from "@/context/AppContext";
import { AppLayout } from "@/components/Sidebar";
import { AuthGuard } from "@/components/AuthGuard";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AuthGuard>
        <AppLayout>{children}</AppLayout>
      </AuthGuard>
    </AppProvider>
  );
}
