import {Command, Flags} from '@oclif/core'

export default class Hello extends Command {
  static description = 'Say hello to OpenAgent Framework'

  static examples = [
    '<%= config.bin %> hello',
    '<%= config.bin %> hello --name John',
  ]

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'Name to greet',
      default: 'World',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Hello)

    this.log(`🎉 Hello ${flags.name}! Welcome to OpenAgent Framework.`)
    this.log('')
    this.log('You are now ready to build amazing AI-powered applications!')
    this.log('')
    this.log('Quick start:')
    this.log('  $ openagent --help     Show available commands')
    this.log('  $ openagent chat       Start an interactive session')
    this.log('  $ openagent tool list  List available tools')
  }
}
