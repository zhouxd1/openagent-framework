/**
 * 基于任务类型的路由策略
 * 根据任务类型选择最适合的提供商
 */

import { RoutingStrategy } from '../strategies/base';
import { ProviderInfo, RoutingContext, TaskType } from '../types';

/**
 * 任务类型到推荐模型的映射
 */
export const TASK_PROVIDER_MAPPING: Record<TaskType, string[]> = {
  [TaskType.CODING]: ['deepseek-coder', 'gpt-4', 'claude-3-opus', 'claude-3-sonnet'],
  [TaskType.WRITING]: ['claude-3-opus', 'gpt-4', 'deepseek-chat'],
  [TaskType.ANALYSIS]: ['gpt-4', 'claude-3-opus', 'deepseek-chat'],
  [TaskType.CHAT]: ['gpt-3.5-turbo', 'deepseek-chat', 'glm-4'],
  [TaskType.TRANSLATION]: ['gpt-4', 'claude-3-opus', 'deepseek-chat'],
  [TaskType.MATH]: ['gpt-4', 'claude-3-opus'],
};

export class TaskBasedStrategy implements RoutingStrategy {
  name = 'task-based';
  weight = 1;

  async select(
    context: RoutingContext,
    providers: ProviderInfo[]
  ): Promise<ProviderInfo> {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // 识别任务类型
    const taskType = context.taskType || await this.detectTaskType(context.task);

    // 获取推荐的模型列表
    const recommendedModels = TASK_PROVIDER_MAPPING[taskType] || [];

    // 从可用提供商中选择优先级最高的
    for (const modelName of recommendedModels) {
      const provider = providers.find(p => 
        p.models.includes(modelName)
      );
      if (provider) return provider;
    }

    // 没有匹配则返回第一个可用提供商
    return providers[0];
  }

  /**
   * 检测任务类型（简单关键词匹配）
   */
  private async detectTaskType(task: string): Promise<TaskType> {
    const taskLower = task.toLowerCase();

    // 编程相关
    if (/code|编程|代码|函数|debug|implement/i.test(taskLower)) {
      return TaskType.CODING;
    }

    // 写作相关
    if (/write|article|story|写作|文章|小说/i.test(taskLower)) {
      return TaskType.WRITING;
    }

    // 分析相关
    if (/analyze|analysis|data|分析|数据/i.test(taskLower)) {
      return TaskType.ANALYSIS;
    }

    // 翻译相关
    if (/translate|翻译/i.test(taskLower)) {
      return TaskType.TRANSLATION;
    }

    // 数学相关
    if (/calculate|math|equation|计算|数学|方程/i.test(taskLower)) {
      return TaskType.MATH;
    }

    // 默认为聊天
    return TaskType.CHAT;
  }
}
