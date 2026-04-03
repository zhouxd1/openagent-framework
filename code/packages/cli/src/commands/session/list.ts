import { Command, Flags } from '@oclif/core';
import { SessionManager } from '@openagent/core';
import { PrismaClient } from '@prisma/client';

export default class SessionList extends Command {
  static description = 'List all sessions';

  static examples = [
    '<%= config.bin %> session list',
    '<%= config.bin %> session list --user user123',
    '<%= config.bin %> session list --status active --limit 20',
  ];

  static flags = {
    user: Flags.string({
      char: 'u',
      description: 'Filter by user ID',
    }),
    status: Flags.string({
      char: 's',
      description: 'Filter by status (active, paused, closed)',
      options: ['active', 'paused', 'closed'],
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'Maximum number of sessions to return',
      default: 50,
    }),
    cursor: Flags.string({
      char: 'c',
      description: 'Pagination cursor for next page',
    }),
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SessionList);

    const prisma = new PrismaClient();
    const sessionManager = new SessionManager(prisma);

    try {
      const result = await sessionManager.listPaginated(
        flags.user,
        flags.status,
        {
          limit: flags.limit,
          cursor: flags.cursor,
        }
      );

      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        this.log('Sessions:');
        this.log('');

        if (result.items.length === 0) {
          this.log('  No sessions found');
        } else {
          result.items.forEach((session: any, index: number) => {
            this.log(`${index + 1}. ${session.id}`);
            this.log(`   User: ${session.userId}`);
            this.log(`   Status: ${session.status}`);
            this.log(`   Created: ${session.createdAt.toISOString()}`);
            this.log('');
          });

          if (result.hasMore) {
            this.log(`More sessions available. Use --cursor ${result.nextCursor} to fetch next page.`);
          }
        }

        this.log(`\nTotal shown: ${result.items.length}`);
      }
    } catch (error) {
      this.error(`Failed to list sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await prisma.$disconnect();
    }
  }
}
