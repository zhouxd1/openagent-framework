/**
 * @fileoverview Communication Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../src/communication/message-bus';
import { Channel, ChannelManager } from '../src/communication/channel';
import {
  MessageFactory,
  MessageValidator,
  MessageType,
  MessagePriority,
} from '../src/communication/protocol';
import { ChannelNotFoundError } from '../src/types';

describe('MessageBus', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = new MessageBus({
      enableLogging: false,
    });
  });

  afterEach(() => {
    messageBus.shutdown();
  });

  describe('Channel Management', () => {
    it('should create a channel', () => {
      const channel = messageBus.createChannel('test-channel');

      expect(channel).toBeDefined();
      expect(channel.getId()).toBe('test-channel');
    });

    it('should return existing channel if already exists', () => {
      messageBus.createChannel('test-channel');
      const channel2 = messageBus.createChannel('test-channel');

      expect(channel2.getId()).toBe('test-channel');
    });

    it('should delete a channel', () => {
      messageBus.createChannel('test-channel');
      const deleted = messageBus.deleteChannel('test-channel');

      expect(deleted).toBe(true);
    });

    it('should return false when deleting non-existent channel', () => {
      const deleted = messageBus.deleteChannel('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('Message Sending', () => {
    it('should send a message to a channel', async () => {
      messageBus.createChannel('test-channel');

      const message = MessageFactory.createTaskMessage(
        'agent-1',
        'agent-2',
        { task: 'test task' }
      );

      await messageBus.send('test-channel', message);

      const messages = messageBus.getMessages('test-channel');
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe(message.id);
    });

    it('should throw error when sending to non-existent channel', async () => {
      const message = MessageFactory.createTaskMessage(
        'agent-1',
        'agent-2',
        { task: 'test' }
      );

      await expect(
        messageBus.send('non-existent', message)
      ).rejects.toThrow(ChannelNotFoundError);
    });

    it('should broadcast message to all channels', async () => {
      messageBus.createChannel('channel-1');
      messageBus.createChannel('channel-2');
      messageBus.createChannel('channel-3');

      const message = MessageFactory.createTaskMessage(
        'agent-1',
        'agent-2',
        { task: 'broadcast' }
      );

      await messageBus.broadcast(message);

      expect(messageBus.getMessages('channel-1').length).toBe(1);
      expect(messageBus.getMessages('channel-2').length).toBe(1);
      expect(messageBus.getMessages('channel-3').length).toBe(1);
    });

    it('should send direct message', async () => {
      messageBus.createChannel('test-channel');

      await messageBus.sendDirect(
        'test-channel',
        'agent-1',
        'agent-2',
        { data: 'test' }
      );

      const messages = messageBus.getMessages('test-channel');
      expect(messages.length).toBe(1);
      expect(messages[0].from).toBe('agent-1');
      expect(messages[0].to).toBe('agent-2');
    });
  });

  describe('Subscriptions', () => {
    it('should subscribe to channel messages', async () => {
      messageBus.createChannel('test-channel');

      const handler = vi.fn();
      const unsubscribe = messageBus.subscribe('test-channel', handler);

      const message = MessageFactory.createTaskMessage(
        'agent-1',
        'agent-2',
        { task: 'test' }
      );

      await messageBus.send('test-channel', message);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(message);

      unsubscribe();
    });

    it('should unsubscribe from channel', async () => {
      messageBus.createChannel('test-channel');

      const handler = vi.fn();
      const unsubscribe = messageBus.subscribe('test-channel', handler);

      unsubscribe();

      const message = MessageFactory.createTaskMessage(
        'agent-1',
        'agent-2',
        { task: 'test' }
      );

      await messageBus.send('test-channel', message);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should get channel statistics', async () => {
      messageBus.createChannel('test-channel');

      const message = MessageFactory.createTaskMessage(
        'agent-1',
        'agent-2',
        { task: 'test' }
      );

      await messageBus.send('test-channel', message);

      const stats = messageBus.getChannelStats('test-channel');

      expect(stats.messagesReceived).toBe(1);
    });

    it('should get overall statistics', async () => {
      messageBus.createChannel('channel-1');
      messageBus.createChannel('channel-2');

      const stats = messageBus.getStats();

      expect(stats.totalChannels).toBe(2);
    });

    it('should throw error for non-existent channel stats', () => {
      expect(() => {
        messageBus.getChannelStats('non-existent');
      }).toThrow(ChannelNotFoundError);
    });
  });

  describe('Cleanup', () => {
    it('should clear a channel', async () => {
      messageBus.createChannel('test-channel');

      const message = MessageFactory.createTaskMessage(
        'agent-1',
        'agent-2',
        { task: 'test' }
      );

      await messageBus.send('test-channel', message);
      expect(messageBus.getMessages('test-channel').length).toBe(1);

      messageBus.clearChannel('test-channel');
      expect(messageBus.getMessages('test-channel').length).toBe(0);
    });

    it('should cleanup expired messages', async () => {
      messageBus = new MessageBus({
        enableLogging: false,
        cleanupInterval: 0, // Disable auto cleanup
      });

      messageBus.createChannel('test-channel');

      const message = MessageFactory.createTaskMessage(
        'agent-1',
        'agent-2',
        { task: 'test' },
        { ttl: 1 } // 1ms TTL
      );

      await messageBus.send('test-channel', message);

      // Wait for message to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      messageBus.cleanup();

      const messages = messageBus.getMessages('test-channel');
      expect(messages.length).toBe(0);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', () => {
      messageBus.createChannel('channel-1');
      messageBus.createChannel('channel-2');

      messageBus.shutdown();

      const stats = messageBus.getStats();
      expect(stats.totalChannels).toBe(0);
    });
  });
});

describe('Channel', () => {
  let channel: Channel;

  beforeEach(() => {
    channel = new Channel({
      id: 'test-channel',
      maxSize: 10,
      messageTtl: 1000,
    });
  });

  it('should publish messages', async () => {
    const message = MessageFactory.createTaskMessage(
      'agent-1',
      'agent-2',
      { task: 'test' }
    );

    await channel.publish(message);

    const messages = channel.getMessages();
    expect(messages.length).toBe(1);
  });

  it('should notify subscribers on publish', async () => {
    const handler = vi.fn();
    channel.subscribe(handler);

    const message = MessageFactory.createTaskMessage(
      'agent-1',
      'agent-2',
      { task: 'test' }
    );

    await channel.publish(message);

    expect(handler).toHaveBeenCalledWith(message);
  });

  it('should filter messages by sender', async () => {
    const message1 = MessageFactory.createTaskMessage(
      'agent-1',
      'agent-2',
      { task: 'test1' }
    );

    const message2 = MessageFactory.createTaskMessage(
      'agent-3',
      'agent-2',
      { task: 'test2' }
    );

    await channel.publish(message1);
    await channel.publish(message2);

    const fromAgent1 = channel.getMessagesFrom('agent-1');
    expect(fromAgent1.length).toBe(1);
    expect(fromAgent1[0].from).toBe('agent-1');
  });

  it('should filter messages by recipient', async () => {
    const message1 = MessageFactory.createTaskMessage(
      'agent-1',
      'agent-2',
      { task: 'test1' }
    );

    const message2 = MessageFactory.createTaskMessage(
      'agent-1',
      'agent-3',
      { task: 'test2' }
    );

    await channel.publish(message1);
    await channel.publish(message2);

    const toAgent2 = channel.getMessagesTo('agent-2');
    expect(toAgent2.length).toBe(1);
    expect(toAgent2[0].to).toBe('agent-2');
  });

  it('should clear messages', async () => {
    const message = MessageFactory.createTaskMessage(
      'agent-1',
      'agent-2',
      { task: 'test' }
    );

    await channel.publish(message);
    expect(channel.getMessages().length).toBe(1);

    channel.clear();
    expect(channel.getMessages().length).toBe(0);
  });

  it('should enforce max size', async () => {
    const smallChannel = new Channel({
      id: 'small-channel',
      maxSize: 2,
    });

    for (let i = 0; i < 5; i++) {
      await smallChannel.publish(
        MessageFactory.createTaskMessage('agent-1', 'agent-2', { task: i })
      );
    }

    const messages = smallChannel.getMessages();
    expect(messages.length).toBe(2);
  });

  it('should get channel statistics', async () => {
    const handler = vi.fn();
    channel.subscribe(handler);

    const message = MessageFactory.createTaskMessage(
      'agent-1',
      'agent-2',
      { task: 'test' }
    );

    await channel.publish(message);

    const stats = channel.getStats();
    expect(stats.messagesReceived).toBe(1);
    expect(stats.subscriberCount).toBe(1);
  });
});

describe('ChannelManager', () => {
  let manager: ChannelManager;

  beforeEach(() => {
    manager = new ChannelManager();
  });

  it('should create channels', () => {
    const channel = manager.createChannel({
      id: 'test-channel',
    });

    expect(channel).toBeDefined();
    expect(channel.getId()).toBe('test-channel');
  });

  it('should throw error when creating duplicate channel', () => {
    manager.createChannel({ id: 'test-channel' });

    expect(() => {
      manager.createChannel({ id: 'test-channel' });
    }).toThrow();
  });

  it('should get channel by ID', () => {
    manager.createChannel({ id: 'test-channel' });

    const channel = manager.getChannel('test-channel');
    expect(channel).toBeDefined();
  });

  it('should delete channels', () => {
    manager.createChannel({ id: 'test-channel' });

    const deleted = manager.deleteChannel('test-channel');
    expect(deleted).toBe(true);
    expect(manager.getChannel('test-channel')).toBeUndefined();
  });

  it('should get all channel IDs', () => {
    manager.createChannel({ id: 'channel-1' });
    manager.createChannel({ id: 'channel-2' });

    const ids = manager.getChannelIds();
    expect(ids).toContain('channel-1');
    expect(ids).toContain('channel-2');
  });

  it('should cleanup all channels', async () => {
    const channel1 = manager.createChannel({
      id: 'channel-1',
      messageTtl: 1,
    });

    const channel2 = manager.createChannel({
      id: 'channel-2',
      messageTtl: 1,
    });

    await channel1.publish(
      MessageFactory.createTaskMessage('a', 'b', {}, { ttl: 1 })
    );
    await channel2.publish(
      MessageFactory.createTaskMessage('a', 'b', {}, { ttl: 1 })
    );

    await new Promise(resolve => setTimeout(resolve, 10));

    manager.cleanupAll();

    const stats1 = channel1.getStats();
    const stats2 = channel2.getStats();

    expect(stats1.queueSize).toBe(0);
    expect(stats2.queueSize).toBe(0);
  });

  it('should get statistics for all channels', async () => {
    const channel1 = manager.createChannel({ id: 'channel-1' });
    const channel2 = manager.createChannel({ id: 'channel-2' });

    await channel1.publish(MessageFactory.createTaskMessage('a', 'b', {}));
    await channel2.publish(MessageFactory.createTaskMessage('a', 'b', {}));

    const allStats = manager.getAllStats();

    expect(allStats.size).toBe(2);
    expect(allStats.get('channel-1')?.messagesReceived).toBe(1);
    expect(allStats.get('channel-2')?.messagesReceived).toBe(1);
  });
});

describe('MessageFactory', () => {
  it('should create task message', () => {
    const message = MessageFactory.createTaskMessage(
      'agent-1',
      'agent-2',
      { task: 'test' }
    );

    expect(message.from).toBe('agent-1');
    expect(message.to).toBe('agent-2');
    expect(message.type).toBe('task');
    expect(message.id).toBeDefined();
    expect(message.timestamp).toBeDefined();
  });

  it('should create result message', () => {
    const message = MessageFactory.createResultMessage(
      'agent-1',
      'agent-2',
      { result: 'success' },
      'corr-123'
    );

    expect(message.type).toBe('result');
    expect(message.correlationId).toBe('corr-123');
  });

  it('should create query message', () => {
    const message = MessageFactory.createQueryMessage(
      'agent-1',
      'agent-2',
      { query: 'data' }
    );

    expect(message.type).toBe('query');
  });

  it('should create response message', () => {
    const message = MessageFactory.createResponseMessage(
      'agent-1',
      'agent-2',
      { response: 'data' },
      'corr-123'
    );

    expect(message.type).toBe('response');
    expect(message.correlationId).toBe('corr-123');
  });

  it('should create error message', () => {
    const message = MessageFactory.createErrorMessage(
      'agent-1',
      'agent-2',
      'Something went wrong',
      'corr-123'
    );

    expect(message.type).toBe('error');
    expect(message.payload.error).toBe('Something went wrong');
    expect(message.priority).toBe(MessagePriority.HIGH);
  });

  it('should create heartbeat message', () => {
    const message = MessageFactory.createHeartbeatMessage('agent-1');

    expect(message.type).toBe('heartbeat');
    expect(message.from).toBe('agent-1');
    expect(message.to).toBeUndefined();
  });

  it('should create messages with options', () => {
    const message = MessageFactory.createTaskMessage(
      'agent-1',
      'agent-2',
      { task: 'test' },
      {
        correlationId: 'corr-123',
        priority: MessagePriority.URGENT,
        ttl: 5000,
      }
    );

    expect(message.correlationId).toBe('corr-123');
    expect(message.priority).toBe(MessagePriority.URGENT);
    expect(message.ttl).toBe(5000);
  });

  it('should generate unique message IDs', () => {
    const message1 = MessageFactory.createTaskMessage('a', 'b', {});
    const message2 = MessageFactory.createTaskMessage('a', 'b', {});

    expect(message1.id).not.toBe(message2.id);
  });
});

describe('MessageValidator', () => {
  it('should validate a correct message', () => {
    const message = MessageFactory.createTaskMessage('a', 'b', {});

    const validation = MessageValidator.validate(message);

    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it('should detect missing ID', () => {
    const message = MessageFactory.createTaskMessage('a', 'b', {});
    delete (message as any).id;

    const validation = MessageValidator.validate(message);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Message ID is required');
  });

  it('should detect missing sender', () => {
    const message = MessageFactory.createTaskMessage('a', 'b', {});
    delete (message as any).from;

    const validation = MessageValidator.validate(message);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('sender'))).toBe(true);
  });

  it('should detect missing type', () => {
    const message = MessageFactory.createTaskMessage('a', 'b', {});
    delete (message as any).type;

    const validation = MessageValidator.validate(message);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('type'))).toBe(true);
  });

  it('should detect expired messages', () => {
    const message = MessageFactory.createTaskMessage(
      'a',
      'b',
      {},
      { ttl: 1 }
    );

    // Manually set timestamp to past
    message.timestamp = new Date(Date.now() - 10000);

    const validation = MessageValidator.validate(message);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('expired'))).toBe(true);
  });
});
