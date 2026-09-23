import type { Metadata } from "next";
import type { ReactNode } from "react";
import "bootstrap/dist/css/bootstrap.rtl.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "منظومة إدارة جهات الاتصال والاستخبارات",
  description:
    "نظام محلي معزول لإدارة ملفات الأشخاص وجهات الاتصال والملاحظات الاستخبارية للصحفيين الاستقصائيين.",
};

const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('icims-theme')||'dark';document.documentElement.setAttribute('data-bs-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-bs-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="bg-body text-body">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
