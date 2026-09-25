import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    // 16px side gutter, and a max width so long school names have somewhere to go.
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <main>{children}</main>
    </div>
  );
}
