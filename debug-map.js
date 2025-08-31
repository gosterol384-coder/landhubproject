// Map Debugging Script
// Run this in browser console to diagnose map rendering issues

function debugMapRendering() {
  console.log("🗺️ Debugging Map Rendering Issues...\n");
  
  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    console.error("❌ Leaflet library not loaded!");
    return;
  }
  console.log("✅ Leaflet library loaded:", L.version);
  
  // Check map container
  const mapContainer = document.querySelector('.leaflet-container');
  if (!mapContainer) {
    console.error("❌ Map container not found!");
    return;
  }
  
  const containerRect = mapContainer.getBoundingClientRect();
  console.log("📐 Map container dimensions:", {
    width: containerRect.width,
    height: containerRect.height,
    visible: containerRect.width > 0 && containerRect.height > 0
  });
  
  // Check if map instance exists
  const mapInstance = mapContainer._leaflet_map;
  if (!mapInstance) {
    console.error("❌ Map instance not found!");
    return;
  }
  console.log("✅ Map instance found");
  
  // Check map center and zoom
  const center = mapInstance.getCenter();
  const zoom = mapInstance.getZoom();
  console.log("🎯 Map center:", center.lat.toFixed(6), center.lng.toFixed(6));
  console.log("🔍 Map zoom:", zoom);
  
  // Check if center is in Tanzania bounds
  const inTanzania = (
    center.lng >= 29.34 && center.lng <= 40.44 &&
    center.lat >= -11.75 && center.lat <= -0.95
  );
  console.log("🇹🇿 Center in Tanzania bounds:", inTanzania);
  
  // Check tile layers
  const tileLayers = [];
  mapInstance.eachLayer(layer => {
    if (layer instanceof L.TileLayer) {
      tileLayers.push({
        url: layer._url,
        loaded: layer._loading === 0,
        opacity: layer.options.opacity
      });
    }
  });
  console.log("🗂️ Tile layers:", tileLayers);
  
  // Check for plot layers
  const plotLayers = [];
  mapInstance.eachLayer(layer => {
    if (layer instanceof L.GeoJSON) {
      const featureCount = Object.keys(layer._layers).length;
      plotLayers.push({
        type: 'GeoJSON',
        featureCount: featureCount,
        bounds: layer.getBounds()
      });
    }
  });
  console.log("📍 Plot layers:", plotLayers);
  
  // Check CSS issues
  const computedStyle = window.getComputedStyle(mapContainer);
  console.log("🎨 Container CSS:", {
    display: computedStyle.display,
    visibility: computedStyle.visibility,
    opacity: computedStyle.opacity,
    position: computedStyle.position,
    zIndex: computedStyle.zIndex,
    overflow: computedStyle.overflow
  });
  
  // Check for tile loading errors
  const tilePane = mapContainer.querySelector('.leaflet-tile-pane');
  if (tilePane) {
    const tiles = tilePane.querySelectorAll('.leaflet-tile');
    const loadedTiles = Array.from(tiles).filter(tile => 
      !tile.classList.contains('leaflet-tile-loading')
    );
    console.log("🧩 Tiles:", {
      total: tiles.length,
      loaded: loadedTiles.length,
      loading: tiles.length - loadedTiles.length
    });
  }
  
  // Test coordinate transformation
  const testPoint = L.latLng(-6.7833, 39.2083); // Dar es Salaam
  const containerPoint = mapInstance.latLngToContainerPoint(testPoint);
  console.log("🔄 Coordinate test:", {
    latLng: [testPoint.lat, testPoint.lng],
    containerPoint: [containerPoint.x, containerPoint.y],
    inView: (
      containerPoint.x >= 0 && containerPoint.x <= containerRect.width &&
      containerPoint.y >= 0 && containerPoint.y <= containerRect.height
    )
  });
  
  // Summary
  console.log("\n📋 DIAGNOSIS SUMMARY:");
  console.log("=".repeat(50));
  
  if (containerRect.width === 0 || containerRect.height === 0) {
    console.log("❌ ISSUE: Map container has zero dimensions");
    console.log("💡 FIX: Ensure parent container has proper height/width");
  }
  
  if (!inTanzania) {
    console.log("❌ ISSUE: Map center is outside Tanzania");
    console.log("💡 FIX: Reset map center to Tanzania coordinates");
  }
  
  if (tileLayers.length === 0) {
    console.log("❌ ISSUE: No tile layers found");
    console.log("💡 FIX: Add base tile layer (OSM, etc.)");
  }
  
  if (plotLayers.length === 0) {
    console.log("❌ ISSUE: No plot data layers found");
    console.log("💡 FIX: Check data loading and GeoJSON rendering");
  }
  
  console.log("\n🔧 Run this in console to force map refresh:");
  console.log("mapContainer._leaflet_map.invalidateSize(); mapContainer._leaflet_map.fitBounds([[-11.75, 29.34], [-0.95, 40.44]]);");
}

// Auto-run when script loads
debugMapRendering();

// Export for manual use
window.debugMapRendering = debugMapRendering;