import React, { useState, useEffect } from 'react';
import { Bug, MapPin, Layers, Zap } from 'lucide-react';

interface MapDebugPanelProps {
  mapRef: React.RefObject<L.Map | null>;
  plots: any[];
  isMapReady: boolean;
}

const MapDebugPanel: React.FC<MapDebugPanelProps> = ({ mapRef, plots, isMapReady }) => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    const updateDebugInfo = () => {
      const map = mapRef.current;
      if (!map) return;

      const center = map.getCenter();
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      const containerSize = map.getSize();

      // Check if center is in Tanzania
      const inTanzania = (
        center.lng >= 29.34 && center.lng <= 40.44 &&
        center.lat >= -11.75 && center.lat <= -0.95
      );

      // Count layers
      let tileLayerCount = 0;
      let geoJsonLayerCount = 0;
      let totalFeatures = 0;

      map.eachLayer(layer => {
        if (layer instanceof L.TileLayer) {
          tileLayerCount++;
        } else if (layer instanceof L.GeoJSON) {
          geoJsonLayerCount++;
          totalFeatures += Object.keys((layer as any)._layers).length;
        }
      });

      setDebugInfo({
        center: { lat: center.lat.toFixed(6), lng: center.lng.toFixed(6) },
        zoom: zoom,
        bounds: {
          north: bounds.getNorth().toFixed(6),
          south: bounds.getSouth().toFixed(6),
          east: bounds.getEast().toFixed(6),
          west: bounds.getWest().toFixed(6)
        },
        containerSize: { width: containerSize.x, height: containerSize.y },
        inTanzania,
        layers: {
          tileLayerCount,
          geoJsonLayerCount,
          totalFeatures
        },
        plotsData: {
          total: plots.length,
          rendered: totalFeatures
        }
      });
    };

    updateDebugInfo();

    // Update on map events
    map.on('moveend zoomend', updateDebugInfo);

    return () => {
      map.off('moveend zoomend', updateDebugInfo);
    };
  }, [mapRef, isMapReady, plots]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-20 left-4 z-[1000] p-2 bg-purple-600 text-white rounded-lg shadow-lg hover:bg-purple-700 transition-colors"
        title="Show debug panel"
      >
        <Bug className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Bug className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Map Debug</h3>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ×
        </button>
      </div>

      <div className="space-y-3 text-xs">
        {/* Map Status */}
        <div className="bg-gray-50 rounded p-2">
          <div className="flex items-center space-x-1 mb-1">
            <MapPin className="w-3 h-3 text-blue-500" />
            <span className="font-medium">Map Status</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Ready:</span>
              <span className={isMapReady ? 'text-green-600' : 'text-red-600'}>
                {isMapReady ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Center:</span>
              <span>{debugInfo.center?.lat}, {debugInfo.center?.lng}</span>
            </div>
            <div className="flex justify-between">
              <span>Zoom:</span>
              <span>{debugInfo.zoom}</span>
            </div>
            <div className="flex justify-between">
              <span>In Tanzania:</span>
              <span className={debugInfo.inTanzania ? 'text-green-600' : 'text-red-600'}>
                {debugInfo.inTanzania ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Size:</span>
              <span>{debugInfo.containerSize?.width}×{debugInfo.containerSize?.height}</span>
            </div>
          </div>
        </div>

        {/* Layers */}
        <div className="bg-gray-50 rounded p-2">
          <div className="flex items-center space-x-1 mb-1">
            <Layers className="w-3 h-3 text-green-500" />
            <span className="font-medium">Layers</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Tile Layers:</span>
              <span>{debugInfo.layers?.tileLayerCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Plot Layers:</span>
              <span>{debugInfo.layers?.geoJsonLayerCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Features:</span>
              <span>{debugInfo.layers?.totalFeatures || 0}</span>
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="bg-gray-50 rounded p-2">
          <div className="flex items-center space-x-1 mb-1">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="font-medium">Data</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Plots Loaded:</span>
              <span>{debugInfo.plotsData?.total || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Plots Rendered:</span>
              <span>{debugInfo.plotsData?.rendered || 0}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.invalidateSize();
                console.log('Map size invalidated');
              }
            }}
            className="w-full px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 transition-colors"
          >
            Invalidate Size
          </button>
          <button
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.fitBounds([[-11.75, 29.34], [-0.95, 40.44]]);
                console.log('Fitted to Tanzania bounds');
              }
            }}
            className="w-full px-2 py-1 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200 transition-colors"
          >
            Fit Tanzania
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapDebugPanel;