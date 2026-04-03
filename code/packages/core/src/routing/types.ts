/**
 * 路由系统类型定义
 */

/**
 * 任务类型枚举
 */
export enum TaskType {
  CODING = 'coding',
  WRITING = 'writing',
  ANALYSIS = 'analysis',
  CHAT = 'chat',
  TRANSLATION = 'translation',
  MATH = 'math',
}

/**
 * 提供商统计信息
 */
export interface ProviderStats {
  avgResponseTime: number;  // 平均响应时间（毫秒)
  availability: number;     // 可用性 (0-1)
  totalRequests: number;    // 总请求数
  errorRate: number;        // 错误率 (0-1)
  lastChecked: Date;        // 最后检查时间
}

/**
 * 提供商信息
 */
export interface ProviderInfo {
  name: string;             // 提供商名称
  displayName: string;      // 显示名称
  models: string[];         // 支持的模型列表
  capabilities: string[];   // 能力列表
  pricing: {
    input: number;          // 每 1K tokens 输入价格(美元)
    output: number;         // 每 1K tokens 输出价格(美元)
  };
  limits: {
    maxTokens: number;      // 最大 tokens 数
    rateLimit?: number;     // 速率限制(请求/分钟)
  };
  stats: ProviderStats;     // 统计信息
}

/**
 * 消息类型
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 工具定义 - 重命名为 RoutingTool 避免与 Agent.Tool 冲突
 */
export interface RoutingTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * 约束条件
 */
export interface Constraints {
  maxCost?: number;                  // 最大成本(美元)
  maxLatency?: number;               // 最大延迟(毫秒)
  requiredCapabilities?: string[];   // 必需的能力
  preferredProviders?: string[];     // 首选提供商
}

/**
 * 路由上下文
 */
export interface RoutingContext {
  task: string;                      // 任务描述
  taskType?: TaskType;               // 任务类型
  messages?: Message[];              // 消息历史
  tools?: RoutingTool[];              // 可用工具(重命名)
  constraints?: Constraints;         // 约束条件
}

/**
 * 路由结果
 */
export interface RoutingResult {
  provider: string;                  // 选择的提供商
  model: string;                     // 选择的模型
  reason: string;                    // 选择原因
  fallback?: string;                 // 备用提供商
  estimatedCost?: number;            // 鎄估成本(美元)
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  interval?: number;                 // 检查间隔(毫秒)
  timeout?: number;                  // 超时时间(毫秒)
  retries?: number;                  // 重试次数
}

/**
 * 提供商池配置
 */
export interface PoolConfig {
  healthCheck?: HealthCheckConfig;   // 健康检查配置
  updateInterval?: number;           // 更新间隔(毫秒)
}

/**
 * 路由器配置
 */
export interface RouterConfig {
  defaultStrategy?: string;          // 默认策略名称
  fallbackEnabled?: boolean;         // 是否启用回退
  healthCheck?: HealthCheckConfig;   // 健康检查配置
  maxRetries?: number;               // 最大重试次数
}

/**
 * 健康状态
 */
export interface HealthStatus {
  isHealthy: boolean;
  timestamp: number;
  error?: string;
}
