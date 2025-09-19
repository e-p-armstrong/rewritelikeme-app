import React, { useEffect, useState } from 'react';
import OnboardingModal from './OnboardingModal';
import OnboardingNudge from './OnboardingNudge';
import { onboarding, downloads, activation } from '../services/ipcService';
import { useNavigate } from 'react-router-dom';

const STARTER_VOICE = 'Rewritelikeme/Nietzsche';
const STARTER_BASE = 'Rewritelikeme/mistral7bv02';

type DlState = {
  id?: string;
  repo: string;
  type: 'voice' | 'base';
  state: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  downloadedBytes?: number;
  totalBytes?: number;
  error?: string;
};

const OnboardingController: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<{ status: 'pending' | 'in_progress' | 'completed'; stage?: string; downloadIds?: { voiceId?: string; baseId?: string } }>({ status: 'pending', stage: 'welcome' });
  const [voiceDl, setVoiceDl] = useState<DlState>({ repo: STARTER_VOICE, type: 'voice', state: 'idle' });
  const [baseDl, setBaseDl] = useState<DlState>({ repo: STARTER_BASE, type: 'base', state: 'idle' });
  const [polling, setPolling] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await onboarding.get();
        setState(s);
      } catch { /* ignore */ }
    })();
  }, []);

  // Poll onboarding state to pick up changes triggered from other pages (e.g., Convert)
  useEffect(() => {
    if (state.status === 'completed') return;
    const t = setInterval(async () => {
      try {
        const s = await onboarding.get();
        setState(s);
      } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(t);
  }, [state.status]);

  const skip = async () => {
    if (!window.confirm('Are you sure you want to skip the tutorial?')) return;
    const next = await onboarding.set({ status: 'completed', stage: 'outro', downloadIds: {} });
    setState(next);
  };

  const startDownloads = async () => {
    try {
      const voiceTask = await downloads.start({ repo: STARTER_VOICE, type: 'voice' });
      const baseTask = await downloads.start({ repo: STARTER_BASE, type: 'base' });
      const next = await onboarding.set({ status: 'in_progress', stage: 'downloading', downloadIds: { voiceId: voiceTask.id, baseId: baseTask.id } });
      setState(next);
      const vStat = voiceTask.status;
      const bStat = baseTask.status;
      setVoiceDl({
        repo: STARTER_VOICE,
        type: 'voice',
        state: vStat.state as DlState['state'],
        id: voiceTask.id,
        downloadedBytes: vStat.state === 'running' ? vStat.downloadedBytes : undefined,
        totalBytes: vStat.state === 'running' ? vStat.totalBytes : undefined,
      });
      setBaseDl({
        repo: STARTER_BASE,
        type: 'base',
        state: bStat.state as DlState['state'],
        id: baseTask.id,
        downloadedBytes: bStat.state === 'running' ? bStat.downloadedBytes : undefined,
        totalBytes: bStat.state === 'running' ? bStat.totalBytes : undefined,
      });
      setPolling(true);
    } catch (err) {
      console.error('[ONBOARDING] startDownloads failed', err);
    }
  };

  useEffect(() => {
    if (!polling) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const vId = state.downloadIds?.voiceId;
        const bId = state.downloadIds?.baseId;
        if (vId) {
          const s = await downloads.status(vId);
          setVoiceDl(prev => ({
            ...prev,
            state: s.status.state as DlState['state'],
            downloadedBytes: s.status.state === 'running' ? s.status.downloadedBytes : prev.downloadedBytes,
            totalBytes: s.status.state === 'running' ? s.status.totalBytes : prev.totalBytes,
          }));
        }
        if (bId) {
          const s = await downloads.status(bId);
          setBaseDl(prev => ({
            ...prev,
            state: s.status.state as DlState['state'],
            downloadedBytes: s.status.state === 'running' ? s.status.downloadedBytes : prev.downloadedBytes,
            totalBytes: s.status.state === 'running' ? s.status.totalBytes : prev.totalBytes,
          }));
        }
        const bothDone = voiceDl.state === 'completed' && baseDl.state === 'completed';
        const anyFailed = voiceDl.state === 'failed' || baseDl.state === 'failed';
        if (bothDone) {
          setPolling(false);
          // Auto-activate immediately after both are done
          const next = await onboarding.set({ status: 'in_progress', stage: 'activating' });
          setState(next);
          try {
            await activation.activate({ baseRepo: STARTER_BASE, voiceRepo: STARTER_VOICE });
            const ready = await onboarding.set({ status: 'in_progress', stage: 'ready' });
            setState(ready);
          } catch (error) {
            console.error('[ONBOARDING] Activation failed:', error);
            // Provide user feedback and retry option instead of silent failure
            const errorStage = await onboarding.set({ 
              status: 'in_progress', 
              stage: 'apology',
              error: error instanceof Error ? error.message : 'Activation failed' 
            });
            setState(errorStage);
          }
        } else if (anyFailed) {
          setPolling(false);
        } else {
          timer = setTimeout(tick, 800);
        }
      } catch {
        timer = setTimeout(tick, 1200);
      }
    };
    tick();
    return () => { if (timer) clearTimeout(timer); };
  }, [polling, state.downloadIds, voiceDl.state, baseDl.state]);

  const percent = (d?: number, t?: number) => {
    if (typeof d !== 'number' || typeof t !== 'number') return undefined;
    if (t <= 0) return undefined;
    return Math.min(100, Math.max(0, Math.round((d / t) * 100)));
  };

  // TODO in the main RewriteLikeMe WEB bit, make it so that the user can download their model (in all the proper ways) for use in the local app. For a price. Because... my recurring revenue... ): Pro plan and above only.

  const render = () => {
    if (state.status === 'completed') return null;
    const canSkip = !(state.stage === 'voice_explore' || state.stage === 'outro');
    if (state.stage === 'welcome' || !state.stage) {
      return (
        <OnboardingModal
          isOpen
          title="Welcome to RewriteLikeMe"
          body={<div className='space-y-4'>
            <p>Welcome to the RewriteLikeMe Local App!</p>
            <p>Here you can rewrite AI text to sound like any of the people that there are open-source rephrasing models for! It all works free on your computer, too.</p>
            <p>These useful popups will show you how the app works. You can skip the onboarding at any time, but this is not recommended.</p>
            <p className="mt-4">We'll now download the Nietzsche Voice and its base model so that you can start converting text.</p>
            <p className='italic'>An AI that can rephrase text from one style into another is called a "Voice". The RewriteLikeMe app has a number of voices you can pick from.</p>
          </div>}
          position="center"
          onNext={startDownloads}
          onClose={canSkip ? skip : undefined}
        />
      );
    }
    if (state.stage === 'downloading') {
      const vPct = percent(voiceDl.downloadedBytes, voiceDl.totalBytes);
      const bPct = percent(baseDl.downloadedBytes, baseDl.totalBytes);
      return (
        <OnboardingModal
          isOpen
          title="Downloading starter Voice files"
          body={<>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold">{STARTER_VOICE}</div>
                {voiceDl.state === 'completed' ? (
                  <div className="mt-1 text-green-700 text-sm flex items-center gap-2"><span className="inline-block w-4 h-4 bg-green-600 text-white rounded-full text-center leading-4">✓</span> Completed</div>
                ) : (
                  <>
                    <div className="w-full bg-gray-200 rounded h-2 mt-1">
                      <div className="bg-orange h-2 rounded" style={{ width: `${vPct ?? 5}%` }} />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{voiceDl.state}{vPct !== undefined ? ` • ${vPct}%` : ''}</div>
                  </>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold">{STARTER_BASE}</div>
                {baseDl.state === 'completed' ? (
                  <div className="mt-1 text-green-700 text-sm flex items-center gap-2"><span className="inline-block w-4 h-4 bg-green-600 text-white rounded-full text-center leading-4">✓</span> Completed</div>
                ) : (
                  <>
                    <div className="w-full bg-gray-200 rounded h-2 mt-1">
                      <div className="bg-orange h-2 rounded" style={{ width: `${bPct ?? 5}%` }} />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{baseDl.state}{bPct !== undefined ? ` • ${bPct}%` : ''}</div>
                  </>
                )}
              </div>
            </div>
          </>}
          position="center"
          onClose={canSkip ? skip : undefined}
          canNext={false}
        />
      );
    }
    if (state.stage === 'activating') {
      return (
        <OnboardingModal
          isOpen
          title="Waking Up Voice..."
          body={<>
            After a Voice is downloaded, you need to "wake it up" or activate it. This tutorial is automatically waking the Voice we just downloaded up, and we'll continue as soon as the Voice is activated.
          </>}
          position="center"
          canNext={false}
          onClose={canSkip ? skip : undefined}
        />
      );
    }
    if (state.stage === 'ready') {
      return (
        <OnboardingModal
          isOpen
          title="You're all set!"
          body={<>
            Everything should be ready! Let's try a quick rewriting.
          </>}
          position="center"
          onNext={async () => {
            // Activate voice and prefill hint; Convert reads it and auto-fills
            // Activation already triggered; this just navigates
            try { localStorage.setItem('onboarding:convertPrefill', '1'); } catch { /* ignore */ }
            const next = await onboarding.set({ status: 'in_progress', stage: 'convert_hint' });
            setState(next);
            navigate('/dashboard/convert');
          }}
          onClose={canSkip ? skip : undefined}
        />
      );
    }
    if (state.stage === 'convert_hint') {
      return (
        <OnboardingNudge
          title="Try it now"
          body={<>
            To save you the time of tracking down some good text to rephrase, this tutorial auto-filled some input text this time. Click the Convert button to see the magic!
          </>}
          position="top-right"
        />
      );
    }
    if (state.stage === 'voice_explore') {
      return (
        <OnboardingNudge
          title="Explore more Voices"
          body={<>
            If you want to try styles other than Nietzsche, you can download more Voices at Dashboard → Voices!
          </>}
          position="bottom-left"
          onNext={async () => {
            try { localStorage.setItem('dashboard:initialTab', 'search'); } catch { /* ignore */ }
            const next = await onboarding.set({ status: 'in_progress', stage: 'outro' });
            setState(next);
            navigate('/dashboard');
          }}
          onClose={canSkip ? skip : undefined}
        />
      );
    }
    if (state.stage === 'apology') {
      return (
        <OnboardingModal
          isOpen
          title="Oh no an error! I'm so sorry."
          body={<div className='space-y-4'>
            <p>It looks like your system may not have enough free memory to run a rephrasing model right now, or there was another issue. Running the model usually costs about 10 GB of RAM. There are a few things you can try:</p>
            <ul className="list-disc list-inside space-y-3 ml-4">
              <li><span className="font-semibold">Close other apps:</span> Apps like Cursor or Chrome can take a <span className="font-bold">LOT</span> of RAM. Try closing anything memory-intensive that may be open, restart the tutorial through the button on the bottom left, and try again?</li>
              <li><span className="font-semibold">Restart your computer:</span> Sometimes if you haven't turned your computer off in ages, long-running programs that have not closed properly can take up a bunch of your resources even if they aren't really doing anything. Try restarting and running this again and not only will you probably be able to run rephrases, but your whole system will probably be much faster.</li>
              <li><span className="font-semibold">If you have a very, very old system:</span> RewriteLikeMe's Voices should be able to run on on most hardware from this decade and even quite a bit from the previous one. Still, if you have a very lightweight or somehow incompatible system, then I am very, very sorry for wasting your time here. The <a href="" className="text-blue-600 underline">RewriteLikeMe.com</a> web service runs on servers so it should be able to work for you, but I don't feel right selling you something right after my first thing failed to work for you, so if you want to check that out, that's entirely up to you.</li>
              <li><span className="font-semibold">"Wait a minute, the error doesn't say anything about memory!"</span> If this happens then I messed up and for some reason my code is not working on your system. Please get in touch with me on Discord or GitHub and let me know what the error says so I can fix this for you and people like you!</li>
            </ul>
          </div>}
          position="center"
          onNext={async () => {
            const next = await onboarding.set({ status: 'completed' });
            setState(next);
          }}
          onClose={async () => {
            const next = await onboarding.set({ status: 'completed' });
            setState(next);
          }}
        />
      );
    }
    // TODO show in the how to or something, what files to add and in what format to make a Voice that is compatible with this local app
    if (state.stage === 'outro') {
      return (
        <OnboardingModal
          isOpen
          title="Congratulations!"
          body={<div className='space-y-4'>
            <p>You've completed the tutorial! Now you can rephrase AI-written stuff to sound like certain people for fun or function.</p>
            <p>In the local app, you can use all open-sourced Voices. If you want to make a Voice that sounds like you (or any style you have in mind) head over to <a href="https://RewriteLikeMe.com" target="_blank" rel="noreferrer" className="text-orange underline">RewriteLikeMe.com</a> and you can create it there! Training models costs money so that is a paid service, but the cheapest plan is like $10 and you can get a refund if you hate it, so I encourage you to do it, it's a pretty good deal!</p>
            <p>I hope you enjoy using RewriteLikeMe!</p>
          </div>}
          position="center"
          nextButtonText="Finish"
          onNext={async () => {
            const next = await onboarding.set({ status: 'completed' });
            setState(next);
          }}
          // onClose={async () => {
          //   const next = await onboarding.set({ status: 'completed' });
          //   setState(next);
          // }}
        />
      );
    }
    return null;
  };

  // Persistent skip button if onboarding pending/in-progress
  const showSkip = state.status !== 'completed';

  return (
    <div className=''>
      {render()}
      {showSkip && (
        <button
          type="button"
          onClick={skip}
          className="fixed top-3 right-3 z-[60] px-3 py-1.5 rounded bg-gray-800 text-white text-xs shadow"
        >
          Skip onboarding
        </button>
      )}
      {/* Restart onboarding: reset state only (no deletions or re-downloads) */}
      <button
        type="button"
        onClick={async () => {
          const next = await onboarding.set({ status: 'pending', stage: 'welcome', downloadIds: {} });
          setState(next);
          setVoiceDl({ repo: STARTER_VOICE, type: 'voice', state: 'idle' });
          setBaseDl({ repo: STARTER_BASE, type: 'base', state: 'idle' });
        }}
        className="fixed bottom-3 left-3 z-[60] px-3 py-1.5 rounded bg-gray-100 text-gray-800 text-xs border"
      >
        Restart onboarding
      </button>
    </div>
  );
};

export default OnboardingController;


