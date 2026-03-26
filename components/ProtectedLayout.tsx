"use client";

import Sidebar from "./Sidebar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-shell">{children}</main>
    </div>
  );
}