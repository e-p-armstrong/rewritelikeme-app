import React from 'react';
import { Link } from 'react-router-dom';
import rwlmLogo from '../assets/rwlm-logo.png';


const Navbar: React.FC = () => {
  return (
    <>
    {/* <div className="bg-red-400 text-white text-center py-2 text-sm">
      Temporary breakage! will be resolved in an hour, until then we're down. Classic me -- I forgot to push an update right after I go and post about something.
    </div> */}
    <nav className="bg-orange shadow-md sticky top-0 z-50">
      <div className="container px-4">
        <div className="flex items-center py-4">
          <Link to='/' className="flex items-center space-x-2">
            <img src={rwlmLogo} alt="RWLM Logo" className="h-8 w-8 rounded-md" />
            <span className="text-2xl font-bold text-white hover:text-gray-200">RewriteLikeMe</span>
          </Link>
          <div className="flex items-center space-x-4 ml-8">
            <Link to="/dashboard" className="text-white font-bold hover:text-gray-200">Dashboard</Link>
            <Link to="/dashboard/convert" className={`text-white font-bold hover:text-gray-200`}>Convert</Link>
            <Link to="/about" className="text-white font-bold hover:text-gray-200">About</Link>
            <Link to="/how-to" className="text-white font-bold hover:text-gray-200">How To</Link>

          </div>
        </div>
      </div>
    </nav>
    </>
  );
};

export default Navbar;