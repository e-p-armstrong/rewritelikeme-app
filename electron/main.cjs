// Basic Electron main process to host the Vite dev server UI and provide an IPC bridge placeholder
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { spawn } = require('child_process');
const net = require('net');
const log = require('electron-log');

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// Configure electron-log for both dev and production
log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'info' : 'error';
log.info('[STARTUP] App starting...', { isDev, isPackaged: app.isPackaged });

// Set app name explicitly to fix user data directory
app.setName('RewriteLikeMe');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '..', 'public', 'rwlm-logo.png'), // Set window icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Add debugging for web contents
  win.webContents.on('did-finish-load', () => {
    log.info('[WINDOW] Page finished loading');
  });
  
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log.error('[WINDOW] Failed to load page:', { errorCode, errorDescription, validatedURL });
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    log.info(`[RENDERER] ${level}: ${message} (${sourceId}:${line})`);
  });

  if (isDev) {
    log.info('[WINDOW] Loading development server:', VITE_DEV_SERVER_URL);
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    log.info('[WINDOW] Loading production file:', indexPath);
    log.info('[WINDOW] __dirname:', __dirname);
    log.info('[WINDOW] app.isPackaged:', app.isPackaged);
    log.info('[WINDOW] process.env.NODE_ENV:', process.env.NODE_ENV);
    log.info('[WINDOW] File exists:', fs.existsSync(indexPath));
    
    win.loadFile(indexPath).catch(err => {
      log.error('[WINDOW] Failed to load file:', err);
    });
    
    // Open dev tools in production temporarily for debugging
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Ensure external links open in the user's default browser instead of inside Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Also intercept in-page navigations to external sites
  win.webContents.on('will-navigate', (event, url) => {
    // Allow navigating to our own app (dev server or file://), otherwise open externally
    const isAppUrl = (isDev && url.startsWith(VITE_DEV_SERVER_URL)) || url.startsWith('file:');
    if (!isAppUrl && /^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Simple in-memory cache with TTL
const cache = new Map();
const setCache = (key, value, ttlMs = 10 * 60 * 1000) => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};
const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return undefined; }
  return entry.value;
};

const HF_ORG = 'Rewritelikeme';
const HF_API_BASE = 'https://huggingface.co/api/models';
const HF_RESOLVE = (repo, filename) => `https://huggingface.co/${repo}/resolve/main/${filename}`;

// Default paths
const userData = app.getPath('userData');
const rootPath = path.join(userData, 'leadmagnet');
const modelsPath = path.join(rootPath, 'models');
const basesPath = path.join(modelsPath, 'base-models');
const voicesPath = path.join(modelsPath, 'voices');
const llamaBinariesPath = path.join(rootPath, 'llama-binaries');
const logsPath = path.join(rootPath, 'logs');
const downloadsPath = path.join(rootPath, 'downloads', 'tmp');
const onboardingStatePath = path.join(rootPath, 'onboarding.json');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

;[rootPath, modelsPath, basesPath, voicesPath, llamaBinariesPath, logsPath, downloadsPath].forEach(ensureDir);

function readOnboardingState() {
  try {
    if (fs.existsSync(onboardingStatePath)) {
      const raw = fs.readFileSync(onboardingStatePath, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') return data;
    }
  } catch {}
  return { status: 'pending', stage: 'welcome' };
}

async function writeOnboardingState(partial) {
  const current = readOnboardingState();
  const next = { ...current, ...partial };
  await fs.promises.writeFile(onboardingStatePath, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function sanitizeRepo(repo) {
  return repo.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed ${res.status}: ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed ${res.status}: ${url}`);
  return res.text();
}

async function getRepoDetails(repo) {
  const cacheKey = `repo:${repo}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const modelInfo = await fetchJson(`${HF_API_BASE}/${encodeURIComponent(repo)}`);
  const siblings = Array.isArray(modelInfo.siblings) ? modelInfo.siblings : [];
  const hasAdapter = siblings.some(s => s.rfilename === 'adapter.gguf');
  const hasModel = siblings.some(s => s.rfilename === 'model.gguf');

  let infoJson = null;
  try {
    const raw = await fetchText(`https://huggingface.co/${repo}/resolve/main/info.json`);
    infoJson = JSON.parse(raw);
  } catch {
    // info.json missing or invalid; proceed with inference
  }

  let type = infoJson?.type;
  if (!type) {
    if (hasAdapter) type = 'voice';
    else if (hasModel) type = 'base';
  }
  if (type !== 'voice' && type !== 'base') {
    // Unknown or incompatible; skip
    const minimal = { repo, type: 'base', latestRevision: modelInfo.sha };
    setCache(cacheKey, minimal);
    return minimal;
  }

  const sizeEntry = siblings.find(s => s.rfilename === (type === 'voice' ? 'adapter.gguf' : 'model.gguf'));
  const sizeBytes = typeof sizeEntry?.size === 'number' ? sizeEntry.size : undefined;
  const latestRevision = (modelInfo.sha || modelInfo.sha256 || modelInfo.lastModified || modelInfo._id || '').toString() || undefined;
  const contextWindow = typeof infoJson?.contextWindow === 'number' ? infoJson.contextWindow : undefined;
  const baseModelRepo = type === 'voice' ? infoJson?.baseModelRepo : undefined;

  const entry = type === 'voice'
    ? { repo, type: 'voice', latestRevision, sizeBytes, contextWindow, baseModelRepo }
    : { repo, type: 'base', latestRevision, sizeBytes, contextWindow };

  setCache(cacheKey, entry);
  return entry;
}

// IPC endpoints
ipcMain.handle('settings:get', async () => ({
  rootPath, modelsPath, basesPath, voicesPath, llamaBinariesPath, logsPath, downloadsPath,
  llamaServer: { host: '127.0.0.1', portStart: 33333 }, offlineMode: true, allowAutoUpdate: false,
}));
ipcMain.handle('settings:set', async (_evt, partial) => ({ ...partial }));
ipcMain.handle('system:diskSpace', async () => ({ freeBytes: 10n * 1024n * 1024n * 1024n, totalBytes: 100n * 1024n * 1024n * 1024n }));

// Onboarding persistence
ipcMain.handle('onboarding:get', async () => readOnboardingState());
ipcMain.handle('onboarding:set', async (_evt, partial) => writeOnboardingState(partial || {}));

ipcMain.handle('catalog:list', async (_evt, args) => {
  const typeFilter = args?.type;
  const limit = Math.min(Math.max(Number(args?.pageSize) || 20, 1), 50);
  const cacheKey = `org-list:${HF_ORG}:${limit}`;
  let list = getCache(cacheKey);
  if (!list) {
    const models = await fetchJson(`${HF_API_BASE}?author=${encodeURIComponent(HF_ORG)}&limit=${limit}&sort=lastModified&direction=-1`);
    // Map to detailed entries with per-repo fetch (info.json + siblings)
    const entries = [];
    for (const m of models) {
      const repo = (m.modelId || m.id || m.name || '').toString();
      if (!repo || !repo.includes('/')) continue;
      try {
        const entry = await getRepoDetails(repo);
        entries.push(entry);
      } catch {
        // skip
      }
    }
    setCache(cacheKey, entries);
    list = entries;
  }
  const filtered = typeFilter ? list.filter(e => e.type === typeFilter) : list;
  return { entries: filtered, nextPage: undefined };
});

ipcMain.handle('catalog:resolveRepo', async (_evt, repo) => {
  if (!repo || typeof repo !== 'string' || !repo.includes('/')) {
    throw new Error('Invalid repo format. Expected org/name');
  }
  const entry = await getRepoDetails(repo);
  return entry;
});

// Downloads
const downloadTasks = new Map();

async function downloadToFile(url, dest, progressCb, signal) {
  if (signal?.aborted) throw new Error('Aborted');
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const total = Number(res.headers.get('content-length')) || undefined;
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const fileStream = fs.createWriteStream(dest);
  if (!res.body || !res.body.getReader) {
    // Fallback: pipeline if body is Node stream (older Electron)
    await pipeline(res.body, fileStream);
    if (progressCb && total) progressCb(total, total);
    return { totalBytes: total, downloadedBytes: total };
  }
  const reader = res.body.getReader();
  let downloaded = 0;
  while (true) {
    if (signal?.aborted) throw new Error('Aborted');
    const { done, value } = await reader.read();
    if (done) break;
    downloaded += value.byteLength;
    fileStream.write(Buffer.from(value));
    if (progressCb) progressCb(value.byteLength, total);
  }
  fileStream.end();
  return { totalBytes: total, downloadedBytes: downloaded };
}

ipcMain.handle('download:start', async (_evt, args) => {
  const { repo } = args || {};
  let { type } = args || {};
  console.log('[DL] request', args);
  if (!repo || typeof repo !== 'string' || !repo.includes('/')) {
    throw new Error(`Invalid repo format. Expected org/name, got: ${String(repo)}`);
  }
  if (type !== 'voice' && type !== 'base') {
    try {
      const det = await getRepoDetails(repo);
      if (det?.type === 'voice' || det?.type === 'base') type = det.type;
      else throw new Error(`Could not infer type for ${repo}`);
    } catch (e) {
      throw new Error(`Invalid download args: ${e?.message || String(e)}`);
    }
  }
  const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const destRoot = type === 'voice' ? voicesPath : basesPath;
  const folder = path.join(destRoot, sanitizeRepo(repo));
  ensureDir(folder);

  // If already installed (main file exists), short-circuit as completed
  try {
    const mainFile = type === 'voice' ? 'adapter.gguf' : 'model.gguf';
    if (fs.existsSync(path.join(folder, mainFile))) {
      const task = {
        id,
        repo,
        type,
        targetPath: folder,
        status: { state: 'completed', path: folder },
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
      downloadTasks.set(id, task);
      console.log('[DL] already installed, marking completed', { id, repo, type });
      return task;
    }
  } catch {}

  const controller = new AbortController();
  const task = {
    id,
    repo,
    type,
    targetPath: folder,
    status: { state: 'queued' },
    startedAt: Date.now(),
    _controller: controller,
  };
  downloadTasks.set(id, task);

  // Start async download (do not block invoke)
  ;(async () => {
    try {
      console.log('[DL] start', { id, repo, type, folder });
      // Pre-compute total from HF metadata (main file size)
      const details = await getRepoDetails(repo);
      const expectedMainSize = typeof details.sizeBytes === 'number' ? details.sizeBytes : undefined;
      let totalBytes = expectedMainSize || 0;
      let downloadedBytes = 0;
      const setRunning = () => {
        const hasTotal = typeof totalBytes === 'number' && totalBytes > 0;
        task.status = { state: 'running', downloadedBytes, totalBytes: hasTotal ? totalBytes : undefined };
      };
      setRunning();
      // Always fetch info.json
      const infoDest = path.join(folder, 'info.json');
      await downloadToFile(HF_RESOLVE(repo, 'info.json'), infoDest, (inc) => {
        downloadedBytes += inc;
        setRunning();
      }, controller.signal);
      // Optional README
      try { await downloadToFile(HF_RESOLVE(repo, 'README.md'), path.join(folder, 'README.md'), (inc) => { downloadedBytes += inc; setRunning(); }, controller.signal); } catch {}
      if (type === 'voice') {
        await downloadToFile(HF_RESOLVE(repo, 'adapter.gguf'), path.join(folder, 'adapter.gguf'), (inc, t) => {
          if (!expectedMainSize && t && !totalBytes) totalBytes = t; // fallback if we didn't have size
          downloadedBytes += inc;
          setRunning();
        }, controller.signal);
        await downloadToFile(HF_RESOLVE(repo, 'system_prompt.txt'), path.join(folder, 'system_prompt.txt'), (inc) => { downloadedBytes += inc; setRunning(); }, controller.signal);
      } else {
        await downloadToFile(HF_RESOLVE(repo, 'model.gguf'), path.join(folder, 'model.gguf'), (inc, t) => {
          if (!expectedMainSize && t && !totalBytes) totalBytes = t;
          downloadedBytes += inc;
          setRunning();
        }, controller.signal);
      }
      task.status = { state: 'completed', path: folder };
      task.completedAt = Date.now();
      console.log('[DL] completed', { id, repo, type });
      // Persist installed metadata for later update checks and local listing
      try {
        const installedMeta = {
          repo,
          installedRevision: details.latestRevision || null,
          installedAt: new Date().toISOString(),
          type,
        };
        await fs.promises.writeFile(path.join(folder, 'installed.json'), JSON.stringify(installedMeta, null, 2), 'utf-8');
      } catch (e) {
        console.warn('[DL] failed to write installed.json', { id, repo, error: e?.message || String(e) });
      }
      // Invalidate catalog cache for freshness
      cache.delete(`repo:${repo}`);
    } catch (e) {
      if (controller.signal.aborted) {
        task.status = { state: 'cancelled' };
        console.log('[DL] cancelled', { id, repo });
      } else {
        const msg = e?.message || String(e) || 'Download failed';
        console.error('[DL] failed', { id, repo, error: msg });
        task.status = { state: 'failed', error: msg };
      }
    }
  })();

  return task;
});

ipcMain.handle('download:status', async (_evt, id) => {
  const task = downloadTasks.get(id);
  if (!task) throw new Error('Unknown download id');
  const { _controller, ...safe } = task;
  return safe;
});

ipcMain.handle('download:cancel', async (_evt, id) => {
  const task = downloadTasks.get(id);
  if (task && task._controller) {
    try { task._controller.abort(); } catch {}
  }
  return { ok: true };
});

ipcMain.handle('download:list', async () => {
  const arr = Array.from(downloadTasks.values()).map(t => {
    const { _controller, ...safe } = t;
    return safe;
  });
  return arr;
});

ipcMain.handle('system:openPath', async (_evt, target) => {
  if (!target) return { ok: false };
  try {
    const res = await shell.openPath(target);
    return { ok: !res, error: res || undefined };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
});

// Local models listing (minimal)
async function listLocalModels(dir, type) {
  let entries = [];
  try {
    const names = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const d of names) {
      if (!d.isDirectory()) continue;
      const folder = path.join(dir, d.name);
      try {
        const infoPath = path.join(folder, 'info.json');
        const installedPath = path.join(folder, 'installed.json');
        let info = null;
        let installed = null;
        try { info = JSON.parse(await fs.promises.readFile(infoPath, 'utf-8')); } catch {}
        try { installed = JSON.parse(await fs.promises.readFile(installedPath, 'utf-8')); } catch {}
        // Determine repo and revision
        const repo = installed?.repo || null;
        const revision = installed?.installedRevision || null;
        // quick verified check by presence of main file
        const mainFile = type === 'voice' ? 'adapter.gguf' : 'model.gguf';
        const existsMain = fs.existsSync(path.join(folder, mainFile));
        const base = type === 'voice' && info && typeof info.baseModelRepo === 'string' ? info.baseModelRepo : undefined;
        entries.push({
          id: d.name,
          type,
          repo: repo || d.name,
          revision: revision || undefined,
          path: folder,
          bytesOnDisk: undefined,
          contextWindow: typeof info?.contextWindow === 'number' ? info.contextWindow : undefined,
          verified: existsMain,
          ...(type === 'voice' && base ? { baseModelRepo: base } : {}),
        });
      } catch {}
    }
  } catch {}
  return entries;
}

ipcMain.handle('models:list', async () => {
  const bases = await listLocalModels(basesPath, 'base');
  const voices = await listLocalModels(voicesPath, 'voice');
  return { bases, voices };
});

// Compute aggregate counts and disk usage for installed models
async function computeFolderSize(root) {
  try {
    const stat = await fs.promises.stat(root);
    if (!stat.isDirectory()) {
      return stat.size || 0;
    }
  } catch {
    return 0;
  }
  let total = 0;
  try {
    const entries = await fs.promises.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(root, entry.name);
      try {
        if (entry.isFile()) {
          const st = await fs.promises.stat(p);
          total += st.size || 0;
        } else if (entry.isDirectory()) {
          total += await computeFolderSize(p);
        }
      } catch {}
    }
  } catch {}
  return total;
}

ipcMain.handle('models:stats', async () => {
  try {
    let baseCount = 0;
    let voiceCount = 0;
    let baseBytes = 0;
    let voiceBytes = 0;

    try {
      const baseDirs = await fs.promises.readdir(basesPath, { withFileTypes: true });
      for (const d of baseDirs) {
        if (!d.isDirectory()) continue;
        baseCount += 1;
        baseBytes += await computeFolderSize(path.join(basesPath, d.name));
      }
    } catch {}

    try {
      const voiceDirs = await fs.promises.readdir(voicesPath, { withFileTypes: true });
      for (const d of voiceDirs) {
        if (!d.isDirectory()) continue;
        voiceCount += 1;
        voiceBytes += await computeFolderSize(path.join(voicesPath, d.name));
      }
    } catch {}

    const totalBytes = baseBytes + voiceBytes;
    return {
      bases: { count: baseCount, bytes: baseBytes },
      voices: { count: voiceCount, bytes: voiceBytes },
      totalBytes,
    };
  } catch (e) {
    return { bases: { count: 0, bytes: 0 }, voices: { count: 0, bytes: 0 }, totalBytes: 0 };
  }
});

ipcMain.handle('models:verify', async (_evt, repo) => {
  try {
    if (!repo || typeof repo !== 'string' || !repo.includes('/')) {
      return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: `Invalid repo format: ${String(repo)}` } };
    }
    const voiceFolder = path.join(voicesPath, sanitizeRepo(repo));
    const baseFolder = path.join(basesPath, sanitizeRepo(repo));
    const voiceMain = path.join(voiceFolder, 'adapter.gguf');
    const baseMain = path.join(baseFolder, 'model.gguf');
    const voiceInfoPath = path.join(voiceFolder, 'info.json');
    const baseInfoPath = path.join(baseFolder, 'info.json');

    const voiceExists = fs.existsSync(voiceFolder);
    const baseExists = fs.existsSync(baseFolder);

    if (!voiceExists && !baseExists) {
      return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: `Model not found for ${repo}` } };
    }

    // Determine type
    let type = null;
    if (voiceExists && fs.existsSync(voiceMain)) type = 'voice';
    else if (baseExists && fs.existsSync(baseMain)) type = 'base';
    else {
      // Fallback to info.json
      try {
        if (voiceExists && fs.existsSync(voiceInfoPath)) {
          const info = JSON.parse(fs.readFileSync(voiceInfoPath, 'utf-8'));
          if (info?.type === 'voice') type = 'voice';
        }
      } catch {}
      try {
        if (!type && baseExists && fs.existsSync(baseInfoPath)) {
          const info = JSON.parse(fs.readFileSync(baseInfoPath, 'utf-8'));
          if (info?.type === 'base') type = 'base';
        }
      } catch {}
    }

    if (type === 'base') {
      if (!fs.existsSync(baseMain)) {
        return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'Missing model.gguf' } };
      }
      try {
        const st = fs.statSync(baseMain);
        if (!st.isFile() || st.size < 100 * 1024 * 1024) {
          return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'model.gguf too small' } };
        }
      } catch (e) {
        return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: e?.message || 'Cannot stat model.gguf' } };
      }
      if (fs.existsSync(baseInfoPath)) {
        try {
          const info = JSON.parse(fs.readFileSync(baseInfoPath, 'utf-8'));
          if (info?.type && info.type !== 'base') {
            return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'info.json type mismatch' } };
          }
        } catch (e) {
          return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: `Invalid info.json: ${e?.message || 'parse error'}` } };
        }
      }
      return { ok: true };
    }

    if (type === 'voice') {
      if (!fs.existsSync(voiceMain)) {
        return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'Missing adapter.gguf' } };
      }
      try {
        const st = fs.statSync(voiceMain);
        if (!st.isFile() || st.size < 1 * 1024 * 1024) {
          return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'adapter.gguf too small' } };
        }
      } catch (e) {
        return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: e?.message || 'Cannot stat adapter.gguf' } };
      }
      const sysPrompt = path.join(voiceFolder, 'system_prompt.txt');
      if (!fs.existsSync(sysPrompt)) {
        return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'Missing system_prompt.txt' } };
      }
      try {
        const st = fs.statSync(sysPrompt);
        if (!st.isFile() || st.size <= 0) {
          return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'system_prompt.txt empty' } };
        }
      } catch (e) {
        return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: e?.message || 'Cannot stat system_prompt.txt' } };
      }
      if (fs.existsSync(voiceInfoPath)) {
        try {
          const info = JSON.parse(fs.readFileSync(voiceInfoPath, 'utf-8'));
          if (info?.type && info.type !== 'voice') {
            return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'info.json type mismatch' } };
          }
          if (!info?.baseModelRepo || typeof info.baseModelRepo !== 'string') {
            return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'info.json missing baseModelRepo' } };
          }
        } catch (e) {
          return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: `Invalid info.json: ${e?.message || 'parse error'}` } };
        }
      } else {
        return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'Missing info.json' } };
      }
      return { ok: true };
    }

    return { ok: false, error: { code: 'MODEL_STRUCTURE_INVALID', message: 'Unable to determine model type' } };
  } catch (e) {
    return { ok: false, error: { code: 'UNKNOWN', message: e?.message || 'Verify failed' } };
  }
});

