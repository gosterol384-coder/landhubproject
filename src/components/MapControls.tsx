import React from 'react';
import { RefreshCw, Maximize2, Info } from 'lucide-react';

interface MapControlsProps {
  onRefresh: () => void;
  onFitBounds: () => void;
  isLoading: boolean;
}

const MapControls: React.FC<MapControlsProps> = ({
  onRefresh,
  onFitBounds,
  isLoading
}) => {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col space-y-2">
      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className="p-3 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed group"
        title="Refresh plot data"
      >
        <RefreshCw className={`w-5 h-5 text-gray-600 group-hover:text-emerald-600 transition-colors ${
          isLoading ? 'animate-spin' : ''
        }`} />
      </button>

      {/* Fit bounds button */}
      <button
        onClick={onFitBounds}
        className="p-3 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200 group"
        title="Fit all plots in view"
      >
        <Maximize2 className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
      </button>

      {/* Info button */}
      <button
        onClick={() => {
          // Could open a help modal or info panel
          console.log('Info button clicked');
        }}
        className="p-3 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200 group"
        title="Map information"
      >
        <Info className="w-5 h-5 text-gray-600 group-hover:text-purple-600 transition-colors" />
      </button>
    </div>
  );
};

export default MapControls;