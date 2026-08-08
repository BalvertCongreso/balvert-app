"use client";

import { CurrentUserProvider } from "@/context/CurrentUserContext";
import NavHeader from "@/components/NavHeader";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <NavHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </CurrentUserProvider>
  );
}
