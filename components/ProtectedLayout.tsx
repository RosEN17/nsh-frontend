"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { getUser } from "@/lib/auth";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-shell">{children}</main>
    </div>
  );
}