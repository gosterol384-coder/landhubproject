import React, { useState } from 'react';
import { BarChart3, Clock, Wifi, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';

interface PlotStats {
  total: number;
  available: number;
  taken: number;
  pending: number;
  totalArea: number;
}

interface PlotStatsPanelProps {
  stats: PlotStats;
  lastUpdate: Date | null;
  connectionStatus: 'connected' | 'disconnected' | 'checking';
}

const PlotStatsPanel: React.FC<PlotStatsPanelProps> = ({
  stats,
  lastUpdate,
  connectionStatus
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-emerald-600" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-600" />;
      default:
        return <Wifi className="w-4 h-4 text-amber-600 animate-pulse" />;
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header - always visible */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-gray-900">Plot Statistics</span>
          </div>
          <div className="flex items-center space-x-2">
            {getConnectionIcon()}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
        
        {/* Quick stats - always visible */}
        <div className="mt-2 flex items-center space-x-4 text-sm">
          <span className="text-gray-600">
            <span className="font-medium text-gray-900">{stats.total}</span> plots
          </span>
          <span className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="text-gray-600">{stats.available}</span>
          </span>
          <span className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-gray-600">{stats.taken}</span>
          </span>
          <span className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-gray-600">{stats.pending}</span>
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Detailed statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">{stats.available}</div>
              <div className="text-xs text-emerald-700">Available</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.taken}</div>
              <div className="text-xs text-red-700">Taken</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <div className="text-xs text-amber-700">Pending</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.totalArea}</div>
              <div className="text-xs text-blue-700">Total Ha</div>
            </div>
          </div>

          {/* Availability percentage */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Availability</span>
              <span className="font-medium">
                {stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: stats.total > 0 ? `${(stats.available / stats.total) * 100}%` : '0%' 
                }}
              />
            </div>
          </div>

          {/* Last update info */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Last update: {formatTime(lastUpdate)}</span>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs ${
              connectionStatus === 'connected' 
                ? 'bg-emerald-100 text-emerald-700'
                : connectionStatus === 'disconnected'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {connectionStatus}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlotStatsPanel;