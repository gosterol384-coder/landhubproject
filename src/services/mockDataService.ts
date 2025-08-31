import { Plot, OrderData, Order } from '../types/land';

// Mock Tanzania land plot data for development
const mockPlots: Plot[] = [
  {
    id: "plot-001",
    plot_code: "DSM/KINONDONI/001",
    status: "available",
    area_hectares: 2.5,
    district: "Kinondoni",
    ward: "Msasani",
    village: "Msasani Bonde la Mpunga",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [39.2083, -6.7833],
        [39.2093, -6.7833],
        [39.2093, -6.7843],
        [39.2083, -6.7843],
        [39.2083, -6.7833]
      ]]
    },
    attributes: {
      land_use: "residential",
      soil_type: "sandy",
      elevation: 45
    },
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z"
  },
  {
    id: "plot-002",
    plot_code: "DSM/KINONDONI/002",
    status: "taken",
    area_hectares: 1.8,
    district: "Kinondoni",
    ward: "Msasani",
    village: "Msasani Bonde la Mpunga",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [39.2093, -6.7833],
        [39.2103, -6.7833],
        [39.2103, -6.7843],
        [39.2093, -6.7843],
        [39.2093, -6.7833]
      ]]
    },
    attributes: {
      land_use: "residential",
      soil_type: "clay",
      elevation: 42
    },
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-20T14:30:00Z"
  },
  {
    id: "plot-003",
    plot_code: "DSM/KINONDONI/003",
    status: "pending",
    area_hectares: 3.2,
    district: "Kinondoni",
    ward: "Msasani",
    village: "Msasani Bonde la Mpunga",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [39.2103, -6.7833],
        [39.2113, -6.7833],
        [39.2113, -6.7843],
        [39.2103, -6.7843],
        [39.2103, -6.7833]
      ]]
    },
    attributes: {
      land_use: "agricultural",
      soil_type: "loam",
      elevation: 48
    },
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-22T09:15:00Z"
  },
  {
    id: "plot-004",
    plot_code: "DSM/TEMEKE/001",
    status: "available",
    area_hectares: 4.1,
    district: "Temeke",
    ward: "Kigamboni",
    village: "Kigamboni Mjimwema",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [39.2200, -6.8200],
        [39.2220, -6.8200],
        [39.2220, -6.8220],
        [39.2200, -6.8220],
        [39.2200, -6.8200]
      ]]
    },
    attributes: {
      land_use: "commercial",
      soil_type: "sandy",
      elevation: 35
    },
    created_at: "2024-01-16T11:00:00Z",
    updated_at: "2024-01-16T11:00:00Z"
  },
  {
    id: "plot-005",
    plot_code: "DSM/ILALA/001",
    status: "available",
    area_hectares: 1.5,
    district: "Ilala",
    ward: "Upanga",
    village: "Upanga Magharibi",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [39.2800, -6.8100],
        [39.2815, -6.8100],
        [39.2815, -6.8115],
        [39.2800, -6.8115],
        [39.2800, -6.8100]
      ]]
    },
    attributes: {
      land_use: "residential",
      soil_type: "clay",
      elevation: 52
    },
    created_at: "2024-01-17T09:30:00Z",
    updated_at: "2024-01-17T09:30:00Z"
  }
];

let mockOrders: Order[] = [];
let orderIdCounter = 1;

