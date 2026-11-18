import Image from "next/image";
import Link from "next/link";
import { catalogHref, getCatalog } from "../lib/data/site-catalog";

export default async function HomePage() {
  const [catalog, demo] = await Promise.all([getCatalog(false), getCatalog(true)]);
  const categories = [...catalog.categories].sort((a, b) => a.order - b.order);
  const demos = [...demo.categories].sort((a, b) => a.order - b.order);

  return (
    <>
      <section className="hero" aria-labelledby="intro">
        <div className="hero-copy">
          <p className="eyebrow">线下服务价格查询</p>
          <h1 id="intro">
            先查价格，
            <br />
            再做决定。
          </h1>
          <p className="hero-description">
            回答几个与服务有关的问题，选好地区，就能查看费用区间和每一项费用的由来。
          </p>
          <a className="button" href="#services">
            浏览服务 <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="hero-image">
          <Image
            src="/images/ceiling-light.jpg"
            alt="家中安装的圆形吸顶灯"
            fill
            sizes="(max-width: 720px) 100vw, 50vw"
            preload
          />
        </div>
      </section>

      <section id="services" className="directory" aria-labelledby="directory-title">
        <h2 id="directory-title">服务目录</h2>
        {categories.length > 0 ? (
          <div className="tile-grid">
            {categories.map((category) => (
              <Link className="tile" key={category.id} href={catalogHref("categories", category.id, false)}>
                <span>
                  <strong>{category.name}</strong>
                  {category.description && <small>{category.description}</small>}
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">正式价格数据建设中，审核通过的服务将在这里开放查询。</p>
        )}
        {demos.length > 0 && (
          <div className="tile-grid demo-links">
            {demos.map((category) => (
              <Link
                className="tile demo-tile"
                key={category.id}
                href={catalogHref("categories", category.id, true)}
              >
                <span>
                  <strong>体验查询 · {category.name}</strong>
                  <small>使用演示数据试走一次报价流程。</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
