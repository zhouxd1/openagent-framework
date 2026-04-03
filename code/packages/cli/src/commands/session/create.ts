import { Command, Flags } from '@oclif/core';
import { SessionManager } from '@openagent/core';
import { PrismaClient } from '@prisma/client';

export default class SessionCreate extends Command {
  static description = 'Create a new session';

  static examples = [
    '<%= config.bin %> session create --user user123',
    '<%= config.bin %> session create --user user123 --metadata \'{"topic":"support"}\'',
  ];

  static flags = {
    user: Flags.string({
      char: 'u',
      description: 'User ID for the session',
      required: true,
    }),
    metadata: Flags.string({
      char: 'm',
      description: 'JSON metadata for the session',
    }),
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SessionCreate);

    const prisma = new PrismaClient();
    const sessionManager = new SessionManager(prisma);

    try {
      let metadata = {};
      if (flags.metadata) {
        try {
          metadata = JSON.parse(flags.metadata);
        } catch {
          this.error('Invalid JSON in metadata');
        }
      }

      const session = await sessionManager.create({
        userId: flags.user,
        metadata,
      });

      if (flags.json) {
        this.log(JSON.stringify(session, null, 2));
      } else {
        this.log('Session created successfully!');
        this.log('');
        this.log(`ID: ${session.id}`);
        this.log(`User ID: ${session.userId}`);
        this.log(`Status: ${session.status}`);
        this.log(`Created: ${session.createdAt.toISOString()}`);
      }
    } catch (error) {
      this.error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await prisma.$disconnect();
    }
  }
}
