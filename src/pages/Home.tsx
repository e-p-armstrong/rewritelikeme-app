import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// removed unused background image import
import { models } from '../services/ipcService';

interface RssPost {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  contentHtml?: string;
}

const heroOptions = [
  {
    headline: <>Welcome to RewriteLikeMe Offline</>,
    subheadline: <>You have access to all the free rephrasing models, right on your computer. </>,
    sub: <>To train a model on your own voice you will need to go to <a href="" className='underline italic'>RewriteLikeMe.com</a></>
  },
];

const Home: React.FC = () => {

  const [heroContent, setHeroContent] = useState(heroOptions[0]);
  const [rssPosts, setRssPosts] = useState<RssPost[]>([]);
  const [rssLoading, setRssLoading] = useState<boolean>(true);
  const [rssError, setRssError] = useState<string | null>(null);
  const [featuredPreview, setFeaturedPreview] = useState<string>('');
  const [featuredPreviewLoading, setFeaturedPreviewLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<{ bases: { count: number; bytes: number }; voices: { count: number; bytes: number }; totalBytes: number } | null>(null);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * heroOptions.length);
    setHeroContent(heroOptions[randomIndex]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await models.stats();
        if (!cancelled) setStats(s);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const FEED_URL = 'https://promptingweekly.substack.com/feed';

    const parseSubstackRss = (xmlText: string): RssPost[] => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error('Failed to parse RSS');
      }
      const items = Array.from(doc.querySelectorAll('item'));
      return items.map((item) => {
        const title = item.querySelector('title')?.textContent?.trim() || 'Untitled';
        const link = item.querySelector('link')?.textContent?.trim() || '#';
        const pubDate = item.querySelector('pubDate')?.textContent?.trim() || undefined;
        // Prefer full HTML in content:encoded when present
        const contentEncodedNode = (item.getElementsByTagName('content:encoded')[0] as Element | undefined);
        const contentEncoded = contentEncodedNode?.textContent?.trim();
        const descriptionFallback = item.querySelector('description')?.textContent?.trim() || undefined;
        const description = descriptionFallback;
        return { title, link, pubDate, description, contentHtml: contentEncoded };
      });
    };

    const fetchWithFallbacks = async (): Promise<string> => {
      // Skip direct fetch attempt since RSS feeds typically don't have CORS headers
      // This avoids console CORS errors while keeping the same functionality
      
      // Fallback 1: jina.ai reader proxy (public, CORS-enabled)
      try {
        const res = await fetch(`https://r.jina.ai/http://promptingweekly.substack.com/feed`);
        if (res.ok) return await res.text();
      } catch {
        // ignore, try next
      }
      // Fallback 2: allorigins
      try {
        const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(FEED_URL)}`;
        const res = await fetch(proxied);
        if (res.ok) return await res.text();
      } catch {
        // ignore
      }
      throw new Error('Unable to fetch RSS feed');
    };

    (async () => {
      setRssLoading(true);
      setRssError(null);
      try {
        const xmlText = await fetchWithFallbacks();
        if (isCancelled) return;
        const posts = parseSubstackRss(xmlText).slice(0, 6);
        setRssPosts(posts);
        // Prepare featured preview from contentHtml if available, else description
        const primary = posts[0];
        if (primary) {
          const initial = stripHtml(primary.contentHtml || primary.description, 350);
          setFeaturedPreview(initial);
          // If initial is too short, fetch readable article via proxy and extract a richer snippet
          if (!initial || initial.length < 140) {
            setFeaturedPreviewLoading(true);
            try {
              const readableRes = await fetch(`https://r.jina.ai/${primary.link.startsWith('http') ? primary.link : `http://${primary.link}`}`);
              if (readableRes.ok) {
                const readableText = await readableRes.text();
                const trimmed = readableText.replace(/\s+/g, ' ').trim();
                setFeaturedPreview(trimmed.length > 100 ? trimmed.slice(0, 100) + '…' : trimmed);
              }
            } catch {
              // ignore; keep initial preview
            } finally {
              setFeaturedPreviewLoading(false);
            }
          }
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load feed';
        setRssError(message);
      } finally {
        if (!isCancelled) setRssLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const stripHtml = (html?: string, maxLength: number = 260): string => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = tmp.textContent || tmp.innerText || '';
    return text.length > maxLength ? text.slice(0, maxLength).trim() + '…' : text;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  };

  



  return (
    <div className="min-h-screen bg-floral-white text-black">
      {/* Hub Grid */}
      <div className="container mx-auto p-4 pt-16">
        {/* Top widgets row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Stats widget */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-black">Your Models</h2>
              <Link to="/dashboard" className="text-orange text-sm hover:underline">Manage</Link>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold">{stats?.voices.count ?? 0}</div>
                <div className="text-sm text-gray-600">Voices</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{stats?.bases.count ?? 0}</div>
                <div className="text-sm text-gray-600">Bases</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{formatBytes(stats?.totalBytes)}</div>
                <div className="text-sm text-gray-600">Storage</div>
              </div>
            </div>
          </div>

          {/* GitHub stars widget */}
          <a
            href="https://github.com/e-p-armstrong/rewritelikeme-app"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow block"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-black">Support the Project</h2>
            </div>
            <p className="mt-2 text-gray-700 text-sm">Star the repo to help others discover it.</p>
            <div className="mt-4 flex items-center gap-3">
              <img
                src="https://img.shields.io/github/stars/e-p-armstrong/rewritelikeme-app?style=social"
                alt="GitHub stars"
              />
              <span className="inline-block bg-black text-white px-3 py-1 rounded-lg text-sm font-semibold">Star on GitHub</span>
            </div>
          </a>

          {/* Quick links */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold text-black">Quick Links</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link to="/dashboard/convert" className="bg-orange text-white px-4 py-2 rounded-lg text-sm font-semibold text-center hover:bg-opacity-80">Start Converting</Link>
              <Link to="/dashboard" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold text-center hover:bg-opacity-80">Open Dashboard</Link>
              <Link to="/how-to" className="bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold text-center hover:bg-gray-50">How-To</Link>
              <a href="https://rewritelikeme.com" target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold text-center hover:bg-gray-50">Website</a>
            </div>
            <p className="mt-4 text-xs text-gray-600">{heroContent.sub}</p>
          </div>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* RSS Feed Tile - spans 2 cols on large screens */}
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-black">Prompting Weekly (RewriteLikeMe blog)</h2>
              <a
                href="https://promptingweekly.substack.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange hover:underline"
              >
                Visit Substack
              </a>
            </div>

            {rssLoading && (
              <p className="text-gray-600">Loading latest posts…</p>
            )}

            {!rssLoading && rssError && (
              <div className="text-gray-700">
                <p className="mb-2">Couldn’t load the feed right now.</p>
                <a
                  href="https://promptingweekly.substack.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange hover:underline"
                >
                  Open Prompting Weekly
                </a>
              </div>
            )}

            {!rssLoading && !rssError && rssPosts.length > 0 && (
              <div>
                {/* Featured */}
                <div className="mb-6">
                  <a
                    href={rssPosts[0].link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <h3 className="text-xl font-bold text-black hover:underline">
                      {rssPosts[0].title}
                    </h3>
                  </a>
                  {rssPosts[0].pubDate && (
                    <p className="text-xs text-gray-500 mt-1">{new Date(rssPosts[0].pubDate).toLocaleDateString()}</p>
                  )}
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">
                    {featuredPreviewLoading ? 'Loading preview…' : (featuredPreview || stripHtml(rssPosts[0].contentHtml || rssPosts[0].description, 700))}
                  </p>
                </div>

                {/* Recent list */}
                <ul className="space-y-2">
                  {rssPosts.slice(1, 4).map((p, idx) => (
                    <li key={idx} className="text-sm">
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange hover:underline"
                      >
                        {p.title}
                      </a>
                      {p.pubDate && (
                        <span className="text-gray-400 ml-2">{new Date(p.pubDate).toLocaleDateString()}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* RewriteLikeMe Promo Tile */}
          <a
            href="https://rewritelikeme.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow flex flex-col justify-between"
          >
            <div>
              <h3 className="text-xl font-bold text-black mb-2">RewriteLikeMe</h3>
              <p className="text-gray-700 text-sm">Train a voice, rewrite anything in your style.</p>
            </div>
            <div className="mt-4">
              <span className="inline-block bg-orange text-white px-4 py-2 rounded-lg text-sm font-semibold">Visit Site</span>
            </div>
          </a>

          {/* How-To Tile */}
          <Link
            to="/how-to"
            className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <h3 className="text-xl font-bold text-black mb-2">How to Use</h3>
            <p className="text-gray-700 text-sm">Quick guide to creating a Voice and rewriting text.</p>
            <div className="mt-4">
              <span className="inline-block bg-orange text-white px-4 py-2 rounded-lg text-sm font-semibold">Open Guide</span>
            </div>
          </Link>

          {/* Discord Tile */}
          <a
            href="https://discord.gg/2BDp9ftk"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow flex flex-col justify-between"
          >
            <div>
              <h3 className="text-xl font-bold text-black mb-2">Community Discord</h3>
              <p className="text-gray-700 text-sm">Share styles, ask questions, get help.</p>
            </div>
            <div className="mt-4">
              <span className="inline-block bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold">Join Discord</span>
            </div>
          </a>
        </div>
      </div>

      {/* Usage Explanation */}
      <div className="container mx-auto p-4 text-center pb-2 pt-12">
        <p className="text-2xl text-gray-700 max-w-2xl mx-auto">
          Generate writing with normal AI like ChatGPT. Then get it rewritten into a better style using this app.
        </p>
        <p className='mt-4'>Runs entirely free on your own computer.</p>
      </div>

      {/* Benefits Section */}
      <div className="container mx-auto p-4 mt-12 bg-orange bg-opacity-10 py-12">
        {/* Before/After Demo */}
        <div className="container mx-auto p-4 pb-16 pt-8">
          {/* <h2 className="text-3xl font-bold text-center text-black mb-12">See Real Examples</h2> */}
          {/* TODO put short-form video links here. */}
          <div className="max-w-7xl mx-auto space-y-12 text-2xl text-center">
            <p>People can instantly identify most AI-generated writing. Don't torpedo your brand with obvious "slop".</p>
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center text-orange mb-8">Why Professionals Choose RewriteLikeMe</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <svg className="w-12 h-12 text-orange" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 3L4 14h5l-1 7 9-11h-5l1-7z"/>
              </svg>
            </div>
            <h3 className="font-bold text-xl">Save Time</h3>
            <p>Train once, rewrite forever – cut content creation time by a lot.</p>
          </div>
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <svg className="w-12 h-12 text-orange" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </div>
            <h3 className="font-bold text-xl">Keep Brand Consistency</h3>
            <p>Maintain your unique voice across all communications.</p>
          </div>
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <svg className="w-12 h-12 text-orange" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 13.75c-2.34 0-7 1.17-7 3.5V19h14v-1.75c0-2.33-4.66-3.5-7-3.5zM4.34 17c.84-.58 2.87-1.25 4.66-1.25s3.82.67 4.66 1.25H4.34zM9 12c1.93 0 3.5-1.57 3.5-3.5S10.93 5 9 5 5.5 6.57 5.5 8.5 7.07 12 9 12zm0-5c.83 0 1.5.67 1.5 1.5S9.83 10 9 10s-1.5-.67-1.5-1.5S8.17 7 9 7zm7.04 6.81c1.16.84 1.96 1.96 1.96 3.44V19h4v-1.75c0-2.02-3.5-3.17-5.96-3.44zM15 12c1.93 0 3.5-1.57 3.5-3.5S16.93 5 15 5c-.54 0-1.04.13-1.5.35.63.89 1 1.98 1 3.15s-.37 2.26-1 3.15c.46.22.96.35 1.5.35z"/>
              </svg>
            </div>
            <h3 className="font-bold text-xl">Create More</h3>
            <p>Take advantage of AI for content creation and create more than you could have imagined
            </p>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="bg-black text-white py-12 mt-16">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Got value from this? Want to make your own Custom Voice?</h2>
          <h2 className="text-3xl font-bold mb-6">Get a Paid RewriteLikeMe plan! (cheapest = $10!)</h2>
          <a href="https://rewritelikeme.com/register" className="bg-orange text-white px-6 py-3 rounded-lg hover:bg-opacity-80 text-lg font-semibold">
            Sign Up Now
          </a>
        </div>
      </div>
    </div>
  );
};

export default Home;