import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { activation as ipcActivation, convert as ipcConvert, onboarding as ipcOnboarding } from '../services/ipcService';
import type { Lora } from '../types/lora';
import TiptapEditor from '../components/TiptapEditor';
import OnboardingModal from '../components/OnboardingModal';

// Local conversion history helpers
type ConvertHistoryItem = {
  id: string;
  createdAt: number;
  voiceRepo?: string;
  inputText: string;
  outputRephrased: string;
  outputEdited?: string;
};

const HISTORY_KEY = 'convert:history:v1';

const loadHistory = (): ConvertHistoryItem[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ConvertHistoryItem[]) : [];
  } catch {
    return [];
  }
};

const saveHistory = (items: ConvertHistoryItem[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

const addHistoryItem = (item: ConvertHistoryItem) => {
  const items = loadHistory();
  items.unshift(item);
  // keep last 100
  saveHistory(items.slice(0, 100));
};

const clearHistoryStore = () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
};

interface AxiosError extends Error {
  response?: {
    data?: {
      msg?: string;
      reason?: string;
      chunkIndex?: number;
    };
  };
}

const Convert: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedLoraId, setSelectedLoraId] = useState<string>('');
  const [loras, setLoras] = useState<Lora[]>([]);
  const [text, setText] = useState('');
  const [convertedText, setConvertedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activationReady, setActivationReady] = useState<boolean>(false);
  const [streamingChunks, setStreamingChunks] = useState<{ [index: number]: string }>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const runIdRef = useRef(0);
  
  const [rerollingChunks, setRerollingChunks] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  // Removed editedText state; we stitch directly into convertedText
  const [editProgress, setEditProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [viewMode, setViewMode] = useState<'edited' | 'rephrased'>('edited');
  // Immutable snapshot of the original input at submit time
  const originalSnapshotRef = useRef<string>('');

  // Onboarding tour state
  const [onboardingMode, setOnboardingMode] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);
  // Activation-complete welcome modal (first-time Convert handholding)
  const [activationWelcomeOpen, setActivationWelcomeOpen] = useState<boolean>(false);
  const [postConvertSuggestCreateOpen, setPostConvertSuggestCreateOpen] = useState<boolean>(false);

  // (Removed decodeHtmlEntities helper; not used)

  type ChunkStatus = 'streaming' | 'ready' | 'editing' | 'edited' | 'failed' | 'skipped';
  interface Chunk {
    index: number;
    original: string;
    rephrased: string;
    edited?: string;
    status: ChunkStatus;
    attempts: number;
    error?: string;
  }
  interface Template {
    chunks: Chunk[];
    separators: string[]; // separators[i] follows chunks[i]
  }
  const [template, setTemplate] = useState<Template | null>(null);

  // History UI state
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [historyItems, setHistoryItems] = useState<ConvertHistoryItem[]>([]);
  const currentHistoryIdRef = useRef<string | null>(null);
  const refreshHistory = () => setHistoryItems(loadHistory());

  // const escapePreview = (s: string, max = 40) => {
  //   const slice = s.slice(0, max);
  //   return slice
  //     .replaceAll('\n', '\\n')
  //     .replaceAll('\r', '\\r')
  //     .replaceAll('\t', '\\t');
  // };
  

  useEffect(() => {
    // Load existing history on mount
    refreshHistory();

    // Populate from active voice via IPC instead of remote API
    (async () => {
      try {
        const state = await ipcActivation.state();
        const voiceRepo = state?.voice?.repo as string | undefined;
        if (voiceRepo) {
          const synthetic: Lora = {
            _id: voiceRepo,
            name: voiceRepo,
            status: 'active',
            progress: 100,
            isPublic: false,
            files: [],
            text: '',
            createdAt: new Date(),
          } as Lora;
          setLoras([synthetic]);
          // Honor URL param if it matches; otherwise select active
          const loraId = searchParams.get('loraId');
          setSelectedLoraId(loraId || voiceRepo);
        } else {
          setLoras([]);
          setSelectedLoraId('');
        }
      } catch (e) {
        console.warn('[Convert] activation.state failed', (e as Error)?.message);
        setLoras([]);
        setSelectedLoraId('');
      }
    })();
  }, [searchParams]);

  // Poll activation readiness to enable Convert only when server is usable
  useEffect(() => {
    const poll = async () => {
      try {
        const st = await ipcActivation.state();
        setActivationReady(!!st?.server?.url && !!st?.active);
      } catch {
        setActivationReady(false);
      }
    };
    poll();
    const intervalId = setInterval(poll, 1000);
    return () => { clearInterval(intervalId); };
  }, []);

  // Onboarding prefill hook
  useEffect(() => {
    try {
      const flag = localStorage.getItem('onboarding:convertPrefill');
      if (flag === '1' && !text) {
        setText(`The modern office worker shuffles into his climate-controlled tomb each morning, badge in hand, to perform rituals so divorced from human purpose that even he cannot explain what he does to his own children. What have we done to ourselves? We've created entire industries of pure abstraction—consultants consulting consultants, managers managing managers, meetings about meetings about meetings. Millions of souls trapped in fluorescent purgatory, crafting PowerPoints that no one will read, sending emails that generate only more emails, their labor vanishing into the digital void like smoke. They produce no bread, build no shelter, teach no child, heal no wound. They are priests of a religion with no god, no doctrine, no purpose except its own perpetuation.

And what does this do to a man's soul? It hollows him out from the inside. He knows, in some deep place he dare not acknowledge, that if he disappeared tomorrow, nothing in the world would change. The spreadsheets would go unupdated, the reports unwritten, and life would continue exactly as before. This knowledge is poison. It seeps into his bones during the commute, follows him home to his overpriced apartment, whispers to him as he stares at another screen to forget the screen he stared at all day.

The carpenter can point to the house he built. The farmer to the food he grew. Even the street sweeper can see the clean road behind him. But what can the "Senior Vice President of Digital Transformation" point to? What can the "Customer Success Specialist" hold in his hands? They are ghosts haunting their own lives, and they know it. That's why they drink. That's why they take antidepressants. That's why they scroll endlessly through others' curated lives, seeking some vicarious taste of reality.

This is how civilizations die—not in conquest or catastrophe, but in the slow suffocation of purpose, in the replacement of reality with its simulation, in the transformation of men into procedures, souls into systems, human beings into human resources. We are witnessing the spiritual heat death of the developed world, one performance review at a time.`);
        localStorage.removeItem('onboarding:convertPrefill');
      }
    } catch {
      // ignore
    }
  }, [text]);


  // No-op placeholder; remote loras are not used in local app mode
  // const fetchLoras = async () => {};

  const [copiedSmall, setCopiedSmall] = useState(false);
  const CopyBarSmall: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex items-center gap-2 mb-2">
      <button
        type="button"
        className={`text-xs px-2 py-1 rounded ${copiedSmall ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
        onClick={async () => { try { await navigator.clipboard.writeText(text); setCopiedSmall(true); setTimeout(() => setCopiedSmall(false), 800); } catch { /* noop */ } }}
      >
        {copiedSmall ? 'Copied' : 'Copy'}
      </button>
    </div>
  );


  // Editing disabled: previous editing flow removed

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLoraId) {
      setError('Please select a Voice');
      return;
    }
    if (!text.trim()) {
      setError('Please enter some text to convert');
      return;
    }

    // Capture immutable snapshot of the exact original input
    originalSnapshotRef.current = text;

    setLoading(true);
    setError(null);
    setConvertedText('');
    setStreamingChunks({});
    setRerollingChunks(new Set());
    setTemplate(null);
    setIsEditing(false);
    setEditProgress({ completed: 0, total: 0 });
    setViewMode('edited');
    try { await ipcOnboarding.set({ status: 'in_progress', stage: 'converting' }); } catch (e) { void e; }

    try {
      setIsStreaming(true);
      const thisRunId = ++runIdRef.current;
      
      // Use a local variable to track chunks during streaming
      const localChunks: { [index: number]: string } = {};
      
      // Local IPC streaming via llama.cpp server
      const { jobId } = await ipcConvert.start({ text, sampling: {} });
      const off = ipcConvert.onStream(jobId, (event) => {
        if (event.type === 'token') {
          const chunkText = event.token;
          const chunkIndex = typeof event.chunkIndex === 'number' ? event.chunkIndex : 0;
          if (thisRunId !== runIdRef.current) return;
          // Accumulate tokens for the specific chunk in both local and state
          localChunks[chunkIndex] = (localChunks[chunkIndex] || '') + chunkText;
          
          setStreamingChunks(prev => ({
            ...prev,
            [chunkIndex]: (prev[chunkIndex] || '') + chunkText
          }));
          // If we have a template, mirror into it for deterministic stitching
          setTemplate(prev => {
            if (!prev) return prev;
            if (!prev.chunks[chunkIndex]) return prev;
            const next = { ...prev };
            next.chunks = prev.chunks.map((c, i) => i === chunkIndex ? { ...c, rephrased: (c.rephrased || '') + chunkText, status: 'ready' } : c);
            return next;
          });
          
          // Remove from rerolling set when we start receiving new content
          setRerollingChunks(prev => {
            const newSet = new Set(prev);
            newSet.delete(chunkIndex);
            return newSet;
          });
        } else if (event.type === 'separator') {
          // Preserve exact original separators during streaming in fallback mode
          const separatorText = event.separator || '';
          const chunkIndex = typeof event.chunkIndex === 'number' ? event.chunkIndex : 0;
          if (thisRunId !== runIdRef.current) return;
          if (!separatorText) return;
          // Append to the prior chunk's streaming buffer
          localChunks[chunkIndex] = (localChunks[chunkIndex] || '') + separatorText;
          setStreamingChunks(prev => ({
            ...prev,
            [chunkIndex]: (prev[chunkIndex] || '') + separatorText
          }));
          // If a template exists, ensure its separator is set (should already be from chunk_positions)
          setTemplate(prev => {
            if (!prev) return prev;
            const next = { ...prev };
            if (Array.isArray(next.separators) && next.separators.length > chunkIndex) {
              // Trust server-provided separator if any discrepancy (rare)
              next.separators = next.separators.map((s, i) => i === chunkIndex ? (separatorText || s) : s);
            }
            return next;
          });
        } else if (event.type === 'complete') {
          // On complete, combine all chunks and set final text
          setIsStreaming(false);
          
          // Stitch deterministically using template if available
          let finalText = '';
          if (templateRef.current) {
            const t = templateRef.current;
            finalText = t.chunks.map((c, i) => (c.rephrased || '') + (t.separators[i] || '')).join('');
            console.log('[CONVERT] Template exists, stitched finalText length:', finalText.length);
          } else {
            // Fallback
            console.warn('[CONVERT] No template at complete - falling back to localChunks');
            const validFinalChunks = Object.fromEntries(
              Object.entries(localChunks).filter(([, chunk]) => 
                chunk && chunk.trim().length > 0 && !chunk.startsWith('[Error converting chunk')
              )
            );
            finalText = Object.keys(validFinalChunks)
              .sort((a, b) => Number(a) - Number(b))
              .map(key => validFinalChunks[Number(key)])
              .join('');
          }
          console.log('[CONVERT STREAM] Stream complete, finalText length:', finalText.length);
          // Clear streaming state and set initial converted text
          setStreamingChunks({});
          setRerollingChunks(new Set());
          setConvertedText(finalText);

          // Save history entry (rephrased). Update later if edit pass runs
          try {
            const newItem: ConvertHistoryItem = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              createdAt: Date.now(),
              voiceRepo: selectedLoraId,
              inputText: originalSnapshotRef.current,
              outputRephrased: finalText,
            };
            addHistoryItem(newItem);
            currentHistoryIdRef.current = newItem.id;
            refreshHistory();
          } catch {
            // ignore
          }
          
          // Editing functionality removed in local app mode
          // Signal onboarding progression after a successful conversion
          ;(async () => { try { await ipcOnboarding.set({ status: 'in_progress', stage: 'voice_explore' }); } catch (e) { void e; } })();
          off(); // Unsubscribe from stream
        } else if (event.type === 'error') {
          const message = event.message || 'Conversion error';
          setError(message);
          setIsStreaming(false);
          setStreamingChunks({});
          setRerollingChunks(new Set());
          if (/terminated/i.test(message) || /LLAMA_UNREACHABLE/i.test(message) || /server not active/i.test(message) || /error/i.test(message) || /Error/i.test(message)) {
            ;(async () => { try { await ipcOnboarding.set({ status: 'in_progress', stage: 'apology' }); } catch (e) { void e; } })();
          }
          off(); // Unsubscribe from stream
        } else if (event.type === 'chunk_positions') {
          // Handle chunk positions to build the template
          if (thisRunId !== runIdRef.current) return;
          try {
            const base = event.baseText ?? originalSnapshotRef.current ?? text;
            const chunks: Chunk[] = event.chunkPositions.map((pos, idx) => ({
              index: idx,
              original: base.slice(pos.start, pos.end),
              rephrased: '',
              status: 'streaming',
              attempts: 0,
            }));
            const separators: string[] = event.chunkPositions.map((pos, idx) => {
              const nextStart = event.chunkPositions[idx + 1]?.start ?? base.length;
              return base.slice(pos.end, nextStart);
            });
            const built: Template = { chunks, separators };
            setTemplate(built);
            templateRef.current = built;
          } catch (_e) {
            console.error('[FRONTEND EDIT] Failed to build template from positions:', _e);
          }
        } else if (event.type === 'start') {
          // no-op for now (single chunk)
        } else if (event.type === 'chunkStart') {
          // no-op
        }
      });
    } catch (err: unknown) {
      const axiosError = err as AxiosError;
      setError(axiosError.response?.data?.msg || 'Failed to convert text');
    } finally {
      setLoading(false);
    }
  };

  // Keep a ref mirror of template for async usage
  const templateRef = useRef<Template | null>(null);
  useEffect(() => { templateRef.current = template; }, [template]);

  // Stitch helper according to Design 1
  const stitch = (t: Template, mode: 'edited' | 'rephrased' | 'mixed'): string => {
    return t.chunks.map((c, i) => {
      const body = mode === 'edited' ? (c.edited ?? c.rephrased ?? c.original ?? '')
        : mode === 'rephrased' ? (c.rephrased ?? c.original ?? '')
        : (c.edited ?? c.rephrased ?? c.original ?? '');
      return body + (t.separators[i] ?? '');
    }).join('');
  };

  return (
    <div className="min-h-screen bg-floral-white text-black p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Convert Text</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() => setHistoryOpen(true)}
          >
            History
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <div className="block text-gray-700 mb-2">Active Voice</div>
          {selectedLoraId ? (
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-700">Awake</span>
              <span className="text-sm break-words">{selectedLoraId}</span>
            </div>
          ) : (
            <p className="text-sm text-yellow-700">
              No awake Voice. Wake one up in Dashboard → Voices.
            </p>
          )}
        </div>

        

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Make it a flex container with a vertical direction */}
          <div className="flex flex-col">
            <label className="block text-gray-700 mb-2">Your Text</label>
            {/* The TiptapEditor will now grow to fill the available vertical space */}
            <CopyBarSmall text={text} />
            <TiptapEditor content={text} onChange={setText} className="grow" />
          </div>
          
          {/* Column 2: Also a vertical flex container */}
          <div className="flex flex-col">
            <label className="block text-gray-700 mb-2">
              Converted Text 
              {isStreaming && <span className="text-sm text-gray-500">(streaming...)</span>}
              {!isStreaming && isEditing && <span className="text-sm text-blue-500 ml-2">(editing {editProgress.completed}/{editProgress.total}...)</span>}
              {rerollingChunks.size > 0 && <span className="text-sm text-orange-500">(rerolling {rerollingChunks.size} chunk{rerollingChunks.size === 1 ? '' : 's'}...)</span>}
              
            </label>
            <div className="flex items-center gap-2 mb-2">
              {!isStreaming && template && (isEditing || template.chunks.some(c => c.edited && c.edited.length > 0)) && (
                <>
                  <button
                    type="button"
                    onClick={() => setViewMode('edited')}
                    className={`text-xs px-2 py-1 rounded ${viewMode === 'edited' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}`}
                  >
                    View edited
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('rephrased')}
                    className={`text-xs px-2 py-1 rounded ${viewMode === 'rephrased' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}`}
                  >
                    View rephrased
                  </button>
                </>
              )}
            </div>
            <CopyBarSmall text={
                isStreaming
                  ? (template
                      ? template.chunks.map((c, i) => (c.rephrased || '') + (template.separators[i] || '')).join('')
                      : Object.keys(streamingChunks)
                          .sort((a, b) => Number(a) - Number(b))
                          .map(key => streamingChunks[Number(key)])
                          .join('')
                    )
                  : (template
                      ? (viewMode === 'edited' ? stitch(template, 'mixed') : stitch(template, 'rephrased'))
                      : convertedText)
            } />
            <TiptapEditor 
              content={
                isStreaming
                  ? (template
                      ? template.chunks.map((c, i) => (c.rephrased || '') + (template.separators[i] || '')).join('')
                      : Object.keys(streamingChunks)
                          .sort((a, b) => Number(a) - Number(b))
                          .map(key => streamingChunks[Number(key)])
                          .join('')
                    )
                  : (template
                      ? (viewMode === 'edited' ? stitch(template, 'mixed') : stitch(template, 'rephrased'))
                      : convertedText)
              } 
              onChange={setConvertedText} 
              isEditable={true} 
              className="grow" 
            />
          </div>
        </div>
        <button 
          type="submit" 
          className="mt-6 w-full bg-orange text-white py-2 rounded-lg hover:bg-opacity-80 disabled:opacity-50" 
          disabled={loading || isStreaming || isEditing || !selectedLoraId || loras.length === 0 || !activationReady}
        >
          {loading || isStreaming ? 'Converting...' : (isEditing ? 'Editing...' : (activationReady ? 'Convert' : 'Warming up...'))}
        </button>
      </form>

      {/* Onboarding Tour Modals for Convert */}
      {onboardingMode && (
        <>
          {tourStep === 1 && (
            <OnboardingModal
              isOpen
              title="Pick a Voice"
              body={<>
                Welcome to the pages where you do things! On Convert, you can select one of your awake Voices here, copy-paste AI-written text into the left window, and convert it to sound like you on the right. The conversion will rewrite text into that Voice's style.
              </>}
              position="top-left"
              onNext={() => setTourStep(2)}
            />
          )}
          {tourStep === 2 && (
            <>
              <OnboardingModal
                isOpen
                title="Paste and Convert"
                body={<>
                  This page is meant to be used alongside other AI apps. Whenever AI produces a piece of writing for you, paste it into "Your Text" on the left, then click Convert. Your Voice will rewrite it into, well, your voice.
                  <div className="mt-3 text-gray-700">Editing: after conversion, we run an optional edit pass that compares the rephrased result with the original and fixes factual/objective discrepancies.</div>
                </>}
                position="center"
                onBack={() => setTourStep(1)}
                onNext={() => setTourStep(3)}
              />
            </>
          )}
          {tourStep === 3 && (
            <OnboardingModal
              isOpen
              title="FAQ: Why rewrite my own writing?"
              body={<>
                If you let AI write in order to save time, it won't sound like you. That's why RewriteLikeMe exists: to make AI text read in your authentic voice, and prevent a slop-apocalypse by bringing taste back into automated writing.
              </>}
              position="center"
              onBack={() => setTourStep(2)}
              onNext={() => setTourStep(4)}
            />
          )}
          {tourStep === 4 && (
            <OnboardingModal
              isOpen
              title="Prefer not to copy/paste?"
              body={<>
                Copy/paste works, but it's clunky. And it requires a third party service. Not ideal! This is why Create exists: with it, you can draft content directly inside RewriteLikeMe.
                <div className="mt-4">
                  <button
                    className="bg-orange text-white px-4 py-2 rounded hover:bg-opacity-80"
                    onClick={async () => {
                      navigate('/dashboard/create-content');
                    }}
                  >
                    Let's Go to Create
                  </button>
                </div>
              </>}
              position="bottom-right"
              onBack={() => setTourStep(3)}
              onClose={() => setOnboardingMode(false)}
            />
          )}
        </>
      )}

      {/* Activation-complete quick start modal */}
      {activationWelcomeOpen && (
        <OnboardingModal
          isOpen
          title="Convert text to your Voice"
          body={<>
            Now that our Voice is ready, it's time to try it out! This tutorial has helpfully pre-filled some sample text so you can see the conversion instantly. You can replace it with your own text any time. Go ahead and click the convert button to proceed!
          </>}
          position="center"
          onNext={() => {
            setText(`Human joy is a profound and multifaceted experience that transcends fleeting moments of happiness. It is not just the thrill of achieving a goal—it’s the deep sense of connection and fulfillment that comes from sharing those victories with others. Joy often arises from the simplest experiences: a heartfelt conversation, the laughter of a loved one, or the beauty of a sunset. These moments remind us that joy is not something to be chased but something to be embraced in the present. It is a state of being that thrives in gratitude, mindfulness, and the recognition that life’s most meaningful treasures are often intangible.

At its core, human joy is rooted in relationships and a sense of purpose. It’s not just an individual feeling—it’s a shared energy that binds people together. Acts of kindness, mutual understanding, and collective celebration create waves of joy that ripple through communities, strengthening bonds and fostering resilience. In this way, joy becomes a powerful force for healing and transformation, reminding us that even in the face of challenges, there is beauty to be found. It’s a reminder that joy is not merely an emotion, but a testament to our capacity to connect, grow, and find meaning in the shared human experience.`);
            setActivationWelcomeOpen(false);
            // If no Voice selected yet but one is available, select the first
            if (!selectedLoraId && loras.length > 0) {
              setSelectedLoraId(loras[0]._id);
            }
          }}
          onClose={() => setActivationWelcomeOpen(false)}
        />
      )}

      {/* Post-convert suggestion to try Create */}
      {postConvertSuggestCreateOpen && (
        <OnboardingModal
          isOpen
          title="Try Create next"
          body={<>
            Great! You’ve converted text to your Voice. Next, try Create to draft content directly and then rephrase it immediately. No third party services are needed here. Convert is for flexibility with existing workflows.
          </>}
          position="top-left"
          onNext={() => {
            setPostConvertSuggestCreateOpen(false);
            history.replaceState(null, '', '/dashboard/create-content');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          onClose={() => setPostConvertSuggestCreateOpen(false)}
        />
      )}

      {/* History Sidebar */}
      {historyOpen && (
        <div className="fixed top-0 right-0 h-full w-full md:w-96 bg-white border-l border-gray-200 shadow-lg p-4 overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">Conversion History</div>
            <button
              type="button"
              className="text-sm px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
              onClick={() => setHistoryOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-600">Stored locally on this device</div>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
              onClick={() => {
                if (window.confirm('Clear all saved conversions? This cannot be undone.')) {
                  clearHistoryStore();
                  setHistoryItems([]);
                }
              }}
            >
              Clear All
            </button>
          </div>
          {historyItems.length === 0 ? (
            <div className="text-sm text-gray-500">No history yet. Conversions you run will appear here.</div>
          ) : (
            <ul className="space-y-2">
              {historyItems.map(item => (
                <li key={item.id} className="border rounded p-2 hover:bg-gray-50">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setText(item.inputText);
                      setConvertedText(item.outputEdited || item.outputRephrased);
                      setTemplate(null);
                      setStreamingChunks({});
                      setRerollingChunks(new Set());
                      setIsEditing(false);
                      setIsStreaming(false);
                      setViewMode('edited');
                      setHistoryOpen(false);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
                      <span className="text-[10px] text-gray-500">{item.voiceRepo || 'base-only'}</span>
                    </div>
                    <div className="mt-1 text-sm truncate">{item.outputEdited || item.outputRephrased}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Convert;