import React, { useState, useEffect } from 'react';
import { activation, settings as settingsApi } from '../services/ipcService';
import type { LlamaServerConfig, AppSettings } from '../types/localModels';
import Voices from './Voices';
import Bases from './Bases';
import ModelSearch from './ModelSearch';

// Memoized LoRA card component to prevent unnecessary re-renders

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'voices' | 'bases' | 'search'>('voices');
  const [backend, setBackend] = useState<'auto' | 'cpu' | 'vulkan'>('auto');
  const [gpuLayers, setGpuLayers] = useState<number>(0);
  const [changingBackend, setChangingBackend] = useState(false);

  // Check localStorage for initial tab preference from onboarding
  useEffect(() => {
    try {
      const initialTab = localStorage.getItem('dashboard:initialTab');
      if (initialTab === 'search' || initialTab === 'voices' || initialTab === 'bases') {
        setActiveTab(initialTab);
        // Clear the localStorage item after using it
        localStorage.removeItem('dashboard:initialTab');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s: AppSettings = await settingsApi.get();
        if (s.backendPreference === 'auto' || s.backendPreference === 'cpu' || s.backendPreference === 'vulkan') {
          setBackend(s.backendPreference);
        }
        const n = s.llamaServer?.nGpuLayers;
        if (typeof n === 'number') setGpuLayers(n);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleBackendChange = async (val: 'auto' | 'cpu' | 'vulkan') => {
    try {
      setChangingBackend(true);
      await activation.deactivate().catch(() => {});
      await settingsApi.set({ backendPreference: val });
      setBackend(val);
    } finally {
      setChangingBackend(false);
    }
  };

  const handleGpuLayersChange = async (n: number) => {
    try {
      setChangingBackend(true);
      await activation.deactivate().catch(() => {});
      const nextCfg: LlamaServerConfig = { host: '127.0.0.1', portStart: 33333, nGpuLayers: n };
      await settingsApi.set({ llamaServer: nextCfg });
      setGpuLayers(n);
    } finally {
      setChangingBackend(false);
    }
  };
  return (
      <div className='p-12'>
        <div className='bg-gray-100 rounded-lg'>
          <div className="mb-8">
            <nav className="flex" aria-label="Tabs">
              <button
                className={`px-4 py-2 font-medium text-sm border-t border-r rounded-tl-lg ${activeTab==='voices' ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-200 border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setActiveTab('voices')}
              >Voices</button>
              <button
                className={`px-4 py-2 font-medium text-sm border-t border-l border-r ${activeTab==='bases' ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-200 border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setActiveTab('bases')}
              >Bases</button>
              <button
                className={`px-4 py-2 font-medium text-sm border-t border-l rounded-tr-lg ${activeTab==='search' ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-200 border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setActiveTab('search')}
              >Model Search</button>
            </nav>
          </div>

        <div className="px-4 pt-4">
          <div className="mb-6 flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Acceleration</label>
            <select
              className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
              value={backend}
              disabled={changingBackend}
              onChange={(e) => handleBackendChange(e.target.value as 'auto' | 'cpu' | 'vulkan')}
            >
              <option value="auto">Auto (prefer Vulkan if present)</option>
              <option value="vulkan">Vulkan (GPU)</option>
              <option value="cpu">CPU only</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">GPU layers</label>
              <input
                type="number"
                min={0}
                step={1}
                value={gpuLayers}
                disabled={changingBackend}
                onChange={(e) => handleGpuLayersChange(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
              />
            </div>
            {changingBackend && (<span className="text-xs text-gray-500">Restarting engine…</span>)}
          </div>
        </div>

        <div className="mt-4">
          {activeTab === 'voices' && (
            <Voices />
          )}
          {activeTab === 'bases' && (
            <Bases />
          )}
          {activeTab === 'search' && (
            <ModelSearch />
          )}
      </div>
      
    </div>
    </div>
  );
};

export default Dashboard;
