export interface Lora {
  _id: string;
  name: string;
  status: 'pending' | 'training' | 'ready' | 'active' | 'failed' | 'error' | 'activating' | 'deactivating';
  progress: number;
  isPublic: boolean;
  files: { name: string; content: string }[];
  text: string;
  trainingStartedAt?: Date;
  trainingFinishedAt?: Date;
  createdAt: Date;
  pipeline_id?: string;
  statusMessage?: string;
} 