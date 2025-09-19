import React, { useEffect, useState } from 'react';
import { catalog, downloads, settings, models } from '../services/ipcService';
import type { CatalogEntry } from '../types/localModels';

const ModelSearch: React.FC = () => {
  const [tab, setTab] = useState<'voices' | 'bases'>('voices');
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [lastTaskIdByRepo, setLastTaskIdByRepo] = useState<Record<string, string | undefined>>({});
  const [progressByRepo, setProgressByRepo] = useState<Record<string, { downloadedBytes?: number; totalBytes?: number }>>({});
  const [targetPathByRepo, setTargetPathByRepo] = useState<Record<string, string | undefined>>({});
  const [basesPath, setBasesPath] = useState<string>('');
  const [voicesPath, setVoicesPath] = useState<string>('');
  const [installedByRepo, setInstalledByRepo] = useState<Record<string, string | undefined>>({});
  const [reportedTaskErrors, setReportedTaskErrors] = useState<Record<string, boolean>>({});
  const [banners, setBanners] = useState<Array<{ id: string; text: string; kind: 'error' | 'info' }>>([]);

  const pushBanner = (text: string, kind: 'error' | 'info' = 'error') => {
    setBanners(prev => {
      // de-dup by identical text to avoid spam
      if (prev.some(b => b.text === text && b.kind === kind)) return prev;
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return [{ id, text, kind }, ...prev].slice(0, 5);
    });
  };
  const dismissBanner = (id: string) => setBanners(prev => prev.filter(b => b.id !== id));

  const refresh = async () => {
    try {
      setLoading(true);
      const { entries } = await catalog.list({ type: tab === 'voices' ? 'voice' : 'base' });
      setEntries(entries);
      setError(null);
    } catch (e: unknown) {
      const msg = (e as Error).message || 'Failed to load catalog';
      setError(msg);
      pushBanner(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [tab]);

  // Fetch install paths once
  useEffect(() => {
    (async () => {
      try {
        const s = await settings.get();
        setBasesPath(s.basesPath);
        setVoicesPath(s.voicesPath);
      } catch {}
    })();
  }, []);

  // Fetch installed models occasionally to compare revisions
  useEffect(() => {
    const loadInstalled = async () => {
      try {
        const res = await models.list();
        const map: Record<string, string | undefined> = {};
        res.bases.forEach(b => { if (b.repo) map[b.repo] = b.revision; });
        res.voices.forEach(v => { if (v.repo) map[v.repo] = v.revision; });
        setInstalledByRepo(map);
      } catch {}
    };
    loadInstalled();
    const iv = setInterval(loadInstalled, 5000);
    return () => clearInterval(iv);
  }, []);

  const handleDirectRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      setLoading(true);
      const entry = await catalog.resolveRepo(query.trim());
      setEntries([entry]);
      setError(null);
    } catch (e: unknown) {
      const msg = (e as Error).message || 'Repo not found or incompatible';
      setError(msg);
      pushBanner(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (entry: CatalogEntry) => {
    try {
      setDownloading(prev => ({ ...prev, [entry.repo]: true }));
      const task = await downloads.start({ repo: entry.repo, type: entry.type });
      setLastTaskIdByRepo(prev => ({ ...prev, [entry.repo]: task.id }));
    } catch (e: unknown) {
      const msg = (e as Error).message || 'Failed to start download';
      setError(msg);
      pushBanner(msg, 'error');
    } finally {
      setDownloading(prev => ({ ...prev, [entry.repo]: false }));
    }
  };

  // Poll download status briefly to give visible feedback
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const tasks = await downloads.list();
        const nextProgress: Record<string, { downloadedBytes?: number; totalBytes?: number }> = {};
        const nextIds: Record<string, string | undefined> = { ...lastTaskIdByRepo };
        for (const t of tasks) {
          if (t.status.state === 'running') {
            nextIds[t.repo] = t.id;
            nextProgress[t.repo] = { downloadedBytes: (t.status as any).downloadedBytes, totalBytes: (t.status as any).totalBytes };
            setTargetPathByRepo(prev => ({ ...prev, [t.repo]: t.targetPath }));
          } else if (t.status.state === 'completed' || t.status.state === 'failed' || t.status.state === 'cancelled') {
            nextProgress[t.repo] = {} as any;
            nextIds[t.repo] = undefined;
            setTargetPathByRepo(prev => ({ ...prev, [t.repo]: t.targetPath }));
            if (t.status.state === 'failed' && !(reportedTaskErrors[t.id])) {
              const errMsg = (t.status as any)?.error || 'Download failed';
              pushBanner(`${t.repo}: ${errMsg}`, 'error');
              setReportedTaskErrors(prev => ({ ...prev, [t.id]: true }));
            }
            // Success/cancel are not bannered to avoid noise. We can add info banners if desired.
          }
        }
        setLastTaskIdByRepo(nextIds);
        setProgressByRepo(nextProgress);
        // Refresh installed map frequently to reflect newly installed revisions promptly
        try {
          const res = await models.list();
          const map: Record<string, string | undefined> = {};
          res.bases.forEach(b => { if (b.repo) map[b.repo] = b.revision; });
          res.voices.forEach(v => { if (v.repo) map[v.repo] = v.revision; });
          setInstalledByRepo(map);
        } catch {}
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [lastTaskIdByRepo]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Model Search</h1>
      <p>Here you can search for and download new Voices! Voices are usually about 700 MB. To create your own Voices, head over to <a href="https://rewritelikeme.com/" className='text-orange underline'>RewriteLikeMe.com</a>!</p>
      {banners.length > 0 && (
        <div className="mb-3 space-y-2">
          {banners.map(b => (
            <div key={b.id} className={`px-3 py-2 rounded border text-sm ${b.kind==='error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
              <div className="flex items-start justify-between gap-3">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs flex-1">{b.text}</pre>
                <button className="text-xs opacity-70 hover:opacity-100" onClick={() => dismissBanner(b.id)}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mb-4 flex items-center gap-2">
        <button className={`px-3 py-1 rounded ${tab==='voices'?'bg-orange text-white':'bg-gray-200'}`} onClick={() => setTab('voices')}>Voices</button>
        <button className={`px-3 py-1 rounded ${tab==='bases'?'bg-orange text-white':'bg-gray-200'}`} onClick={() => setTab('bases')}>Bases</button>
        <form onSubmit={handleDirectRepo} className="ml-auto flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Direct HF repo (org/name)"
            className="border px-2 py-1 rounded"
          />
          <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white">Resolve</button>
        </form>
      </div>

      {loading && <div>Loading catalog...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="text-xs text-gray-600 mb-3">
          Downloads save to: <span className="font-mono">{tab==='voices' ? voicesPath : basesPath}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map(e => (
            <div key={e.repo} className="bg-white rounded shadow p-4">
              <div className="font-semibold break-words">{e.repo}</div>
              <div className="text-sm text-gray-600 mb-2">type: {e.type} • rev: {e.latestRevision?.slice?.(0, 12) || '(auto-detected)'}</div>
              {('baseModelRepo' in e) && (e as any).baseModelRepo && (
                <div className="text-xs text-gray-500 mb-1">base: {(e as any).baseModelRepo}</div>
              )}
              {typeof e.sizeBytes === 'number' && (
                <div className="text-xs text-gray-500 mb-2">size: {(e.sizeBytes / (1024*1024)).toFixed(1)} MB</div>
              )}
              {lastTaskIdByRepo[e.repo] && (
                <div className="w-full bg-gray-200 rounded h-2 mb-2">
                  {(() => {
                    const p = progressByRepo[e.repo] || {};
                    const d = p.downloadedBytes || 0;
                    const t = p.totalBytes || 0;
                    const pct = t > 0 ? Math.min(100, Math.floor((d / t) * 100)) : 0;
                    return <div className="bg-green-500 h-2 rounded" style={{ width: `${pct}%` }} />
                  })()}
                </div>
              )}
              {targetPathByRepo[e.repo] && (
                <div className="text-[10px] text-gray-500 mb-2 break-all">Saving to: <span className="font-mono">{targetPathByRepo[e.repo]}</span></div>
              )}
              <div className="flex gap-2">
                <button
                  className={`${installedByRepo[e.repo] && installedByRepo[e.repo] === e.latestRevision ? 'bg-gray-800' : 'bg-green-600'} text-white px-3 py-1 rounded disabled:opacity-50`}
                  disabled={!!downloading[e.repo]}
                  onClick={() => handleDownload(e)}
                >{downloading[e.repo] ? 'Starting...' : (lastTaskIdByRepo[e.repo] ? 'Downloading…' : (installedByRepo[e.repo] && e.latestRevision && installedByRepo[e.repo] === e.latestRevision ? 'Re-download' : 'Download'))}</button>
                {lastTaskIdByRepo[e.repo] && (
                  <button
                    className="bg-gray-600 text-white px-3 py-1 rounded"
                    onClick={async () => {
                      const id = lastTaskIdByRepo[e.repo]!;
                      try { await downloads.cancel(id); } catch {}
                    }}
                  >Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSearch;


