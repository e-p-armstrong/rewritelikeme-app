import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Convert from './pages/Convert';
// Use BuyCredits for onboarding plans (pay-now variant)
import NotFound from './pages/NotFound';
import { Toaster } from 'react-hot-toast';
import HowTo from './pages/HowTo';
// Tabs for Voices/Bases/ModelSearch will render inside Dashboard
import OnboardingController from './components/OnboardingController';
import About from './pages/About';

function App() {

  return (
    <Router>
      <div className="min-h-screen bg-floral-white flex flex-col">
            <Navbar />
            <Toaster />
            <OnboardingController />
            <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              {/* Onboarding */}
              <Route path="/how-to" element={<HowTo />} />
              <Route path="/about" element={<About />} />
              
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/convert" element={<Convert />} />
              
              <Route path="*" element={<NotFound />} />
              {/* 404 Catch-all route */}
            </Routes>
            </main>
            <Footer />
          </div>
    </Router>
  );
}

export default App;