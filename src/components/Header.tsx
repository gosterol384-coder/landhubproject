import React from 'react';
import { Map, Activity, Globe } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 relative z-[1001]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-600 rounded-lg shadow-sm">
            <Map className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tanzania Land Registry</h1>
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-600">Interactive Plot Ordering System</p>
              <div className="flex items-center space-x-1">
                <Activity className="w-3 h-3 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">Live</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-8">
          {/* Legend */}
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-emerald-500 rounded shadow-sm"></div>
            <span className="text-sm text-gray-700">Available</span>
          </div>
          <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded shadow-sm"></div>
            <span className="text-sm text-gray-700">Taken</span>
          </div>
          <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-amber-500 rounded shadow-sm"></div>
            <span className="text-sm text-gray-700">Pending</span>
          </div>
          </div>
          
          {/* System status */}
          <div className="flex items-center space-x-2 text-sm">
            <Globe className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Tanzania</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;