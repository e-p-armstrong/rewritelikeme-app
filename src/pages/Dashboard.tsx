import React, { useState, useEffect } from 'react';
import Voices from './Voices';
import Bases from './Bases';
import ModelSearch from './ModelSearch';

// Memoized LoRA card component to prevent unnecessary re-renders

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'voices' | 'bases' | 'search'>('voices');

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