export class MockDataService {
  private simulateNetworkDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  }

  async getAllPlots(): Promise<Plot[]> {
    await this.simulateNetworkDelay();
    console.log('[MockDataService] ✅ Returning', mockPlots.length, 'mock plots');
    return [...mockPlots];
  }

  async getPlotById(plotId: string): Promise<Plot | null> {
    await this.simulateNetworkDelay();
    const plot = mockPlots.find(p => p.id === plotId);
    console.log(`[MockDataService] ${plot ? '✅' : '❌'} Plot ${plotId} ${plot ? 'found' : 'not found'}`);
    return plot || null;
  }

  async createOrder(plotId: string, orderData: OrderData): Promise<Order> {
    await this.simulateNetworkDelay();
    
    const plot = mockPlots.find(p => p.id === plotId);
    if (!plot) {
      throw new Error('Plot not found');
    }
    
    if (plot.status !== 'available') {
      throw new Error(`Plot is not available for ordering. Current status: ${plot.status}`);
    }

    const order: Order = {
      id: `order-${orderIdCounter++}`,
      plot_id: plotId,
      plot_code: plot.plot_code,
      first_name: orderData.first_name,
      last_name: orderData.last_name,
      customer_phone: orderData.customer_phone,
      customer_email: orderData.customer_email,
      customer_id_number: orderData.customer_id_number,
      intended_use: orderData.intended_use,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockOrders.push(order);
    
    // Update plot status to pending
    plot.status = 'pending';
    plot.updated_at = new Date().toISOString();
    
    console.log('[MockDataService] ✅ Order created:', order.id);
    return order;
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
    await this.simulateNetworkDelay();
    
    let filteredPlots = [...mockPlots];
    
    if (filters.district) {
      filteredPlots = filteredPlots.filter(p => 
        p.district.toLowerCase().includes(filters.district!.toLowerCase())
      );
    }
    
    if (filters.ward) {
      filteredPlots = filteredPlots.filter(p => 
        p.ward.toLowerCase().includes(filters.ward!.toLowerCase())
      );
    }
    
    if (filters.village) {
      filteredPlots = filteredPlots.filter(p => 
        p.village.toLowerCase().includes(filters.village!.toLowerCase())
      );
    }
    
    if (filters.status) {
      filteredPlots = filteredPlots.filter(p => p.status === filters.status);
    }
    
    if (filters.min_area !== undefined) {
      filteredPlots = filteredPlots.filter(p => p.area_hectares >= filters.min_area!);
    }
    
    if (filters.max_area !== undefined) {
      filteredPlots = filteredPlots.filter(p => p.area_hectares <= filters.max_area!);
    }
    
    console.log(`[MockDataService] ✅ Search returned ${filteredPlots.length} plots`);
    return filteredPlots;
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
    await this.simulateNetworkDelay();
    
    const stats = {
      total_plots: mockPlots.length,
      available_plots: mockPlots.filter(p => p.status === 'available').length,
      taken_plots: mockPlots.filter(p => p.status === 'taken').length,
      pending_plots: mockPlots.filter(p => p.status === 'pending').length,
      total_orders: mockOrders.length,
      districts: new Set(mockPlots.map(p => p.district)).size,
      wards: new Set(mockPlots.map(p => p.ward)).size,
      villages: new Set(mockPlots.map(p => p.village)).size,
      total_area_hectares: mockPlots.reduce((sum, p) => sum + p.area_hectares, 0)
    };
    
    console.log('[MockDataService] ✅ System stats:', stats);
    return stats;
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
    await this.simulateNetworkDelay();
    
    let filteredOrders = [...mockOrders];
    
    if (filters?.status) {
      filteredOrders = filteredOrders.filter(o => o.status === filters.status);
    }
    
    if (filters?.plot_id) {
      filteredOrders = filteredOrders.filter(o => o.plot_id === filters.plot_id);
    }
    
    const total = filteredOrders.length;
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;
    
    filteredOrders = filteredOrders.slice(offset, offset + limit);
    
    console.log(`[MockDataService] ✅ Orders returned: ${filteredOrders.length}/${total}`);
    return {
      orders: filteredOrders,
      total
    };
  }

  async checkHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    await this.simulateNetworkDelay();
    return {
      healthy: true,
      latency: 150,
    };
  }

  subscribeToPlotUpdates(callback: (plots: Plot[]) => void): () => void {
    console.log('[MockDataService] Plot update subscription requested');
    
    // Simulate real-time updates every 30 seconds
    const interval = setInterval(async () => {
      try {
        const plots = await this.getAllPlots();
        callback(plots);
      } catch (error) {
        console.error('[MockDataService] Error in subscription update:', error);
      }
    }, 30000);
    
    return () => {
      clearInterval(interval);
      console.log('[MockDataService] Plot update subscription cancelled');
    };
  }
}

export const mockDataService = new MockDataService();