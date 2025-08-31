import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PlotOrderModal from "./PlotOrderModal";
import { Plot, OrderData } from "../types/land";
import { plotService } from "../services/plotService";
import LoadingSpinner from "./LoadingSpinner";
import MapControls from "./MapControls";
import PlotStatsPanel from "./PlotStatsPanel";
import MapDebugPanel from "./MapDebugPanel";

// Fix Leaflet default icons
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Tanzania map configuration
const TANZANIA_CONFIG = {
  center: [-6.369028, 34.888822] as L.LatLngTuple,
  bounds: [
    [-11.75, 29.34], // SW
    [-0.95, 40.44], // NE
  ] as L.LatLngBoundsExpression,
  defaultZoom: 6,
  minZoom: 5,
  maxZoom: 18,
};

// Enhanced plot styling with better visual hierarchy
const getPlotStyle = (status: Plot["status"], isHovered: boolean = false) => {
  const baseStyle = {
    weight: isHovered ? 4 : 2,
    color: "#ffffff",
    fillOpacity: isHovered ? 0.9 : 0.7,
    opacity: 1,
  };

  switch (status) {
    case "available":
      return {
        ...baseStyle,
        fillColor: "#10B981", // emerald-500
        dashArray: undefined,
      };
    case "taken":
      return {
        ...baseStyle,
        fillColor: "#EF4444", // red-500
        fillOpacity: isHovered ? 0.8 : 0.6,
        dashArray: undefined,
      };
    case "pending":
      return {
        ...baseStyle,
        fillColor: "#F59E0B", // amber-500
        dashArray: "8,4",
      };
    default:
      return {
        ...baseStyle,
        fillColor: "#6B7280", // gray-500
        dashArray: undefined,
      };
  }
};

const getStatusBadgeClass = (status: Plot["status"]): string => {
  switch (status) {
    case "available":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    case "taken":
      return "bg-red-100 text-red-800 border border-red-200";
    case "pending":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    default:
      return "bg-gray-100 text-gray-800 border border-gray-200";
  }
};

// Enhanced geometry validation with detailed logging
const isValidGeometry = (geometry: any): boolean => {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    console.warn("[MapView] Invalid geometry: missing type or coordinates", geometry);
    return false;
  }

  const isValidCoordinate = (coord: any): boolean => {
    if (!Array.isArray(coord) || coord.length < 2) {
      return false;
    }
    
    const [lng, lat] = coord;
    
    if (typeof lng !== "number" || typeof lat !== "number" || 
        isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
      return false;
    }
    
    // More specific bounds checking for Tanzania
    if (lng < 29 || lng > 41 || lat < -12 || lat > -0.5) {
      console.warn(`[MapView] Coordinate outside Tanzania bounds: [${lng}, ${lat}]`);
      return false;
    }
    
    return true;
  };

  try {
    if (geometry.type === "Polygon") {
      return (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length > 0 &&
        geometry.coordinates.every((ring: any) =>
          Array.isArray(ring) &&
          ring.length >= 4 &&
          ring.every(isValidCoordinate)
        )
      );
    }

    if (geometry.type === "MultiPolygon") {
      return (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length > 0 &&
        geometry.coordinates.every((polygon: any) =>
          Array.isArray(polygon) &&
          polygon.length > 0 &&
          polygon.every((ring: any) =>
            Array.isArray(ring) &&
            ring.length >= 4 &&
            ring.every(isValidCoordinate)
          )
        )
      );
    }

    console.warn(`[MapView] Unsupported geometry type: ${geometry.type}`);
    return false;
  } catch (error) {
    console.error("[MapView] Geometry validation error:", error);
    return false;
  }
};

// Optimized centroid calculation
const getPolygonCentroid = (coordinates: number[][][]): [number, number] => {
  try {
    const ring = coordinates[0];
    if (!ring || ring.length < 4) return [0, 0];

    let area = 0;
    let x = 0;
    let y = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const a = x0 * y1 - x1 * y0;
      area += a;
      x += (x0 + x1) * a;
      y += (y0 + y1) * a;
    }

    if (Math.abs(area) < 1e-10) {
      const avgX = ring.reduce((sum, coord) => sum + coord[0], 0) / ring.length;
      const avgY = ring.reduce((sum, coord) => sum + coord[1], 0) / ring.length;
      return [avgX, avgY];
    }

    area *= 0.5;
    return [x / (6 * area), y / (6 * area)];
  } catch (error) {
    console.error("[MapView] Centroid calculation error:", error);
    return [0, 0];
  }
};

