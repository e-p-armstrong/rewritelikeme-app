import React, { useEffect, useState } from 'react';
import { models, activation, updates } from '../services/ipcService';
import type { LocalBaseModel } from '../types/localModels';
import toast from 'react-hot-toast';

const Bases: React.FC = () => {
  const [bases, setBases] = useState<LocalBaseModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    try {
      setLoading(true);
      const { bases } = await models.list();
      setBases(bases);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to load Bases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleActivateBaseOnly = async (base: LocalBaseModel) => {
    try {
      setActivating(prev => ({ ...prev, [base.repo]: true }));
      await activation.activate({ baseRepo: base.repo });
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to wake up base');
    } finally {
      setActivating(prev => ({ ...prev, [base.repo]: false }));
    }
  };

  const handleDelete = async (base: LocalBaseModel) => {
    try {
      setDeleting(prev => ({ ...prev, [base.repo]: true }));
      await models.delete(base.repo);
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to delete base');
    } finally {
      setDeleting(prev => ({ ...prev, [base.repo]: false }));
    }
  };

  const handleUpdate = async (base: LocalBaseModel) => {
    try {
      setUpdating(prev => ({ ...prev, [base.repo]: true }));
      const res = await updates.check(base.repo);
      if (res.hasUpdate) {
        await updates.update(base.repo);
        toast.success('Base updated successfully');
      } else {
        toast.success('Base is already up to date');
      }
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to update');
    } finally {
      setUpdating(prev => ({ ...prev, [base.repo]: false }));
    }
  };

  if (loading) return <div className="p-6">Loading Bases...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Bases</h1>
        <p>Here you can manage the base models that you have downloaded from the Model Search page. Base models are used by Voices, and many Voices can use the same base model. Base models are large and are about 7-10 Gigabytes each.</p>
      </div>
      {bases.length === 0 ? (
        <div>No Bases installed yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bases.map(b => (
            <div key={b.repo} className="bg-white rounded-lg shadow p-4">
              <div className="font-semibold mb-1 break-words">{b.repo}</div>
              <div className="text-sm text-gray-600 mb-2">{b.revision ? `rev ${b.revision}` : 'rev: (auto-detected)'}</div>
              <div className="flex gap-2">
                <button
                  className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  disabled={!!deleting[b.repo]}
                  onClick={() => handleDelete(b)}
                >{deleting[b.repo] ? 'Deleting...' : 'Delete'}</button>
                <button
                  className="bg-gray-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  disabled={!!updating[b.repo]}
                  onClick={() => handleUpdate(b)}
                >{updating[b.repo] ? 'Updating...' : 'Check Update'}</button>
                <button
                  className="bg-yellow-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  disabled={!!activating[b.repo]}
                  onClick={() => handleActivateBaseOnly(b)}
                >{activating[b.repo] ? 'Waking Up...' : 'Wake Up (base only)'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 text-sm text-yellow-700">Waking up a base without a Voice is allowed, but under 99% of circumstances you won't want to do this. This page is mostly for enabling the management and deletion of base models.</div>
    </div>
  );
};

export default Bases;


