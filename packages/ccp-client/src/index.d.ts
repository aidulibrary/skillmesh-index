declare module "@skillmesh-ccp/ccp-client" {
  interface CCPClientOptions {
    baseUrl?: string;
    timeout?: number;
    agentId?: string;
  }

  interface SearchOptions {
    federated?: boolean;
  }

  interface TrustVector {
    source: number;
    usage: number;
    usageRate: number;
    success: number;
    risk: number;
    time: number;
    evidence: number;
  }

  interface TrustVectorResult {
    capability_id: string;
    dimensions: string[];
    vector: TrustVector;
  }

  interface TelemetryData {
    capability_id: string;
    agent_id?: string;
    success: boolean;
    [key: string]: unknown;
  }

  interface ContributeData {
    [key: string]: unknown;
  }

  interface FederationNodeData {
    id: string;
    name: string;
    endpoint: string;
    description?: string;
    trust_weight?: number;
  }

  interface ExchangeData {
    node_id: string;
    capabilities: Array<{
      id: string;
      name: string;
      name_en?: string;
      category?: string;
      trust_usage_rate?: number;
      trust_success?: number;
      trust_uncertainty?: number;
    }>;
  }

  interface SearchResult {
    count: number;
    results: Array<{
      id: string;
      name: string;
      name_en?: string;
      desc?: string;
      category?: string;
      [key: string]: unknown;
    }>;
  }

  interface CapabilitiesResult {
    count: number;
    version: string;
    results: Array<{
      id: string;
      name: string;
      [key: string]: unknown;
    }>;
  }

  interface CapabilityDetail {
    id: string;
    name: string;
    [key: string]: unknown;
  }

  interface AdapterResult {
    [key: string]: unknown;
  }

  interface MetricsResult {
    requests?: number;
    errors?: number;
    latency?: number;
    [key: string]: unknown;
  }

  interface NodeInfo {
    node?: string;
    protocol?: string;
    version?: string;
    [key: string]: unknown;
  }

  class CCPClient {
    constructor(options?: CCPClientOptions);

    readonly baseUrl: string;
    readonly timeout: number;
    readonly agentId: string;
    readonly protocol: string;
    readonly version: string;

    search(q: string, opts?: SearchOptions): Promise<SearchResult>;
    getCapability(id: string): Promise<CapabilityDetail>;
    listCapabilities(): Promise<CapabilitiesResult>;
    getAdapter(id: string, framework: string): Promise<AdapterResult>;
    getMetrics(): Promise<MetricsResult>;
    sendTelemetry(data: TelemetryData): Promise<unknown>;
    contribute(data: ContributeData): Promise<unknown>;
    getNodeInfo(): Promise<NodeInfo>;
    listNodes(): Promise<{ nodes: FederationNodeData[] }>;
    addNode(data: FederationNodeData): Promise<unknown>;
    removeNode(id: string): Promise<unknown>;
    exchangeIndex(data: ExchangeData): Promise<unknown>;
    getTrustVector(id: string): Promise<TrustVectorResult>;
  }

  function computeTrustVector(cap: CapabilityDetail): TrustVector | null;

  const TRUST_DIMS: string[];
  const DEFAULT_BASE_URL: string;
  const DEFAULT_TIMEOUT: number;
}
