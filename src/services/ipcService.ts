import type {
  AppSettings,
  CatalogEntry,
  ConversionJobRequest,
  ConversionStreamEvent,
  DiskSpaceInfo,
  DownloadTask,
  LocalActivationState,
  LocalBaseModel,
  LocalVoiceModel,
  ModelType,
} from '../types/localModels';

// In a browser (non-Electron) context, window.electron may be undefined.
// We provide graceful fallbacks for development.
// Define a minimal shape for our IPC bridge.
type IpcEvent = unknown;
type IpcRendererLike = {
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
  on: (channel: string, listener: (event: IpcEvent, ...args: unknown[]) => void) => void;
  removeAllListeners: (channel: string) => void;
};

const getIpc = (): IpcRendererLike | null => {
  const w = window as unknown as { electron?: { ipc?: IpcRendererLike } };
  const ipc: IpcRendererLike | undefined = w?.electron?.ipc;
  return ipc ?? null;
};

export const settings = {
  get: async (): Promise<AppSettings> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<AppSettings>('settings:get');
  },
  set: async (partial: Partial<AppSettings>): Promise<AppSettings> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<AppSettings>('settings:set', partial);
  },
};

export const system = {
  diskSpace: async (): Promise<DiskSpaceInfo> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<DiskSpaceInfo>('system:diskSpace');
  },
  openPath: async (p: string): Promise<{ ok: boolean; error?: string }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ ok: boolean; error?: string }>('system:openPath', p);
  },
};

export type OnboardingState = {
  status: 'pending' | 'in_progress' | 'completed';
  stage?: 'welcome' | 'downloading' | 'activating' | 'ready' | 'convert_hint' | 'converting' | 'voice_explore' | 'outro' | 'apology';
  downloadIds?: { voiceId?: string; baseId?: string };
  error?: string;
};

export const onboarding = {
  get: async (): Promise<OnboardingState> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<OnboardingState>('onboarding:get');
  },
  set: async (partial: Partial<OnboardingState>): Promise<OnboardingState> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<OnboardingState>('onboarding:set', partial);
  },
};

export const catalog = {
  list: async (args?: { type?: ModelType; page?: number; pageSize?: number }): Promise<{ entries: CatalogEntry[]; nextPage?: number }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ entries: CatalogEntry[]; nextPage?: number }>('catalog:list', args ?? {});
  },
  resolveRepo: async (repo: string): Promise<CatalogEntry> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<CatalogEntry>('catalog:resolveRepo', repo);
  },
};

export const models = {
  list: async (): Promise<{ bases: LocalBaseModel[]; voices: LocalVoiceModel[] }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ bases: LocalBaseModel[]; voices: LocalVoiceModel[] }>('models:list');
  },
  stats: async (): Promise<{ bases: { count: number; bytes: number }; voices: { count: number; bytes: number }; totalBytes: number }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ bases: { count: number; bytes: number }; voices: { count: number; bytes: number }; totalBytes: number }>('models:stats');
  },
  verify: async (repo: string): Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ ok: true } | { ok: false; error: { code: string; message: string } }>('models:verify', repo);
  },
  delete: async (repo: string): Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ ok: true } | { ok: false; error: { code: string; message: string } }>('models:delete', repo);
  },
};

export const modelAdmin = {
  deleteByType: async (repo: string, type: ModelType): Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ ok: true } | { ok: false; error: { code: string; message: string } }>('models:deleteByType', { repo, type });
  },
};

export const downloads = {
  start: async (args: { repo: string; type: ModelType }): Promise<DownloadTask> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<DownloadTask>('download:start', args);
  },
  status: async (id: string): Promise<DownloadTask> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<DownloadTask>('download:status', id);
  },
  cancel: async (id: string): Promise<{ ok: true }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ ok: true }>('download:cancel', id);
  },
  list: async (): Promise<DownloadTask[]> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<DownloadTask[]>('download:list');
  },
};

export const activation = {
  activate: async (sel: { baseRepo: string; voiceRepo?: string }): Promise<LocalActivationState> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<LocalActivationState>('activation:activate', sel);
  },
  deactivate: async (): Promise<{ ok: true }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ ok: true }>('activation:deactivate');
  },
  state: async (): Promise<LocalActivationState> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<LocalActivationState>('activation:state');
  },
};

export const updates = {
  check: async (repo: string): Promise<{ hasUpdate: boolean; latestRevision?: string }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ hasUpdate: boolean; latestRevision?: string }>('model:checkUpdate', repo);
  },
  update: async (repo: string): Promise<DownloadTask> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<DownloadTask>('model:update', repo);
  },
};

export const convert = {
  start: async (req: ConversionJobRequest): Promise<{ jobId: string }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ jobId: string }>('convert:start', req);
  },
  onStream: (jobId: string, handler: (e: ConversionStreamEvent) => void) => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    const channel = `convert:stream:${jobId}`;
    ipc.on(channel, (_evt, payload) => handler(payload as ConversionStreamEvent));
    return () => {
      try { ipc.removeAllListeners(channel); } catch { /* ignore */ }
    };
  },
  cancel: async (jobId: string): Promise<{ ok: true }> => {
    const ipc = getIpc();
    if (!ipc) throw new Error('IPC unavailable');
    return ipc.invoke<{ ok: true }>('convert:cancel', jobId);
  },
};


