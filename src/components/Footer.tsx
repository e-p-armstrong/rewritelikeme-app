import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white shadow-md mt-auto py-4">
      <div className="container mx-auto text-center text-gray-600">
        <div>
        <a className='text-blue-500 underline' href="https://discord.gg/s6PBfsaVzu">Join the RewriteLikeMe Discord!</a>

        </div>

      </div>
    </footer>
  );
};

export default Footer;