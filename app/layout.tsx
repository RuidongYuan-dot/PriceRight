import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PriceRight · 线下服务价格查询", template: "%s · PriceRight" },
  description: "选择服务和地区，查看可解释的线下服务参考价格。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main">
          跳到主要内容
        </a>
        <header className="site-header">
          <nav className="shell header-inner" aria-label="主导航">
            <Link className="wordmark" href="/" aria-label="PriceRight 首页">
              <span className="brand-mark" aria-hidden="true">
                ¥
              </span>{" "}
              PriceRight
            </Link>
            <Link className="nav-link" href="/#services">
              服务目录
            </Link>
          </nav>
        </header>
        <main id="main" className="shell main">
          {children}
        </main>
        <footer className="site-footer">
          <div className="shell footer-inner">
            <Link href="/" className="footer-brand">
              PriceRight
            </Link>
            <span>开源线下服务价格查询</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
