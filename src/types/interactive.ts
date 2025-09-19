export type Mode = 'short' | 'long';

export type Step =
  | 'init'
  | 'awaiting_skeleton_answers'
  | 'skeleton_drafted'
  | 'awaiting_section_answers'
  | 'section_drafted'
  | 'complete';

export type InteractiveAction =
  | 'ask_questions'
  | 'submit_skeleton_answers'
  | 'revise_skeleton'
  | 'approve_skeleton'
  | 'submit_section_answers'
  | 'revise_section'
  | 'approve_section'
  | 'write_full_short';

export interface InteractiveRequest {
  prompt: string;
  constraints?: string;
  tone?: string;
  length?: 'short' | 'medium' | 'long';
}

export interface HistoryEntry {
  timestamp: string;
  event: string;
  meta?: Record<string, unknown>;
}

export interface SkeletonItem { id: string; title: string; }

export interface InteractiveState {
  version: number;
  mode: Mode;
  step: Step;
  request: InteractiveRequest;
  loraId: string;
  requestId: string;
  stepId: string;
  usageCharged?: boolean;

  // Long flow (skeleton)
  skeletonQueries?: string[] | null;
  skeletonAnswers?: string[];
  skeletonDraft?: SkeletonItem[] | null;
  skeletonInputAreas?: string[];
  skeleton?: SkeletonItem[] | null;
  currentSectionIndex?: number;

  // Section Q&A + draft
  currentQueries?: string[] | null;
  currentAnswers?: string[];
  currentDraft?: string | null;
  currentRephrased?: string | null;
  currentInputAreas?: string[];
  content?: string[]; // accumulated approved drafts

  allProvidedInfo?: Array<{ for: string; queries: string[]; answers: string[] }>;
  history?: HistoryEntry[];
}

export interface InteractiveNextResponse {
  success: boolean;
  state: InteractiveState;
}