interface MapViewProps {
  onPlotSelect?: (plot: Plot) => void;
  selectedPlotId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const MapView: React.FC<MapViewProps> = ({
  onPlotSelect,
  selectedPlotId,
  autoRefresh = false,
  refreshInterval = 30000, // 30 seconds
}) => {
  // Refs for map components
  const mapRef = useRef<L.Map | null>(null);
  const plotLayerRef = useRef<L.GeoJSON | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoveredLayerRef = useRef<L.Layer | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State management
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  // Memoized plot statistics
  const plotStats = useMemo(() => {
    const available = plots.filter(p => p.status === 'available').length;
    const taken = plots.filter(p => p.status === 'taken').length;
    const pending = plots.filter(p => p.status === 'pending').length;
    const totalArea = plots.reduce((sum, p) => sum + (p.area_hectares || 0), 0);

    return {
      total: plots.length,
      available,
      taken,
      pending,
      totalArea: Math.round(totalArea * 100) / 100,
    };
  }, [plots]);

  // Enhanced popup content with better formatting
  const createPopupContent = useCallback((plot: Plot) => {
    const container = L.DomUtil.create("div", "plot-popup");
    
    // Header with plot code and status
    const header = L.DomUtil.create("div", "popup-header flex justify-between items-start mb-3", container);
    const title = L.DomUtil.create("h3", "text-lg font-bold text-gray-900", header);
    title.textContent = `Plot ${plot.plot_code}`;
    
    const badge = L.DomUtil.create("span", `px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(plot.status)}`, header);
    badge.textContent = plot.status.charAt(0).toUpperCase() + plot.status.slice(1);

    // Plot details
    const details = L.DomUtil.create("div", "popup-details space-y-2 text-sm mb-4", container);
    
    const createDetailRow = (label: string, value: string | number) => {
      const row = L.DomUtil.create("div", "flex justify-between items-center", details);
      const labelSpan = L.DomUtil.create("span", "text-gray-600 font-medium", row);
      labelSpan.textContent = label;
      const valueSpan = L.DomUtil.create("span", "text-gray-900", row);
      valueSpan.textContent = value.toString();
    };

    // Basic information
    createDetailRow("Area", `${(plot.area_hectares * 10000).toLocaleString()} m²`);
    createDetailRow("District", plot.district);
    createDetailRow("Ward", plot.ward);
    createDetailRow("Village", plot.village);

    // Additional attributes from shapefile
    if (plot.attributes) {
      const blockNumber = plot.attributes.Block_numb || plot.attributes.block_numb || 'N/A';
      const landUse = plot.attributes.Land_use || plot.attributes.land_use || 'Not specified';
      const locality = plot.attributes.Locality || plot.attributes.locality || 'N/A';
      
      if (blockNumber !== 'N/A') createDetailRow("Block", blockNumber);
      if (landUse !== 'Not specified') createDetailRow("Land Use", landUse);
      if (locality !== 'N/A') createDetailRow("Locality", locality);
    }

    // Action button
    const actions = L.DomUtil.create("div", "popup-actions mt-4", container);
    
    if (plot.status === "available") {
      const button = L.DomUtil.create("button", 
        "w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5", 
        actions
      );
      button.textContent = "Order This Plot";
      button.type = "button";

      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handlePlotClick(plot);
      });

      L.DomEvent.disableClickPropagation(button);
    } else {
      const statusText = plot.status === 'taken' ? 'Plot Already Taken' : 'Order Pending';
      const div = L.DomUtil.create("div", 
        "w-full px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-center font-medium", 
        actions
      );
      div.textContent = statusText;
    }

    return container;
  }, []);

  // Enhanced plot click handler
  const handlePlotClick = useCallback((plot: Plot) => {
    console.log('[MapView] Plot clicked:', plot.plot_code, 'Status:', plot.status);
    
    if (plot.status === "available") {
      setSelectedPlot(plot);
      setIsModalOpen(true);
      setOrderError(null);
      
      // Notify parent component if callback provided
      onPlotSelect?.(plot);
    }
  }, [onPlotSelect]);

  // Optimized plot labels with better performance
  const createPlotLabels = useCallback((plotsData: Plot[]) => {
    if (!mapRef.current || !isMapReady) return;

    // Remove existing labels
    if (labelLayerRef.current) {
      mapRef.current.removeLayer(labelLayerRef.current);
    }

    labelLayerRef.current = L.layerGroup();

    // Only show labels at appropriate zoom levels
    const currentZoom = mapRef.current.getZoom();
    if (currentZoom < 12) {
      labelLayerRef.current.addTo(mapRef.current);
      return;
    }

    const validPlots = plotsData.filter(plot => isValidGeometry(plot.geometry));
    
    validPlots.forEach((plot, index) => {
      try {
        let centroid: [number, number];
        const geom = plot.geometry as any;
        
        if (geom.type === "Polygon") {
          centroid = getPolygonCentroid(geom.coordinates);
        } else if (geom.type === "MultiPolygon") {
          centroid = getPolygonCentroid(geom.coordinates[0]);
        } else {
          return;
        }

        if (isNaN(centroid[0]) || isNaN(centroid[1])) return;

        const plotNumber = plot.attributes?.Plot_Numb || 
                          plot.attributes?.plot_numb || 
                          plot.plot_code.split('_').pop() || 
                          `${index + 1}`;

        const labelIcon = L.divIcon({
          className: "plot-label",
          html: `<div class="plot-label-content" data-status="${plot.status}">${plotNumber}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const labelMarker = L.marker([centroid[1], centroid[0]], {
          icon: labelIcon,
          interactive: false,
          zIndexOffset: 1000,
        });

        labelLayerRef.current?.addLayer(labelMarker);
      } catch (error) {
        console.warn(`[MapView] Error creating label for plot ${plot.plot_code}:`, error);
      }
    });

    if (labelLayerRef.current) {
      labelLayerRef.current.addTo(mapRef.current);
    }
  }, [isMapReady]);

  // Enhanced plot rendering with performance optimizations
  const renderPlots = useCallback((plotsData: Plot[]) => {
    console.log('[MapView] Rendering', plotsData.length, 'plots');
    
    if (!mapRef.current || !isMapReady) {
      console.warn("[MapView] Cannot render plots: map not ready");
      return;
    }

    // Remove existing plot layer
    if (plotLayerRef.current) {
      mapRef.current.removeLayer(plotLayerRef.current);
      plotLayerRef.current = null;
    }

    // Enhanced validation and logging
    const validPlots = plotsData.filter(plot => isValidGeometry(plot.geometry));
    const invalidCount = plotsData.length - validPlots.length;
    
    if (invalidCount > 0) {
      console.warn(`[MapView] Filtered out ${invalidCount} plots with invalid geometry`);
    }
    
    if (validPlots.length === 0) {
      console.warn("[MapView] No valid plots to render");
      // Still fit to Tanzania bounds even with no plots
      mapRef.current.fitBounds(TANZANIA_CONFIG.bounds);
      setLoading(false);
      return;
    }

    console.log(`[MapView] Rendering ${validPlots.length} valid plots`);
    
    // Log coordinate ranges for debugging
    const allCoords: number[][] = [];
    validPlots.forEach(plot => {
      if (plot.geometry.type === "Polygon") {
        allCoords.push(...plot.geometry.coordinates[0]);
      } else if (plot.geometry.type === "MultiPolygon") {
        plot.geometry.coordinates.forEach(polygon => {
          allCoords.push(...polygon[0]);
        });
      }
    });
    
    if (allCoords.length > 0) {
      const lngs = allCoords.map(coord => coord[0]);
      const lats = allCoords.map(coord => coord[1]);
      const bounds = {
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats)
      };
      console.log('[MapView] Plot coordinate bounds:', bounds);
      
      // Validate bounds are within Tanzania
      if (bounds.minLng < 29 || bounds.maxLng > 41 || bounds.minLat < -12 || bounds.maxLat > -0.5) {
        console.error('[MapView] ❌ Plot coordinates are outside Tanzania bounds!', bounds);
        console.error('[MapView] Expected bounds: lng 29-41, lat -12 to -0.5');
      }
    }

    // Create GeoJSON data
    const geoJsonData = {
      type: "FeatureCollection" as const,
      features: validPlots.map((plot) => ({
        type: "Feature" as const,
        properties: {
          id: plot.id,
          plot_code: plot.plot_code,
          status: plot.status,
          area_hectares: plot.area_hectares,
          district: plot.district,
          ward: plot.ward,
          village: plot.village,
          attributes: plot.attributes || {},
        },
        geometry: plot.geometry,
      })),
    };

    try {
      // Create plot layer with enhanced interactions
      plotLayerRef.current = L.geoJSON(geoJsonData, {
        style: (feature) => {
          const status = feature?.properties?.status ?? "available";
          return getPlotStyle(status);
        },
        onEachFeature: (feature, layer) => {
          const plot = validPlots.find(p => p.id === feature.properties.id);
          if (!plot) return;

          // Enhanced hover effects
          layer.on({
            mouseover: (e) => {
              const target = e.target;
              hoveredLayerRef.current = target;
              target.setStyle(getPlotStyle(plot.status, true));
              target.bringToFront?.();
            },
            mouseout: (e) => {
              if (hoveredLayerRef.current === e.target) {
                hoveredLayerRef.current = null;
                if (plotLayerRef.current) {
                  plotLayerRef.current.resetStyle(e.target as L.Path);
                }
              }
            },
            click: () => {
              handlePlotClick(plot);
            }
          });

          // Bind popup with enhanced content
          layer.bindPopup(createPopupContent(plot), {
            maxWidth: 350,
            className: "custom-popup",
            closeButton: true,
            autoPan: true,
            keepInView: true,
          });
        },
      });

      plotLayerRef.current.addTo(mapRef.current);
      
      console.log('[MapView] Plot layer added to map successfully');
      
      // Create labels
      createPlotLabels(validPlots);

      // Fit bounds with padding
      const bounds = plotLayerRef.current.getBounds();
      console.log('[MapView] Plot layer bounds:', bounds);
      
      if (bounds.isValid()) {
        console.log('[MapView] Fitting map to plot bounds');
        mapRef.current.fitBounds(bounds, { 
          padding: [20, 20], 
          maxZoom: 15,
          animate: true,
          duration: 1.0
        });
      } else {
        console.warn('[MapView] Invalid bounds, fitting to Tanzania bounds');
        mapRef.current.fitBounds(TANZANIA_CONFIG.bounds);
      }

      console.log("[MapView] Successfully rendered", validPlots.length, "plots");
      
    } catch (err) {
      console.error("[MapView] Error rendering plots:", err);
      setError("Failed to render plots on map. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, [isMapReady, createPlotLabels, createPopupContent, handlePlotClick]);

  // Enhanced data loading with retry mechanism
  const loadPlots = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    
    try {
      setLoading(true);
      setError(null);
      setConnectionStatus('checking');

      console.log('[MapView] Loading plots from API...');
      const plotsData = await plotService.getAllPlots();
      
      if (!plotsData?.length) {
        throw new Error("No land plots available. Please check if the database has been seeded with shapefile data.");
      }

      console.log('[MapView] Successfully loaded', plotsData.length, 'plots');
      setPlots(plotsData);
      setLastUpdate(new Date());
      setConnectionStatus('connected');
      
      // Render plots if map is ready
      if (isMapReady) {
        renderPlots(plotsData);
      }
      
    } catch (err) {
      console.error("[MapView] Error loading plots:", err);
      setConnectionStatus('disconnected');
      
      if (retryCount < maxRetries) {
        console.log(`[MapView] Retrying... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => loadPlots(retryCount + 1), 2000 * (retryCount + 1));
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(`Failed to load plots: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  }, [isMapReady, renderPlots]);

  // Initialize map with enhanced error handling
  const initializeMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    try {
      console.log('[MapView] Initializing map...');
      
      // Verify container dimensions
      const rect = containerRef.current.getBoundingClientRect();
      console.log('[MapView] Container dimensions:', rect.width, 'x', rect.height);
      
      if (rect.width === 0 || rect.height === 0) {
        console.warn("[MapView] Container has zero dimensions, retrying in 100ms...");
        setTimeout(() => initializeMap(), 100);
        return;
      }

      // Create map instance
      const map = L.map(containerRef.current, {
        center: TANZANIA_CONFIG.center,
        zoom: TANZANIA_CONFIG.defaultZoom,
        minZoom: TANZANIA_CONFIG.minZoom,
        maxZoom: TANZANIA_CONFIG.maxZoom,
        attributionControl: true,
        zoomControl: true,
        preferCanvas: true, // Better performance for many features
        maxBounds: TANZANIA_CONFIG.bounds, // Restrict panning to Tanzania
        maxBoundsViscosity: 0.5, // Allow some dragging outside bounds
      });

      // Base layers with fallback
      const osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
          crossOrigin: true,
          detectRetina: true,
        }
      );

      const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri",
          maxZoom: 19,
          crossOrigin: true,
        }
      );

      // Add default layer
      osmLayer.addTo(map);
      
      // Wait for tiles to load before marking map as ready
      osmLayer.on('load', () => {
        console.log('[MapView] Base tiles loaded successfully');
      });
      
      osmLayer.on('tileerror', (e) => {
        console.warn('[MapView] Tile loading error:', e);
      });

      // Layer control
      L.control.layers(
        {
          "OpenStreetMap": osmLayer,
          "Satellite": satelliteLayer,
        },
        {},
        { position: 'topright' }
      ).addTo(map);

      // Scale control
      L.control.scale({ 
        metric: true, 
        imperial: false,
        position: 'bottomleft'
      }).addTo(map);

      // Map event handlers
      map.on('zoomend', () => {
        console.log('[MapView] Zoom changed to:', map.getZoom());
        createPlotLabels(plots);
      });

      map.on('moveend', () => {
        // Update URL with current view (optional)
        const center = map.getCenter();
        const zoom = map.getZoom();
        console.log(`[MapView] Map moved to: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}, zoom: ${zoom}`);
      });

      map.on('error', (e) => {
        console.error('[MapView] Map error:', e);
        setMapError('Map failed to load properly');
      });

      mapRef.current = map;
      
      // Force size calculation
      setTimeout(() => {
        map.invalidateSize();
        console.log('[MapView] Map invalidated and ready');
        setIsMapReady(true);
        setMapError(null);
      }, 100);

      console.log('[MapView] Map initialized successfully');
      
    } catch (err) {
      console.error("[MapView] Map initialization failed:", err);
      setMapError(`Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [plots, createPlotLabels]);

  // Enhanced order submission with optimistic updates
  const handleOrderSubmit = useCallback(async (orderData: OrderData) => {
    if (!selectedPlot) {
      setOrderError("No plot selected.");
      return;
    }

    setOrderError(null);
    
    try {
      // Optimistic update
      const optimisticPlots = plots.map(p =>
        p.id === selectedPlot.id ? { ...p, status: "pending" as const } : p
      );
      setPlots(optimisticPlots);
      renderPlots(optimisticPlots);

      // Submit order
      await plotService.createOrder(selectedPlot.id, orderData);
      
      console.log('[MapView] Order submitted successfully');
      setSelectedPlot(null);
      setIsModalOpen(false);
      
      // Refresh data to get latest state
      setTimeout(() => loadPlots(), 1000);
      
    } catch (err) {
      console.error("[MapView] Order submission failed:", err);
      
      // Revert optimistic update
      setPlots(plots);
      renderPlots(plots);
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setOrderError(`Failed to submit order: ${errorMessage}`);
    }
  }, [selectedPlot, plots, renderPlots, loadPlots]);

  // Auto-refresh functionality for real-time updates
  useEffect(() => {
    if (!autoRefresh || !isMapReady) return;

    refreshIntervalRef.current = setInterval(() => {
      console.log('[MapView] Auto-refreshing plot data...');
      loadPlots();
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, isMapReady, loadPlots]);

  // Initialize map on mount
  useEffect(() => {
    initializeMap();

    return () => {
      // Cleanup
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (plotLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(plotLayerRef.current);
      }
      if (labelLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(labelLayerRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setIsMapReady(false);
    };
  }, [initializeMap]);

  // Load plots when map is ready
  useEffect(() => {
    if (isMapReady && plots.length === 0) {
      loadPlots();
    }
  }, [isMapReady, loadPlots, plots.length]);

  // Render plots when data changes
  useEffect(() => {
    if (isMapReady && plots.length > 0) {
      renderPlots(plots);
    }
  }, [isMapReady, plots, renderPlots]);

  // Handle selected plot highlighting
  useEffect(() => {
    if (!selectedPlotId || !plotLayerRef.current) return;

    plotLayerRef.current.eachLayer((layer: any) => {
      if (layer.feature?.properties?.id === selectedPlotId) {
        layer.setStyle({
          ...getPlotStyle(layer.feature.properties.status),
          weight: 4,
          color: "#3B82F6", // blue-500
        });
      }
    });
  }, [selectedPlotId]);

  return (
    <div className="h-full w-full relative bg-gray-100">
      {/* Map container */}
      <div
        ref={containerRef}
        className="h-full w-full absolute inset-0"
        style={{ 
          minHeight: "400px",
          zIndex: 0
        }}
      />

      {/* Debug panel (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <MapDebugPanel 
          mapRef={{ current: mapRef.current }}
          plots={plots}
          isMapReady={isMapReady}
        />
      )}

      {/* Enhanced loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-[1000]">
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-gray-600">
              {connectionStatus === 'checking' ? 'Connecting to server...' : 'Loading land plots...'}
            </p>
            {connectionStatus === 'disconnected' && (
              <p className="mt-2 text-xs text-amber-600">
                Connection issues detected. Retrying...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Enhanced error overlay */}
      {(error || mapError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-sm z-[1000]">
          <div className="text-center max-w-md mx-4">
            <div className="w-16 h-16 mx-auto mb-4 text-red-500">
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {mapError ? 'Map Error' : 'Data Loading Error'}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {error || mapError}
            </p>
            <div className="space-y-3">
              <button
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                onClick={() => {
                  setError(null);
                  setMapError(null);
                  setPlots([]);
                  if (mapError) {
                    // Reinitialize map
                    if (mapRef.current) {
                      mapRef.current.remove();
                      mapRef.current = null;
                    }
                    setIsMapReady(false);
                    initializeMap();
                  } else {
                    loadPlots();
                  }
                }}
              >
                Try Again
              </button>
              <button
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection status indicator */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-2 ${
          connectionStatus === 'connected' 
            ? 'bg-emerald-100 text-emerald-800' 
            : connectionStatus === 'disconnected'
            ? 'bg-red-100 text-red-800'
            : 'bg-amber-100 text-amber-800'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' 
              ? 'bg-emerald-500' 
              : connectionStatus === 'disconnected'
              ? 'bg-red-500'
              : 'bg-amber-500 animate-pulse'
          }`} />
          <span>
            {connectionStatus === 'connected' && 'Connected'}
            {connectionStatus === 'disconnected' && 'Disconnected'}
            {connectionStatus === 'checking' && 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Enhanced stats panel */}
      {plots.length > 0 && !loading && !error && (
        <PlotStatsPanel 
          stats={plotStats}
          lastUpdate={lastUpdate}
          connectionStatus={connectionStatus}
        />
      )}

      {/* Map controls */}
      {isMapReady && (
        <MapControls
          onRefresh={() => loadPlots()}
          onFitBounds={() => {
            if (mapRef.current && plotLayerRef.current) {
              const bounds = plotLayerRef.current.getBounds();
              if (bounds.isValid()) {
                mapRef.current.fitBounds(bounds, { padding: [20, 20] });
              }
            }
          }}
          isLoading={loading}
        />
      )}

      {/* Order error notification */}
      {orderError && (
        <div className="absolute top-4 right-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg shadow-lg z-[1000] max-w-sm">
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 text-red-500 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Order Failed</p>
              <p className="text-xs mt-1">{orderError}</p>
            </div>
            <button
              onClick={() => setOrderError(null)}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Order modal */}
      {isModalOpen && selectedPlot && (
        <PlotOrderModal
          plot={selectedPlot}
          onClose={() => {
            setSelectedPlot(null);
            setIsModalOpen(false);
            setOrderError(null);
          }}
          onSubmit={handleOrderSubmit}
        />
      )}
    </div>
  );
};

export default MapView;