export type ModelType = 'base' | 'voice';

export interface InfoJsonMinimal {
  type: ModelType;
  contextWindow?: number;
  baseModelRepo?: string; // required for voices
}

export interface LocalModelCommon {
  id: string;                 // sanitized identifier == folder name
  type: ModelType;
  repo: string;               // HF repo path
  revision?: string;          // optional in info; local install may add installedRevision
  path: string;               // absolute folder path
  bytesOnDisk: number;        // computed after install
  contextWindow?: number;
  verified: boolean;          // structure and checksum verified
}

export interface LocalBaseModel extends LocalModelCommon {
  type: 'base';
  files: {
    gguf: string;             // absolute path to model.gguf
    readme?: string;          // absolute path if cached
    infoJson: string;         // absolute path to info.json
  };
}

export interface LocalVoiceModel extends LocalModelCommon {
  type: 'voice';
  baseModelRepo: string;      // required
  files: {
    adapterGguf: string;      // absolute path to adapter.gguf
    systemPrompt: string;     // absolute path to system_prompt.txt
    readme?: string;
    infoJson: string;
  };
}

export type LocalModel = LocalBaseModel | LocalVoiceModel;

export interface CatalogEntryBase {
  repo: string;
  type: ModelType;
  latestRevision: string;
  sizeBytes?: number;
  contextWindow?: number;
}

export interface CatalogEntryVoice extends CatalogEntryBase {
  type: 'voice';
  baseModelRepo: string;
}

export type CatalogEntry = CatalogEntryBase | CatalogEntryVoice;

export interface DiskSpaceInfo {
  freeBytes: number;
  totalBytes: number;
}

export type DownloadStatus =
  | { state: 'queued' }
  | { state: 'running'; downloadedBytes: number; totalBytes?: number; rateBytesPerSec?: number }
  | { state: 'completed'; path: string }
  | { state: 'failed'; error: string }
  | { state: 'cancelled' };

export interface DownloadTask {
  id: string;
  repo: string;
  type: ModelType;
  targetPath: string;
  status: DownloadStatus;
  startedAt?: number;
  completedAt?: number;
}

export interface LlamaServerConfig {
  portStart: number;
  host: string;
  nThreads?: number;
  nGpuLayers?: number;
}

export interface ActivationSelection {
  baseRepo: string;
  voiceRepo?: string;
}

export interface LocalActivationState {
  active: boolean;
  base?: LocalBaseModel;
  voice?: LocalVoiceModel;
  server: { pid?: number; port?: number; url?: string };
}

export interface SamplingParams {
  temperature?: number;
  top_k?: number;
  top_p?: number;
  min_p?: number;
  repeat_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  max_tokens?: number;
}

export interface SamplingPreset {
  id: string;
  name: string;
  params: SamplingParams;
}

export interface ChunkingConfig {
  targetTokens: number;
  overlapTokens: number;
  maxContext: number;
}

export interface ConversionJobRequest {
  text: string;
  sampling: { presetId?: string; params?: SamplingParams };
  chunking?: Partial<ChunkingConfig>;
}

export interface ConversionChunkResult {
  chunkIndex: number;
  text: string;
  tokensGenerated: number;
  msElapsed: number;
}

export interface ConversionFinalResult {
  concatenatedText: string;
  chunks: ConversionChunkResult[];
  totalTokens: number;
  totalMs: number;
}

export type ConversionStreamEvent =
  | { type: 'start'; totalChunks: number }
  | { type: 'chunkStart'; chunkIndex: number }
  | { type: 'token'; chunkIndex: number; token: string }
  | { type: 'separator'; chunkIndex: number; separator: string }
  | { type: 'chunkComplete'; chunkIndex: number; result: ConversionChunkResult }
  | { type: 'complete'; result: ConversionFinalResult }
  | { type: 'error'; message: string }
  | { type: 'chunk_positions'; chunkPositions: { start: number; end: number }[]; baseText?: string };

export interface AppSettings {
  rootPath: string;
  modelsPath: string;
  basesPath: string;
  voicesPath: string;
  llamaBinariesPath: string;
  logsPath: string;
  downloadsPath: string;
  llamaServer: LlamaServerConfig;
  offlineMode: boolean;
  allowAutoUpdate: boolean;
  backendPreference?: 'auto' | 'cpu' | 'vulkan';
}

export interface AppError {
  code:
    | 'DISK_SPACE_INSUFFICIENT'
    | 'MODEL_STRUCTURE_INVALID'
    | 'INCOMPATIBLE_VOICE_BASE'
    | 'DOWNLOAD_FAILED'
    | 'LLAMA_LAUNCH_FAILED'
    | 'LLAMA_UNREACHABLE'
    | 'CONVERSION_FAILED'
    | 'UNKNOWN';
  message: string;
  details?: Record<string, unknown>;
}