ipcMain.handle('models:delete', async (_evt, repo) => {
  try {
    if (!repo || typeof repo !== 'string' || !repo.includes('/')) {
      return { ok: false, error: { code: 'UNKNOWN', message: `Invalid repo format: ${String(repo)}` } };
    }
    const voiceFolder = path.join(voicesPath, sanitizeRepo(repo));
    const baseFolder = path.join(basesPath, sanitizeRepo(repo));
    let folder = null;
    if (fs.existsSync(voiceFolder)) folder = voiceFolder;
    else if (fs.existsSync(baseFolder)) folder = baseFolder;
    if (!folder) {
      return { ok: false, error: { code: 'UNKNOWN', message: `Model not found: ${repo}` } };
    }
    await fs.promises.rm(folder, { recursive: true, force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: { code: 'UNKNOWN', message: e?.message || 'Delete failed' } };
  }
});

// Helper to delete by explicit type (base or voice) regardless of mirror folder
ipcMain.handle('models:deleteByType', async (_evt, { repo, type }) => {
  try {
    if (!repo || typeof repo !== 'string' || !repo.includes('/')) {
      return { ok: false, error: { code: 'UNKNOWN', message: `Invalid repo format: ${String(repo)}` } };
    }
    const dir = type === 'voice' ? voicesPath : basesPath;
    const folder = path.join(dir, sanitizeRepo(repo));
    await fs.promises.rm(folder, { recursive: true, force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: { code: 'UNKNOWN', message: e?.message || 'Delete failed' } };
  }
});

let activeServer = { proc: null, port: null, host: '127.0.0.1', url: null };
let activeSelection = { baseRepo: null, voiceRepo: null };

// Simple in-memory conversion jobs
const convertJobs = new Map(); // jobId -> { controller, sender }

// Text chunking helper similar to backend
function chunkTextWithPositions(text, maxCharLength = 830, minCharLength = 50) {
  console.log(`[CHUNKING] Starting chunkTextWithPositions: ${text.length} chars, maxLen=${maxCharLength}`);
  const chunks = [];
  let pos = 0;
  while (pos < text.length) {
    let sepStart = text.indexOf('\n\n', pos);
    let paraEnd = sepStart !== -1 ? sepStart : text.length;
    let paragraphLength = paraEnd - pos;
    if (paragraphLength > 0) {
      if (paragraphLength <= maxCharLength) {
        chunks.push({start: pos, end: paraEnd});
      } else {
        // Split large paragraph granularly
        let currentPos = pos;
        while (currentPos < paraEnd) {
          let endPos = Math.min(currentPos + maxCharLength, paraEnd);
          if (endPos === paraEnd) {
            if (endPos > currentPos) {
              chunks.push({start: currentPos, end: endPos});
            }
            break;
          }
          // Search for natural boundary
          const searchLimit = Math.min(endPos + 300, paraEnd);
          const searchText = text.slice(endPos, searchLimit);
          let boundaryPos = -1;
          const boundaryChars = ['.', '!', '?', '\n'];
          for (const char of boundaryChars) {
            const posInSearch = searchText.indexOf(char);
            if (posInSearch !== -1 && (boundaryPos === -1 || posInSearch < boundaryPos)) {
              boundaryPos = posInSearch;
            }
          }
          if (boundaryPos !== -1) {
            endPos = endPos + boundaryPos + 1;
            console.log(`[CHUNKING] Found forward boundary at ${endPos}, char: "${text[endPos-1]}"`);
          } else {
            // No forward boundary found: snap backward to prior whitespace to avoid mid-word splits
            const backLimit = Math.max(currentPos, endPos - 50);
            const backText = text.slice(backLimit, endPos);
            let backPos = -1;
            for (let j = backText.length - 1; j >= 0; j--) {
              if (/\s/.test(backText[j])) { backPos = j; break; }
            }
            if (backPos !== -1) {
              const snapped = backLimit + backPos + 1; // include the whitespace
              if (snapped > currentPos) {
                console.log(`[CHUNKING] No forward boundary, snapped backward from ${endPos} to ${snapped}`);
                endPos = snapped;
              }
            } else {
              console.log(`[CHUNKING] No forward/backward boundary found, keeping hard split at ${endPos}`);
            }
          }
          // Ensure no mid-word by checking if endPos is mid-word
          // If so, snap forward to next whitespace
          if (/\w/.test(text[endPos - 1]) && endPos < paraEnd) {
            const fwdText = text.slice(endPos, Math.min(endPos + 50, paraEnd));
            const fwdWs = fwdText.search(/\s/);
            if (fwdWs !== -1) {
              endPos += fwdWs + 1;
              console.log(`[CHUNKING] Snapped forward to avoid mid-word: ${endPos}`);
            }
          }
          const chunkLength = endPos - currentPos;
          if (chunkLength > 0) {
            chunks.push({start: currentPos, end: endPos});
            console.log(`[CHUNKING] Pushed chunk: start=${currentPos}, end=${endPos}, len=${chunkLength}`);
          }
          currentPos = endPos;
        }
      }
    }
    // Move to next paragraph, skipping the separator
    if (sepStart !== -1) {
      const sepMatch = text.slice(sepStart).match(/^\n\n+/);
      const sepLength = sepMatch ? sepMatch[0].length : 0;
      pos = sepStart + sepLength;
    } else {
      pos = text.length;
    }
  }
  // Post-process: sanitize separators to preserve leading whitespace and move letters into next chunk
  console.log(`[CHUNKING] Post-processing ${chunks.length} chunks to sanitize separators`);
  for (let i = 0; i < chunks.length - 1; i++) {
    const prevEnd = chunks[i].end;
    const nextStart = chunks[i + 1].start;
    const between = text.slice(prevEnd, nextStart);
    if (!between) continue;
    if (/[^ \t\n\r]/.test(between)) {  // ANY non-whitespace
      chunks[i + 1].start = prevEnd;  // Merge whole separator into next
      console.log(`[CHUNKING] Merged contentful separator ${i} into next chunk`);
    }
    // If contentIdx === -1, separator is all whitespace/punctuation; leave as-is
  }
  console.log(`[CHUNKING] Completed chunking: ${chunks.length} chunks created`);
  return chunks;
}

function platformBinPath() {
  const isWin = process.platform === 'win32';
  const bin = isWin ? 'llama-server.exe' : 'llama-server';
  const darwinArch = process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64';

  // In packaged app, binaries are in app resources
  // In development, they're in the frontend/llama-binaries folder
  const binariesBasePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'llama-binaries')
    : path.join(__dirname, '..', 'llama-binaries');

  const platformDir = process.platform === 'darwin' ? darwinArch
    : isWin ? 'win-x64' : 'linux-x64';

  const candidates = [
    // Primary platform-specific path
    path.join(binariesBasePath, platformDir, bin),
  ];

  // On macOS, try both arch folders to be robust (Rosetta or mismatched downloads)
  if (process.platform === 'darwin') {
    const otherArch = darwinArch === 'mac-arm64' ? 'mac-x64' : 'mac-arm64';
    candidates.push(path.join(binariesBasePath, otherArch, bin));
  }

  // Fallbacks for other platforms
  if (!isWin) candidates.push(path.join(binariesBasePath, 'linux-x64', bin));
  if (!isWin) candidates.push(path.join(binariesBasePath, 'mac-x64', bin));
  if (!isWin) candidates.push(path.join(binariesBasePath, 'mac-arm64', bin));
  if (isWin) candidates.push(path.join(binariesBasePath, 'win-x64', bin));

  // Also check the legacy llamaBinariesPath for backward compatibility
  const legacyCandidates = [
    path.join(llamaBinariesPath, platformDir, bin),
    path.join(llamaBinariesPath, bin),
  ];
  candidates.push(...legacyCandidates);

  for (const p of candidates) { 
    if (fs.existsSync(p)) {
      console.log(`[PLATFORM] Found llama-server at: ${p}`);
      return p; 
    }
  }

  // Return primary platform-specific path as the best hint
  const primaryPath = path.join(binariesBasePath, platformDir, bin);
  console.log(`[PLATFORM] No llama-server found, returning primary path: ${primaryPath}`);
  return primaryPath;
}

async function portIsFree(host, port) {
  return new Promise(resolve => {
    const sock = net.connect({ host, port });
    let done = false;
    const finish = (free) => { if (done) return; done = true; try { sock.destroy(); } catch {} resolve(free); };
    sock.once('error', () => finish(true));
    sock.once('connect', () => finish(false));
    setTimeout(() => finish(true), 300);
  });
}

async function findOpenPort(host, startPort, maxTries = 20) {
  let p = startPort;
  for (let i = 0; i < maxTries; i++, p++) {
    const free = await portIsFree(host, p);
    if (free) return p;
  }
  throw new Error('No free port available for llama.cpp server');
}

async function ensureBaseInstalled(repo) {
  const folder = path.join(basesPath, sanitizeRepo(repo));
  const gguf = path.join(folder, 'model.gguf');
  if (fs.existsSync(gguf)) return { folder, gguf };
  ensureDir(folder);
  console.log('[ACT] base missing, downloading', repo);
  await downloadToFile(HF_RESOLVE(repo, 'info.json'), path.join(folder, 'info.json'));
  try { await downloadToFile(HF_RESOLVE(repo, 'README.md'), path.join(folder, 'README.md')); } catch {}
  await downloadToFile(HF_RESOLVE(repo, 'model.gguf'), gguf);
  return { folder, gguf };
}

function ensureVoiceInstalled(repo) {
  const folder = path.join(voicesPath, sanitizeRepo(repo));
  const adapter = path.join(folder, 'adapter.gguf');
  const sysPrompt = path.join(folder, 'system_prompt.txt');
  if (!fs.existsSync(adapter)) throw new Error(`Voice not installed: missing adapter.gguf for ${repo}`);
  if (!fs.existsSync(sysPrompt)) throw new Error(`Voice not installed: missing system_prompt.txt for ${repo}`);
  return { folder, adapter, sysPrompt };
}

async function waitServerUp(host, port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const free = await portIsFree(host, port);
    if (!free) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function waitServerReady(host, port, timeoutMs = 60000) {
  const start = Date.now();
  const url = `http://${host}:${port}/v1/chat/completions`;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
          max_tokens: 1,
        }),
      });
      if (res.ok) {
        // Quick sanity parse
        try { await res.json(); } catch {}
        return true;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

ipcMain.handle('activation:activate', async (_evt, sel) => {
  try {
    const baseRepo = sel?.baseRepo;
    const voiceRepo = sel?.voiceRepo;
    if (!baseRepo && !voiceRepo) throw new Error('Missing activation selection');

    // Resolve base repo from voice if not provided
    let baseRepoFinal = baseRepo;
    if (!baseRepoFinal && voiceRepo) {
      const details = await getRepoDetails(voiceRepo);
      if (!details?.baseModelRepo) throw new Error('Voice info missing baseModelRepo');
      baseRepoFinal = details.baseModelRepo;
    }
    if (!baseRepoFinal) throw new Error('Base repo could not be determined');

    // Ensure installed
    const base = await ensureBaseInstalled(baseRepoFinal);
    let voice = null;
    if (voiceRepo) voice = ensureVoiceInstalled(voiceRepo);

    // Choose binary and port
    const bin = platformBinPath();
    if (!fs.existsSync(bin)) {
      // Provide a clearer error with suggested locations
      const hint = process.platform === 'darwin'
        ? `Expected at one of: ${[
            path.join(llamaBinariesPath, 'mac-arm64', 'llama-server'),
            path.join(llamaBinariesPath, 'mac-x64', 'llama-server'),
          ].join(', ')}`
        : process.platform === 'win32'
        ? `Expected at: ${path.join(llamaBinariesPath, 'win-x64', 'llama-server.exe')}`
        : `Expected at: ${path.join(llamaBinariesPath, 'linux-x64', 'llama-server')}`;
      throw new Error(`LLAMA_BINARY_MISSING: ${bin}. ${hint}`);
    }
    const host = '127.0.0.1';
    const startPort = 33333;
    const port = await findOpenPort(host, startPort);

    // Spawn server
    const args = ['--model', base.gguf, '--host', host, '--port', String(port), '--chat-template', 'mistral-v1'];
    if (voice?.adapter) args.push('--lora', voice.adapter);
    console.log('[ACT] spawn', bin, args.join(' '));
    const proc = spawn(bin, args, { stdio: 'pipe' });
    proc.on('exit', (code, sig) => {
      console.log('[ACT] llama-server exited', { code, sig });
      activeServer = { proc: null, port: null, host, url: null };
      activeSelection = { baseRepo: null, voiceRepo: null };
    });
    proc.stderr.on('data', d => console.log('[LLAMA]', d.toString().trim()));
    proc.stdout.on('data', d => console.log('[LLAMA]', d.toString().trim()));

    const up = await waitServerUp(host, port, 20000);
    if (!up) {
      try { proc.kill(); } catch {}
      throw new Error('LLAMA_UNREACHABLE: server did not start in time');
    }

    activeServer = { proc, port, host, url: `http://${host}:${port}` };
    activeSelection = { baseRepo: baseRepoFinal, voiceRepo: voiceRepo || null };
    // Wait until the server accepts simple completion requests
    const ready = await waitServerReady(host, port, 60000);
    if (!ready) {
      try { proc.kill(); } catch {}
      activeServer = { proc: null, port: null, host, url: null };
      activeSelection = { baseRepo: null, voiceRepo: null };
      throw new Error('LLAMA_UNREACHABLE: server not ready in time');
    }
    return { active: true, base: { repo: baseRepoFinal, path: base.folder }, voice: voiceRepo ? { repo: voiceRepo, path: voice.folder } : undefined, server: { pid: proc.pid, port, url: activeServer.url } };
  } catch (e) {
    const msg = e?.message || String(e) || 'Activation failed';
    console.error('[ACT] failed', msg);
    throw new Error(msg);
  }
});

ipcMain.handle('activation:deactivate', async () => {
  try {
    if (activeServer.proc) {
      try { activeServer.proc.kill(); } catch {}
    }
    activeServer = { proc: null, port: null, host: '127.0.0.1', url: null };
    activeSelection = { baseRepo: null, voiceRepo: null };
    return { ok: true };
  } catch (e) {
    return { ok: false };
  }
});

ipcMain.handle('activation:state', async () => ({
  active: !!activeServer.proc,
  base: activeSelection.baseRepo ? { repo: activeSelection.baseRepo } : undefined,
  voice: activeSelection.voiceRepo ? { repo: activeSelection.voiceRepo } : undefined,
  server: { pid: activeServer?.proc?.pid, port: activeServer.port, url: activeServer.url },
}));

ipcMain.handle('model:checkUpdate', async () => ({ hasUpdate: false }));
ipcMain.handle('model:update', async (_evt, repo) => ({ id: 'upd1', repo, type: 'voice', targetPath: '/tmp', status: { state: 'queued' } }));

ipcMain.handle('convert:start', async (evt, req) => {
  if (!activeServer?.url) throw new Error('LLAMA_UNREACHABLE: server not active');
  const text = (req?.text || '').toString();
  if (!text || text.trim().length === 0) throw new Error('CONVERSION_FAILED: empty text');

  // Build prompt using active voice system prompt if present
  let systemPrompt = 'You are a helpful assistant.';
  let styleguide = '';
  try {
    if (activeSelection?.voiceRepo) {
      const voiceFolder = path.join(voicesPath, sanitizeRepo(activeSelection.voiceRepo));
      const sysPath = path.join(voiceFolder, 'system_prompt.txt');
      if (fs.existsSync(sysPath)) {
        systemPrompt = await fs.promises.readFile(sysPath, 'utf-8');
      }
      // Also check for optional styleguide
      const stylePath = path.join(voiceFolder, 'styleguide.txt');
      if (fs.existsSync(stylePath)) {
        styleguide = await fs.promises.readFile(stylePath, 'utf-8');
        console.log('[CONVERT] Found styleguide.txt');
      } else {
        console.log('[CONVERT] No styleguide.txt found at:', stylePath);
      }
    }
  } catch {}

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const channel = `convert:stream:${jobId}`;

  // Chunk the text
  console.log(`[CONVERT] Chunking text (${text.length} chars)`);
  const chunks = chunkTextWithPositions(text);
  console.log(`[CONVERT] Split into ${chunks.length} chunks`);

  // Emit start with total chunks
  try { evt.sender.send(channel, { type: 'start', totalChunks: chunks.length }); } catch {}

  // Send chunk positions event
  console.log('[CONVERT] Sending chunk_positions event with', chunks.length, 'chunks');
  try { evt.sender.send(channel, { type: 'chunk_positions', chunkPositions: chunks, baseText: text }); } catch {}

  const controller = new AbortController();
  convertJobs.set(jobId, { controller, sender: evt.sender });

  ;(async () => {
    try {
      const chunkResults = [];
      let totalTokens = 0;
      let totalMs = 0;
      
      // Process chunks sequentially for now (can parallelize later)
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkText = text.slice(chunk.start, chunk.end);
        const startTime = Date.now();
        
        try { evt.sender.send(channel, { type: 'chunkStart', chunkIndex: i }); } catch {}
        
        // Build prompt for this chunk
        let chunkPrompt = systemPrompt;
        if (styleguide) {
          chunkPrompt += `\n\n<styleguide>\n${styleguide}\n</styleguide>`;
        }
        chunkPrompt += `\n\n<input>\n${chunkText}\n</input>`;
        

        const messages = [
          {
            role: 'user',
            content: `${systemPrompt + (styleguide ? `\n\n<styleguide>\n${styleguide}\n</styleguide>` : '')}\n\n<input>\n${chunkText}\n</input>`
          }
        ]
        console.log(messages)
        const body = {
          messages: messages,
          temperature: req?.sampling?.params?.temperature ?? 1.2,
          top_k: req?.sampling?.params?.top_k ?? 40,
          top_p: req?.sampling?.params?.top_p ?? 0.9,
          min_p: req?.sampling?.params?.min_p ?? 0.2,
          repeat_penalty: req?.sampling?.params?.repeat_penalty ?? 1.1,
          max_tokens: req?.sampling?.params?.max_tokens ?? 2048,
          stop: ['</rephrase>', '<input>', '</input>'],
          stream: true,
        };
        
        const res = await fetch(`${activeServer.url}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Server error ${res.status}: ${errText || 'unknown'}`);
        }
        
        const reader = res.body?.getReader?.();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let chunkResult = '';
        // Streaming tag-aware parser that works even if server stops at the close tag
        let carry = '';
        let haveOpen = false;
        let haveClosed = false;
        let stopStreaming = false;

        const OPEN_TAG = '<rephrase>';
        const CLOSE_TAG = '</rephrase>';
        const CLOSE_TAG_OVERLAP = 12; // keep overlap to detect close tag across chunk boundaries

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done || stopStreaming) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;
              if (line === 'data: [DONE]') { stopStreaming = true; break; }

              try {
                const obj = JSON.parse(line.slice(6));
                const content = obj?.choices?.[0]?.delta?.content;

                if (typeof content === 'string' && content.length > 0) {
                  console.log(`[CONVERT] Chunk ${i}: Received content: "${content}"`);
                  if (!haveOpen) {
                    carry += content;
                    const openIdx = carry.indexOf(OPEN_TAG);
                    if (openIdx !== -1) {
                      haveOpen = true;
                      carry = carry.slice(openIdx + OPEN_TAG.length);
                      if (carry) {
                        chunkResult += carry;
                        try { evt.sender.send(channel, { type: 'token', chunkIndex: i, token: carry }); } catch {}
                        carry = '';
                      }
                    } else {
                      // Limit growth while waiting for open tag
                      if (carry.length > 64) carry = carry.slice(-64);
                    }
                  } else if (!haveClosed) {
                    carry += content;
                    const closeIdx = carry.indexOf(CLOSE_TAG);
                    // Also treat '</rephrase' (without the closing '>') as a hard close
                    const closePartialIdx = closeIdx === -1 ? carry.indexOf('</rephrase') : -1;
                    const effectiveCloseIdx = closeIdx !== -1 ? closeIdx : closePartialIdx;
                    if (effectiveCloseIdx !== -1) {
                      const toEmit = carry.slice(0, effectiveCloseIdx);
                      if (toEmit) {
                        chunkResult += toEmit;
                        try { evt.sender.send(channel, { type: 'token', chunkIndex: i, token: toEmit }); } catch {}
                      }
                      haveClosed = true;
                      stopStreaming = true;
                      break;
                    } else {
                      // Emit safe portion, keep overlap to catch a split close tag
                      if (carry.length > CLOSE_TAG_OVERLAP) {
                        const safePart = carry.slice(0, carry.length - CLOSE_TAG_OVERLAP);
                        if (safePart) {
                          chunkResult += safePart;
                          try { evt.sender.send(channel, { type: 'token', chunkIndex: i, token: safePart }); } catch {}
                        }
                        carry = carry.slice(-CLOSE_TAG_OVERLAP);
                      }
                    }
                  }
                }
              } catch (e) {
                console.error('[CONVERT] Error parsing SSE:', e);
              }
            }
          }
        }

        // Flush any remaining buffered content after open tag if stream ended before close tag
        if (haveOpen && !haveClosed && carry) {
          // Remove any trailing partial close-tag prefix
          const prefixes = [
            '</rephrase>', '</rephras', '</rephra', '</rephr', '</reph', '</rep', '</re', '</r', '</', '<'
          ];
          for (const pref of prefixes) {
            if (carry.endsWith(pref) && pref !== '</rephrase>') {
              carry = carry.slice(0, -pref.length);
              break;
            }
          }
          if (carry) {
            chunkResult += carry;
            try { evt.sender.send(channel, { type: 'token', chunkIndex: i, token: carry }); } catch {}
          }
        }
        
        const msElapsed = Date.now() - startTime;
        totalMs += msElapsed;
        
        // If no <rephrase> was ever found, leave chunkResult as-is (likely empty) rather than emitting partial tag fragments
        
        const result = {
          chunkIndex: i,
          text: chunkResult,
          tokensGenerated: chunkResult.length, // Approximate
          msElapsed
        };
        
        console.log(`[CONVERT] Chunk ${i} complete. Result: "${chunkResult.substring(0, 100)}..."`);
        
        chunkResults.push(result);
        totalTokens += result.tokensGenerated;
        
        try {
          evt.sender.send(channel, { type: 'chunkComplete', chunkIndex: i, result });
          // Emit exact original separator after this chunk to assist streaming UIs when template is not yet set
          const nextStart = (i + 1 < chunks.length) ? chunks[i + 1].start : text.length;
          const separator = text.slice(chunks[i].end, nextStart);
          if (separator) {
            evt.sender.send(channel, { type: 'separator', chunkIndex: i, separator });
          }
        } catch {}
      }
      
      // Stitch together final result
      let concatenatedText = '';
      for (let i = 0; i < chunks.length; i++) {
        concatenatedText += chunkResults[i].text;
        
        // Add separator between chunks
        if (i < chunks.length - 1) {
          const separator = text.slice(chunks[i].end, chunks[i + 1].start);
          concatenatedText += separator;
        }
      }
      
      // Add any trailing text after last chunk
      if (chunks.length > 0 && chunks[chunks.length - 1].end < text.length) {
        concatenatedText += text.slice(chunks[chunks.length - 1].end);
      }
      
      try {
        evt.sender.send(channel, {
          type: 'complete',
          result: {
            concatenatedText,
            chunks: chunkResults,
            totalTokens,
            totalMs
          }
        });
      } catch {}
    } catch (e) {
      const message = e?.message || 'CONVERSION_FAILED';
      try { evt.sender.send(channel, { type: 'error', message }); } catch {}
    } finally {
      convertJobs.delete(jobId);
    }
  })();

  return { jobId };
});

ipcMain.handle('convert:cancel', async (_evt, jobId) => {
  const job = convertJobs.get(jobId);
  if (job?.controller) {
    try { job.controller.abort(); } catch {}
    convertJobs.delete(jobId);
  }
  return { ok: true };
});


