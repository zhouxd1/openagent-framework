# @openagent/orchestrator

Agent orchestration framework for OpenAgent. Provides powerful tools for coordinating multiple AI agents, managing workflows, and implementing complex orchestration patterns.

## Features

- ✅ **Multi-agent Collaboration** - Coordinate multiple agents in complex workflows
- ✅ **Workflow Engine (DAG)** - Define and execute directed acyclic graph workflows
- ✅ **Orchestration Patterns** - Chain, Parallel, Router, and Supervisor patterns
- ✅ **Agent Communication** - Message bus and channel-based messaging system
- ✅ **Task Scheduling** - Priority-based task scheduling with concurrency control
- ✅ **Error Recovery** - Retry policies, fallback steps, and graceful degradation
- ✅ **Type Safety** - Full TypeScript support with strict typing

## Installation

```bash
npm install @openagent/orchestrator
```

## Quick Start

### Basic Usage

```typescript
import { AgentOrchestrator } from '@openagent/orchestrator';

// Create orchestrator
const orchestrator = new AgentOrchestrator({
  maxConcurrentAgents: 10,
  timeout: 30000,
  retryPolicy: {
    maxAttempts: 3,
    backoff: 'exponential',
    delay: 1000,
  },
});

// Register agents
orchestrator.registerAgent(analyzerAgent);
orchestrator.registerAgent(summarizerAgent);

// Create and execute workflow
const workflow = orchestrator.createWorkflow({
  name: 'Code Review',
  description: 'Analyze and review code',
  steps: [
    {
      agentId: 'analyzer',
      task: 'Analyze code quality',
    },
    {
      agentId: 'summarizer',
      task: 'Create summary report',
      dependencies: ['step-1'],
    },
  ],
});

// Execute workflow
const result = await orchestrator.executeWorkflow(workflow.id, codeInput);
console.log(result);
```

### Orchestration Patterns

#### Chain Pattern - Sequential Execution

Execute agents sequentially, where each agent's output becomes the next agent's input.

```typescript
import { ChainPattern } from '@openagent/orchestrator';

// Data processing pipeline
const result = await ChainPattern.execute(
  [extractor, transformer, validator, loader],
  rawData,
  context,
  { stopOnFailure: true }
);
```

**Use Cases:**
- Data processing pipelines (ETL)
- Content generation (outline → draft → refine)
- Multi-stage analysis
- Step-by-step transformations

#### Parallel Pattern - Concurrent Execution

Execute multiple agents simultaneously for independent tasks.

```typescript
import { ParallelPattern } from '@openagent/orchestrator';

// Analyze data from multiple sources in parallel
const result = await ParallelPattern.execute(
  [apiAgent1, apiAgent2, apiAgent3],
  'Fetch and analyze data',
  context,
  { maxConcurrency: 3 }
);

// Race mode - first result wins
const fastest = await ParallelPattern.race(
  [fastAgent, backupAgent],
  'Get quick response'
);
```

**Use Cases:**
- Parallel data fetching
- Load balancing
- Redundant execution for reliability
- Consensus/voting mechanisms

#### Router Pattern - Conditional Routing

Route tasks to appropriate agents based on conditions.

```typescript
import { RouterPattern, ContentRouter } from '@openagent/orchestrator';

// Content-based routing
const router = new ContentRouter()
  .addKeywordRouter(['urgent', 'critical'], priorityAgent)
  .addKeywordRouter(['billing', 'payment'], billingAgent)
  .addRegexRouter(/^API:/i, apiAgent)
  .setDefaultAgent(generalAgent);

const result = await router.route('URGENT: System down!');
```

**Use Cases:**
- Task categorization and routing
- Domain-specific agent selection
- Priority-based handling
- Load balancing

#### Supervisor Pattern - Hierarchical Coordination

One supervisor agent coordinates multiple worker agents.

```typescript
import { SupervisorPattern } from '@openagent/orchestrator';

// Complex task decomposition
const result = await SupervisorPattern.execute(
  supervisorAgent,
  [worker1, worker2, worker3],
  'Develop comprehensive market analysis',
  context,
  {
    parallelExecution: true,
    maxSubtasks: 10,
  }
);
```

**Use Cases:**
- Project management and coordination
- Complex multi-domain problems
- Large-scale data processing
- Multi-expert collaboration

### Workflow Definition

Define complex workflows with dependencies, conditions, and error handling.

```typescript
const workflow: Workflow = {
  id: 'data-pipeline',
  name: 'Data Processing Pipeline',
  description: 'Process and analyze incoming data',
  steps: [
    {
      id: 'validate',
      agentId: 'validator',
      task: 'Validate input data',
    },
    {
      id: 'extract',
      agentId: 'extractor',
      task: 'Extract key information',
      dependencies: ['validate'],
    },
    {
      id: 'analyze',
      agentId: 'analyzer',
      task: 'Perform analysis',
      dependencies: ['extract'],
    },
    {
      id: 'report',
      agentId: 'reporter',
      task: 'Generate report',
      dependencies: ['analyze'],
      condition: (ctx) => ctx.results.get('analyze')?.status === 'completed',
    },
  ],
  fallback: {
    id: 'fallback',
    agentId: 'notifier',
    task: 'Notify failure',
  },
};
```

