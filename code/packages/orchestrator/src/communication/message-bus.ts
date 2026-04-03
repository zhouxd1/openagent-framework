/**
 * @fileoverview Message Bus
 * @description Central message bus for agent communication
 */

import { AgentMessage, MessageHandler, ChannelNotFoundError } from '../types';
import { Channel, ChannelConfig } from './channel';
import { ExtendedAgentMessage, MessageFactory, MessagePriority } from './protocol';

/**
 * Message bus configuration
 */
export interface MessageBusConfig {
  /** Default channel configuration */
  defaultChannelConfig?: Partial<ChannelConfig>;
  /** Enable message logging */
  enableLogging?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
}

/**
 * Message bus statistics
 */
export interface MessageBusStats {
  /** Total channels */
  totalChannels: number;
  /** Total messages sent */
  totalMessagesSent: number;
  /** Total messages received */
  totalMessagesReceived: number;
  /** Total subscribers */
  totalSubscribers: number;
}

/**
 * Central message bus for agent communication
 */
export class MessageBus {
  private channels: Map<string, Channel> = new Map();
  private subscribers: Map<string, Set<MessageHandler>> = new Map();
  private config: MessageBusConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: MessageBusConfig = {}) {
    this.config = {
      enableLogging: false,
      cleanupInterval: 60000, // 1 minute
      ...config,
    };

    // Start automatic cleanup
    if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Create a new channel
   */
  createChannel(channelId: string, config?: Partial<ChannelConfig>): Channel {
    if (this.channels.has(channelId)) {
      return this.channels.get(channelId)!;
    }

    const channelConfig: ChannelConfig = {
      id: channelId,
      ...this.config.defaultChannelConfig,
      ...config,
    };

    const channel = new Channel(channelConfig);
    this.channels.set(channelId, channel);

    this.log(`Created channel: ${channelId}`);
    return channel;
  }

  /**
   * Delete a channel
   */
  deleteChannel(channelId: string): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return false;
    }

    channel.clear();
    this.channels.delete(channelId);
    this.subscribers.delete(channelId);

    this.log(`Deleted channel: ${channelId}`);
    return true;
  }

  /**
   * Send a message to a channel
   */
  async send(channelId: string, message: AgentMessage): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }

    await channel.publish(message as ExtendedAgentMessage);

    // Also notify global subscribers for this channel
    const subscribers = this.subscribers.get(channelId);
    if (subscribers) {
      const notifyPromises = Array.from(subscribers).map(handler =>
        this.notifyHandler(handler, message)
      );
      await Promise.all(notifyPromises);
    }

    this.log(`Sent message ${message.id} to channel ${channelId}`);
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channelId: string, handler: MessageHandler): () => void {
    if (!this.subscribers.has(channelId)) {
      this.subscribers.set(channelId, new Set());
    }

    this.subscribers.get(channelId)!.add(handler);

    this.log(`Subscribed to channel ${channelId}`);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(channelId)?.delete(handler);
      this.log(`Unsubscribed from channel ${channelId}`);
    };
  }

  /**
   * Broadcast a message to all channels
   */
  async broadcast(message: AgentMessage): Promise<void> {
    const sendPromises = Array.from(this.channels.keys()).map(channelId =>
      this.send(channelId, message)
    );

    await Promise.all(sendPromises);
    this.log(`Broadcast message ${message.id} to all channels`);
  }

  /**
   * Send a direct message to a specific agent
   */
  async sendDirect(
    channelId: string,
    from: string,
    to: string,
    payload: any,
    type: AgentMessage['type'] = 'task'
  ): Promise<void> {
    const message = MessageFactory.createTaskMessage(from, to, payload);
    (message as any).type = type;
    
    await this.send(channelId, message);
  }

  /**
   * Get messages from a channel
   */
  getMessages(channelId: string): AgentMessage[] {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }

    return channel.getMessages();
  }

  /**
   * Clear a channel
   */
  clearChannel(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.clear();
      this.log(`Cleared channel ${channelId}`);
    }
  }

  /**
   * Get channel statistics
   */
  getChannelStats(channelId: string) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }

    return channel.getStats();
  }

  /**
   * Get overall message bus statistics
   */
  getStats(): MessageBusStats {
    let totalMessagesSent = 0;
    let totalMessagesReceived = 0;
    let totalSubscribers = 0;

    this.channels.forEach(channel => {
      const stats = channel.getStats();
      totalMessagesSent += stats.messagesSent;
      totalMessagesReceived += stats.messagesReceived;
    });

    this.subscribers.forEach(subs => {
      totalSubscribers += subs.size;
    });

    return {
      totalChannels: this.channels.size,
      totalMessagesSent,
      totalMessagesReceived,
      totalSubscribers,
    };
  }

  /**
   * Clean up expired messages from all channels
   */
  cleanup(): void {
    this.channels.forEach(channel => channel.cleanup());
    this.log('Cleaned up expired messages from all channels');
  }

  /**
   * Shutdown the message bus
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.channels.forEach(channel => channel.clear());
    this.channels.clear();
    this.subscribers.clear();

    this.log('Message bus shutdown complete');
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Notify a handler of a message
   */
  private async notifyHandler(
    handler: MessageHandler,
    message: AgentMessage
  ): Promise<void> {
    try {
      await handler(message);
    } catch (error) {
      console.error(`Error in message handler: ${error}`);
    }
  }

  /**
   * Log a message if logging is enabled
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[MessageBus] ${message}`);
    }
  }
}
