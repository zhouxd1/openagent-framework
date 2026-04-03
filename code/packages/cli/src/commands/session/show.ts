import { Command, Args, Flags } from '@oclif/core';
import { SessionManager } from '@openagent/core';
import { PrismaClient } from '@prisma/client';

export default class SessionShow extends Command {
  static description = 'Show details of a specific session';

  static examples = [
    '<%= config.bin %> session show abc123',
    '<%= config.bin %> session show abc123 --messages',
    '<%= config.bin %> session show abc123 --messages --limit 10',
  ];

  static args = {
    id: Args.string({
      description: 'Session ID',
      required: true,
    }),
  };

  static flags = {
    messages: Flags.boolean({
      char: 'm',
      description: 'Include messages',
      default: false,
    }),
    'message-limit': Flags.integer({
      description: 'Maximum number of messages to show',
      default: 50,
    }),
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SessionShow);

    const prisma = new PrismaClient();
    const sessionManager = new SessionManager(prisma);

    try {
      const session = await sessionManager.get(args.id);

      if (!session) {
        this.error(`Session not found: ${args.id}`);
      }

      let messages = undefined;
      if (flags.messages) {
        messages = await sessionManager.getMessages(args.id, flags['message-limit']);
      }

      if (flags.json) {
        this.log(JSON.stringify({ session, messages }, null, 2));
      } else {
        this.log('Session Details:');
        this.log('');
        this.log(`ID: ${session.id}`);
        this.log(`User ID: ${session.userId}`);
        this.log(`Status: ${session.status}`);
        this.log(`Created: ${session.createdAt.toISOString()}`);
        this.log(`Updated: ${session.updatedAt.toISOString()}`);
        
        if (session.metadata && Object.keys(session.metadata).length > 0) {
          this.log(`Metadata: ${JSON.stringify(session.metadata, null, 2)}`);
        }

        if (messages && messages.length > 0) {
          this.log('');
          this.log(`Messages (${messages.length}):`);
          this.log('');
          messages.forEach((msg, index) => {
            this.log(`${index + 1}. [${msg.role}] ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
            if (msg.tokens) {
              this.log(`   Tokens: ${msg.tokens}`);
            }
          });
        }
      }
    } catch (error) {
      this.error(`Failed to show session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await prisma.$disconnect();
    }
  }
}
