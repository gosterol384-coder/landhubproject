import { Plot, OrderData, Order } from '../types/land';
import { mockDataService } from './mockDataService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_MOCK_DATA = !import.meta.env.VITE_API_URL; // Use mock data if no API URL is configured

// Enhanced error handling with detailed logging
interface ApiError extends Error {
  status?: number;
  statusText?: string;
  url?: string;
  responseBody?: string;
}

// Connection health monitoring
let lastHealthCheck = 0;
let isHealthy = true;
// helper to normalize status from API → union type
function normalizeStatus(status: string | null | undefined): "available" | "taken" | "pending" {
  if (status === "available" || status === "taken" || status === "pending") {
    return status;
  }
  return "pending"; // fallback if API sends unexpected value
}

class PlotService {
  private async checkApiHealth(): Promise<boolean> {
    // If using mock data, always return healthy
    if (USE_MOCK_DATA) {
      return true;
    }
    
    const now = Date.now();
    
    // Only check health every 30 seconds
    if (now - lastHealthCheck < 30000 && isHealthy) {
      return isHealthy;
    }
    
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      isHealthy = response.ok;
      lastHealthCheck = now;
      
      if (!isHealthy) {
        console.warn('[PlotService] API health check failed:', response.status);
      }
      
      return isHealthy;
    } catch (error) {
      console.error('[PlotService] Health check error:', error);
      isHealthy = false;
      lastHealthCheck = now;
      return false;
    }
  }

  private async fetchWithErrorHandling(url: string, options?: RequestInit): Promise<Response> {
    // Check API health before making requests
    const healthy = await this.checkApiHealth();
    if (!healthy) {
      throw new Error('API server is not responding. Please check your connection and try again.');
    }

    try {
      console.log(`[PlotService] Making API request to: ${url}`);
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000), // 15 second timeout
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        let errorText = '';
        
        try {
          if (contentType.includes('application/json')) {
            const errorJson = await response.json();
            errorText = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
          } else {
            errorText = await response.text();
          }
        } catch {
          errorText = `HTTP ${response.status} ${response.statusText}`;
        }

        console.error(`[PlotService] ❌ API responded with error:`, {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          headers: Object.fromEntries(response.headers.entries()),
          responseBody: errorText.substring(0, 500)
        });
        
        // Create detailed error
        const apiError = new Error(`API Error: ${response.status} ${response.statusText}`) as ApiError;
        apiError.status = response.status;
        apiError.statusText = response.statusText;
        apiError.url = response.url;
        apiError.responseBody = errorText;
        
        // Provide specific error messages for common status codes
        if (response.status === 404) {
          apiError.message = 'API endpoint not found. Please check if the backend server is running.';
        } else if (response.status === 500) {
          apiError.message = 'Internal server error. Please try again later.';
        } else if (response.status === 503) {
          apiError.message = 'Service temporarily unavailable. Please try again in a moment.';
        } else if (response.status >= 400 && response.status < 500) {
          apiError.message = `Client error: ${errorText || response.statusText}`;
        } else {
          apiError.message = `Server error: ${errorText || response.statusText}`;
        }
        
        throw apiError;
      }

      return response;
    } catch (error) {
      console.error('[PlotService] Network/Request error:', error);
      
      // Handle different types of errors
      if (error instanceof TypeError) {
        if (error.message.includes('fetch')) {
          throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
        } else if (error.message.includes('AbortError') || error.name === 'AbortError') {
          throw new Error('Request timed out. The server may be slow or unavailable.');
        }
      }
      
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Request timed out. Please try again.');
      }
      
      throw error;
    }
  }

  async getAllPlots(): Promise<Plot[]> {
    // Use mock data if API is not configured
    if (USE_MOCK_DATA) {
      console.log('[PlotService] Using mock data service');
      return await mockDataService.getAllPlots();
    }
    
    try {
      console.log('[PlotService] Fetching all plots from API...');
      const response = await this.fetchWithErrorHandling(`${API_BASE}/api/plots`);
      const data = await response.json();
      
      console.log('[PlotService] Raw API response type:', typeof data, 'features count:', data?.features?.length);
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from server. Expected JSON object but received: ' + typeof data);
      }
      
      if (data.type !== 'FeatureCollection') {
        throw new Error(`Expected GeoJSON FeatureCollection but received type: ${data.type || 'unknown'}`);
      }
      
      if (!Array.isArray(data.features)) {
        throw new Error('Invalid features array in response. Expected array but got: ' + typeof data.features);
      }
      
      if (data.features.length === 0) {
        console.warn('[PlotService] No plots found in database');
        return []; // Return empty array instead of throwing error
      }
      
      // Transform GeoJSON features to Plot objects
      const plots: Plot[] = data.features.map((feature: any, index: number) => {
        try {
          if (!feature.properties || !feature.geometry) {
            console.warn(`[PlotService] Feature ${index} missing properties or geometry`);
            return null;
          }
          
          const props = feature.properties;
          
          // Validate required properties
          if (!props.id || !props.plot_code) {
            console.warn(`[PlotService] Feature ${index} missing required properties (id or plot_code)`);
            return null;
          }
          
          // Validate geometry
          if (!feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
            console.warn(`[PlotService] Feature ${index} has invalid geometry`);
            return null;
          }
          
          // Enhanced data validation and normalization
          return {
            id: props.id,
            plot_code: props.plot_code,
            status: normalizeStatus(props.status),
            area_hectares: Math.max(0, parseFloat(props.area_hectares) || 0),
            district: props.district || 'Unknown',
            ward: props.ward || 'Unknown',
            village: props.village || 'Unknown',
            geometry: feature.geometry,
            attributes: props.attributes || {},
            created_at: props.created_at || new Date().toISOString(),
            updated_at: props.updated_at || new Date().toISOString(),
          };
        } catch (error) {
          console.error(`[PlotService] Error processing feature ${index}:`, error);
          return null;
        }
      }).filter(Boolean) as Plot[]; // Remove null entries safely
      
      console.log(`[PlotService] ✅ Successfully processed ${plots.length} plots from ${data.features.length} features`);
      
      if (plots.length === 0) {
        console.warn('[PlotService] ⚠️ No valid plots found in API response');
      }
      
      return plots;
      
    } catch (error) {
      console.error('[PlotService] ❌ Error fetching plots:', error);
      
      // Enhanced error messaging
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          throw new Error('Cannot connect to the land plot server. Please check your internet connection and try again.');
        } else if (error.message.includes('timeout')) {
          throw new Error('Server request timed out. The server may be busy, please try again.');
        } else {
          throw new Error(`Failed to load land plots: ${error.message}`);
        }
      }
      
      throw new Error('An unexpected error occurred while loading land plots. Please try again.');
    }
  }

  async getPlotById(plotId: string): Promise<Plot | null> {
    if (USE_MOCK_DATA) {
      return await mockDataService.getPlotById(plotId);
    }
    
    try {
      console.log(`Fetching plot ${plotId}...`);
      const response = await this.fetchWithErrorHandling(`${API_BASE}/api/plots/${plotId}`);
      const feature = await response.json();
      
      if (!feature.properties || !feature.geometry) {
        return null;
      }
      
      const props = feature.properties;
      return {
        id: props.id,
        plot_code: props.plot_code,
        status: normalizeStatus(props.status),
        area_hectares: parseFloat(props.area_hectares),
        district: props.district,
        ward: props.ward,
        village: props.village,
        geometry: feature.geometry,
        attributes: props.attributes || {},
        created_at: props.created_at,
        updated_at: props.updated_at,
      };
      
    } catch (error) {
      console.error(`Error fetching plot ${plotId}:`, error);
      return null;
    }
  }

  async createOrder(plotId: string, orderData: OrderData): Promise<Order> {
    if (USE_MOCK_DATA) {
      return await mockDataService.createOrder(plotId, orderData);
    }
    
    try {
      console.log(`[PlotService] Creating order for plot ${plotId}`);
      
      // Enhanced validation
      if (!orderData.first_name?.trim()) {
        throw new Error('First name is required');
      }
      
      if (!orderData.last_name?.trim()) {
        throw new Error('Last name is required');
      }
      
      if (!orderData.customer_phone?.trim()) {
        throw new Error('Customer phone is required');
      }
      
      if (!orderData.customer_email?.trim()) {
        throw new Error('Customer email is required');
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(orderData.customer_email)) {
        throw new Error('Please enter a valid email address');
      }
      
      const response = await this.fetchWithErrorHandling(
        `${API_BASE}/api/plots/${plotId}/order`,
        {
          method: 'POST',
          body: JSON.stringify(orderData),
        }
      );
      
      const order = await response.json();
      console.log('[PlotService] ✅ Order created successfully:', order.id);
      
      return order;
      
    } catch (error) {
      console.error(`[PlotService] ❌ Error creating order for plot ${plotId}:`, error);
      throw error; // Re-throw the original error to preserve detailed error messages
    }
  }

  async searchPlots(filters: {
    district?: string;
    ward?: string;
    village?: string;
    status?: string;
    min_area?: number;
    max_area?: number;
    bbox?: string;
  }): Promise<Plot[]> {
    if (USE_MOCK_DATA) {
      return await mockDataService.searchPlots(filters);
    }
    
    try {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
      
      const url = `${API_BASE}/api/plots/search?${params.toString()}`;
      console.log(`Searching plots with filters:`, filters);
      
      const response = await this.fetchWithErrorHandling(url);
      const data = await response.json();
      
      if (data.type !== 'FeatureCollection') {
        throw new Error('Expected GeoJSON FeatureCollection format');
      }
      
      const plots: Plot[] = data.features.map((feature: any) => {
        const props = feature.properties;
        return {
          id: props.id,
          plot_code: props.plot_code,
          status: normalizeStatus(props.status),
          area_hectares: parseFloat(props.area_hectares),
          district: props.district,
          ward: props.ward,
          village: props.village,
          geometry: feature.geometry,
          attributes: props.attributes || {},
          created_at: props.created_at,
          updated_at: props.updated_at,
        };
      });
      
      console.log(`Found ${plots.length} plots matching search criteria`);
      return plots;
      
    } catch (error) {
      console.error('Error searching plots:', error);
      throw new Error(`Failed to search plots: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSystemStats(): Promise<{
    total_plots: number;
    available_plots: number;
    taken_plots: number;
    pending_plots: number;
    total_orders: number;
    districts: number;
    wards: number;
    villages: number;
    total_area_hectares: number;
  }> {
    if (USE_MOCK_DATA) {
      return await mockDataService.getSystemStats();
    }
    
    try {
      console.log('Fetching system statistics...');
      const response = await this.fetchWithErrorHandling(`${API_BASE}/api/stats`);
      const stats = await response.json();
      
      console.log('System stats:', stats);
      return stats;
      
    } catch (error) {
      console.error('Error fetching system stats:', error);
      throw new Error(`Failed to fetch statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOrders(filters?: {
    status?: string;
    plot_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    orders: Order[];
    total: number;
  }> {
    if (USE_MOCK_DATA) {
      return await mockDataService.getOrders(filters);
    }
    
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
      }
      
      const url = `${API_BASE}/api/orders?${params.toString()}`;
      console.log('Fetching orders...');
      
      const response = await this.fetchWithErrorHandling(url);
      const data = await response.json();
      
      console.log(`Fetched ${data.orders?.length || 0} orders`);
      return data;
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw new Error(`Failed to fetch orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Health check method
  async checkHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    if (USE_MOCK_DATA) {
      return await mockDataService.checkHealth();
    }
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        return { 
          healthy: true, 
          latency,
          ...data 
        };
      } else {
        return { 
          healthy: false, 
          latency,
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (error) {
      console.error('[PlotService] Health check failed:', error);
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Real-time data subscription (for future WebSocket implementation)
  subscribeToPlotUpdates(callback: (plots: Plot[]) => void): () => void {
    if (USE_MOCK_DATA) {
      return mockDataService.subscribeToPlotUpdates(callback);
    }
    
    // Placeholder for WebSocket implementation
    console.log('[PlotService] Plot update subscription requested');
    
    // For now, return a no-op unsubscribe function
    return () => {
      console.log('[PlotService] Plot update subscription cancelled');
    };
  }
}

// Export singleton instance
export const plotService = new PlotService();
export default plotService;