### Agent Communication

Use the message bus for inter-agent communication.

```typescript
import { MessageBus, MessageFactory } from '@openagent/orchestrator';

const messageBus = new MessageBus();

// Create channels
messageBus.createChannel('task-channel');
messageBus.createChannel('result-channel');

// Subscribe to messages
const unsubscribe = messageBus.subscribe('task-channel', async (message) => {
  console.log('Received:', message);
  
  // Process and respond
  const response = MessageFactory.createResponseMessage(
    'agent-1',
    message.from,
    { result: 'processed' },
    message.id
  );
  
  await messageBus.send('result-channel', response);
});

// Send messages
const task = MessageFactory.createTaskMessage(
  'coordinator',
  'agent-1',
  { task: 'Process data' }
);

await messageBus.send('task-channel', task);
```

### Task Scheduling

Schedule tasks with priorities and concurrency control.

```typescript
import { TaskScheduler } from '@openagent/orchestrator';

const scheduler = new TaskScheduler({
  maxConcurrent: 5,
  taskTimeout: 60000,
  enableRetries: true,
  maxRetries: 3,
});

// Set executor
scheduler.setExecutor(async (task) => {
  const agent = getAgent(task.agentId);
  return await agent.execute(task.description);
});

// Schedule tasks
const task1 = scheduler.scheduleTask(
  'High priority task',
  'agent-1',
  { priority: 10 }
);

const task2 = scheduler.scheduleTask(
  'Low priority task',
  'agent-2',
  { priority: 1 }
);

// Start scheduler
scheduler.start();
```

## Architecture

```
orchestrator/
├── src/
│   ├── orchestrator.ts         # Main orchestrator class
│   ├── workflow-engine.ts      # Workflow management
│   ├── agent-coordinator.ts    # Agent coordination
│   ├── task-scheduler.ts       # Task scheduling
│   ├── patterns/               # Orchestration patterns
│   │   ├── chain.ts           # Sequential execution
│   │   ├── parallel.ts        # Concurrent execution
│   │   ├── router.ts          # Conditional routing
│   │   └── supervisor.ts      # Hierarchical coordination
│   ├── communication/          # Agent messaging
│   │   ├── message-bus.ts     # Central message bus
│   │   ├── channel.ts         # Communication channels
│   │   └── protocol.ts        # Message protocols
│   ├── workflow/               # Workflow components
│   │   ├── workflow.ts        # Workflow builder
│   │   ├── step.ts            # Step execution
│   │   └── context.ts         # Execution context
│   ├── types.ts               # Type definitions
│   └── index.ts               # Public API
└── tests/                     # Test suites
```

## API Documentation

### AgentOrchestrator

Main class for orchestrating agent workflows.

```typescript
const orchestrator = new AgentOrchestrator(config);

// Agent management
orchestrator.registerAgent(agent);
orchestrator.unregisterAgent(agentId);
orchestrator.getAgent(agentId);

// Workflow management
orchestrator.registerWorkflow(workflow);
orchestrator.createWorkflow(definition);
orchestrator.getWorkflow(workflowId);

// Execution
await orchestrator.executeWorkflow(workflowId, input, context);
await orchestrator.executeParallel(agentIds, task, context);

// Statistics
const stats = orchestrator.getStats();
```

### WorkflowEngine

Manages workflow lifecycle and validation.

```typescript
const engine = new WorkflowEngine();

engine.createWorkflow(definition);
engine.validateWorkflow(workflow);
engine.getParallelSteps(workflow);
```

### MessageBus

Centralized message passing system.

```typescript
const bus = new MessageBus();

bus.createChannel(channelId);
await bus.send(channelId, message);
bus.subscribe(channelId, handler);
await bus.broadcast(message);
```

## Best Practices

1. **Workflow Design**
   - Keep workflows focused on a single objective
   - Use dependencies to ensure correct execution order
   - Implement fallback steps for error recovery
   - Validate workflows before registration

2. **Agent Implementation**
   - Agents should be idempotent when possible
   - Handle errors gracefully and return meaningful messages
   - Use metadata to pass additional context
   - Implement timeouts for long-running operations

3. **Pattern Selection**
   - **Chain**: Use for sequential transformations
   - **Parallel**: Use for independent tasks or redundancy
   - **Router**: Use for task categorization and routing
   - **Supervisor**: Use for complex decomposition and coordination

4. **Error Handling**
   - Set appropriate retry policies
   - Implement fallback workflows
   - Log errors for debugging
   - Monitor execution statistics

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT

## Documentation

For full documentation, see [docs/orchestrator.md](../../docs/orchestrator.md).
