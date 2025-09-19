import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-floral-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
            <p className="text-gray-600">
              The page you're looking for doesn't exist or may have been moved. How'd you even reach this anyway. It's an electron app. How did you navigate?!
            </p>
          </div>
          
          <div className="space-y-3">
            <Link
              to="/"
              className="block w-full bg-orange text-white py-2 px-4 rounded-lg hover:bg-opacity-80 transition-colors"
            >
              Go Home
            </Link>
            
            <Link
              to="/dashboard"
              className="block w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-opacity-80 transition-colors"
            >
              Go to Dashboard
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="w-full text-orange hover:underline py-2"
            >
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 