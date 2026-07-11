import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "@/components/ClientProviders";

export const metadata: Metadata = {
  title: "JobAgent - 智能求职助手",
  description: "梳理工作经历，智能匹配理想岗位，数据保存在云端",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var cloud=localStorage.getItem("job-agent-cloud-mode");var offline=localStorage.getItem("job-agent-offline");if(cloud==="1"){document.cookie="job-agent-offline=; path=/; max-age=0; SameSite=Lax"}else if(offline!=="1"){localStorage.setItem("job-agent-offline","1");document.cookie="job-agent-offline=1; path=/; max-age=31536000; SameSite=Lax"}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
