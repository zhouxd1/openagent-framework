/**
 * @fileoverview Communication Channel
 * @description Manages communication channels for agent messaging
 */

import { AgentMessage, MessageHandler } from '../types';
import { ExtendedAgentMessage, MessageValidator } from './protocol';

/**
 * Channel configuration
 */
export interface ChannelConfig {
  /** Channel ID */
  id: string;
  /** Maximum message queue size */
  maxSize?: number;
  /** Message TTL in milliseconds */
  messageTtl?: number;
}

/**
 * Channel statistics
 */
export interface ChannelStats {
  /** Total messages sent */
  messagesSent: number;
  /** Total messages received */
  messagesReceived: number;
  /** Current queue size */
  queueSize: number;
  /** Number of subscribers */
  subscriberCount: number;
}

/**
 * Communication channel for message passing
 */
export class Channel {
  private id: string;
  private messages: ExtendedAgentMessage[] = [];
  private subscribers: Set<MessageHandler> = new Set();
  private maxSize: number;
  private messageTtl: number;
  private stats: ChannelStats;

  constructor(config: ChannelConfig) {
    this.id = config.id;
    this.maxSize = config.maxSize || 1000;
    this.messageTtl = config.messageTtl || 300000; // 5 minutes
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      queueSize: 0,
      subscriberCount: 0,
    };
  }

  /**
   * Get channel ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Publish a message to the channel
   */
  async publish(message: ExtendedAgentMessage): Promise<void> {
    // Validate message
    const validation = MessageValidator.validate(message);
    if (!validation.valid) {
      throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
    }

    // Check queue capacity
    if (this.messages.length >= this.maxSize) {
      // Remove oldest message
      this.messages.shift();
    }

    // Add message to queue
    this.messages.push(message);
    this.stats.messagesReceived++;
    this.stats.queueSize = this.messages.length;

    // Notify subscribers
    const notifyPromises = Array.from(this.subscribers).map(handler =>
      this.notifyHandler(handler, message)
    );

    await Promise.all(notifyPromises);
  }

  /**
   * Subscribe to channel messages
   */
  subscribe(handler: MessageHandler): () => void {
    this.subscribers.add(handler);
    this.stats.subscriberCount = this.subscribers.size;

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(handler);
      this.stats.subscriberCount = this.subscribers.size;
    };
  }

  /**
   * Get all messages from the channel
   */
  getMessages(): ExtendedAgentMessage[] {
    return [...this.messages];
  }

  /**
   * Get messages from a specific sender
   */
  getMessagesFrom(senderId: string): ExtendedAgentMessage[] {
    return this.messages.filter(msg => msg.from === senderId);
  }

  /**
   * Get messages to a specific recipient
   */
  getMessagesTo(recipientId: string): ExtendedAgentMessage[] {
    return this.messages.filter(msg => msg.to === recipientId);
  }

  /**
   * Clear all messages from the channel
   */
  clear(): void {
    this.messages = [];
    this.stats.queueSize = 0;
  }

  /**
   * Get channel statistics
   */
  getStats(): ChannelStats {
    return { ...this.stats };
  }

  /**
   * Clean up expired messages
   */
  cleanup(): void {
    const now = Date.now();
    const originalSize = this.messages.length;

    this.messages = this.messages.filter(msg => {
      const age = now - msg.timestamp.getTime();
      const ttl = msg.ttl || this.messageTtl;
      return age < ttl;
    });

    this.stats.queueSize = this.messages.length;
    const removed = originalSize - this.messages.length;

    if (removed > 0) {
      console.log(`Cleaned up ${removed} expired messages from channel ${this.id}`);
    }
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
      this.stats.messagesSent++;
    } catch (error) {
      console.error(`Error in message handler: ${error}`);
    }
  }
}

/**
 * Channel manager for managing multiple channels
 */
export class ChannelManager {
  private channels: Map<string, Channel> = new Map();

  /**
   * Create a new channel
   */
  createChannel(config: ChannelConfig): Channel {
    if (this.channels.has(config.id)) {
      throw new Error(`Channel ${config.id} already exists`);
    }

    const channel = new Channel(config);
    this.channels.set(config.id, channel);
    return channel;
  }

  /**
   * Get a channel by ID
   */
  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Delete a channel
   */
  deleteChannel(channelId: string): boolean {
    return this.channels.delete(channelId);
  }

  /**
   * Get all channel IDs
   */
  getChannelIds(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Clean up all channels
   */
  cleanupAll(): void {
    this.channels.forEach(channel => channel.cleanup());
  }

  /**
   * Get statistics for all channels
   */
  getAllStats(): Map<string, ChannelStats> {
    const stats = new Map<string, ChannelStats>();
    this.channels.forEach((channel, id) => {
      stats.set(id, channel.getStats());
    });
    return stats;
  }
}
