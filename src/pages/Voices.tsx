import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { models, activation, updates } from '../services/ipcService';
import type { LocalVoiceModel } from '../types/localModels';
import toast from 'react-hot-toast';

const Voices: React.FC = () => {
  const navigate = useNavigate();
  const [voices, setVoices] = useState<LocalVoiceModel[]>([]);
  // Note: backend ensures base install; no local bases state needed here
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [activating, setActivating] = useState<Record<string, boolean>>({});
  const [activeVoiceRepo, setActiveVoiceRepo] = useState<string | undefined>(undefined);

  const refresh = async () => {
    try {
      setLoading(true);
      const { voices } = await models.list();
      setVoices(voices);
      try {
        const state = await activation.state();
        setActiveVoiceRepo(state?.voice?.repo as string | undefined);
      } catch {
        setActiveVoiceRepo(undefined);
      }
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to load Voices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Poll activation state periodically to keep UI in sync with backend
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const state = await activation.state();
        setActiveVoiceRepo(state?.voice?.repo as string | undefined);
      } catch {
        setActiveVoiceRepo(prev => prev);
      }
    }, 2000);
    return () => { clearInterval(timer); };
  }, []);

  const handleActivate = async (voice: LocalVoiceModel) => {
    try {
      setActivating(prev => ({ ...prev, [voice.repo]: true }));
      // Backend ensures base install if missing; just request activation
      await activation.activate({ baseRepo: voice.baseModelRepo, voiceRepo: voice.repo });
      setActiveVoiceRepo(voice.repo);
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to wake up');
    } finally {
      setActivating(prev => ({ ...prev, [voice.repo]: false }));
    }
  };

  const handleDeactivate = async (voice: LocalVoiceModel) => {
    try {
      setActivating(prev => ({ ...prev, [voice.repo]: true }));
      await activation.deactivate();
      setActiveVoiceRepo(undefined);
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to sleep');
    } finally {
      setActivating(prev => ({ ...prev, [voice.repo]: false }));
    }
  };

  const handleDelete = async (voice: LocalVoiceModel) => {
    try {
      console.log("deleting starts")
      console.log(voice)
      setDeleting(prev => ({ ...prev, [voice.repo]: true }));
      console.log("setdeleting")
      console.log("calling models.delete");
      await models.delete(voice.repo);
      console.log("models.delete completed, calling refresh");
      await refresh();
      console.log("refresh completed");
    } catch (e: unknown) {
      console.log("error occurred:", e);
      setError((e as Error).message || 'Failed to delete');
    } finally {
      console.log("setting deleting to false");
      setDeleting(prev => ({ ...prev, [voice.repo]: false }));
    }
  };

  const handleUpdate = async (voice: LocalVoiceModel) => {
    try {
      setUpdating(prev => ({ ...prev, [voice.repo]: true }));
      const res = await updates.check(voice.repo);
      if (res.hasUpdate) {
        await updates.update(voice.repo);
        toast.success('Voice updated successfully');
      } else {
        toast.success('Voice is already up to date');
      }
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to update');
    } finally {
      setUpdating(prev => ({ ...prev, [voice.repo]: false }));
    }
  };

  if (loading) return <div className="p-6">Loading Voices...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">Voices</h1>
        <p>Here you can wake up the Voices (rephrasing LLMs) that you have downloaded from the Model Search page! Voices are usually about 670 megabytes of storage each.</p>
      </div>
      {voices.length === 0 ? (
        <div>No Voices installed yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map(v => (
            <div key={v.repo} className="bg-white rounded-lg shadow p-4">
              <div className="font-semibold mb-1 break-words">{v.repo}</div>
              <div className="text-sm text-gray-600 mb-2">{v.revision ? `rev ${v.revision}` : 'rev: (auto-detected)'}</div>
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                <span>base: {v.baseModelRepo}</span>
                {activeVoiceRepo === v.repo && (
                  <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">Awake</span>
                )}
              </div>
              <div className="mt-6 flex gap-2 flex-wrap">
                {activeVoiceRepo === v.repo && (
                  <button
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    onClick={() => navigate('/dashboard/convert')}
                  >Use Voice</button>
                )}
                {activeVoiceRepo === v.repo ? (
                  <button
                    className="bg-yellow-600 text-white px-3 py-1 rounded disabled:opacity-50"
                    disabled={!!activating[v.repo]}
                    onClick={() => handleDeactivate(v)}
                  >{activating[v.repo] ? 'Sleeping...' : 'Sleep'}</button>
                ) : (
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
                    disabled={!!activating[v.repo]}
                    onClick={() => handleActivate(v)}
                  >{activating[v.repo] ? 'Waking Up...' : 'Wake Up'}</button>
                )}
                <button
                  className="bg-gray-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  disabled={!!updating[v.repo]}
                  onClick={() => handleUpdate(v)}
                >{updating[v.repo] ? 'Updating...' : 'Check Update'}</button>
                <button
                  className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  disabled={!!deleting[v.repo]}
                  onClick={() => handleDelete(v)}
                >{deleting[v.repo] ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Voices;


