# @openagent/observability Examples

This directory contains example code demonstrating how to use the observability package.

## Running the Examples

### Prerequisites

Make sure you have TypeScript and Node.js installed.

```bash
npm install typescript ts-node --save-dev
```

### Complete Setup Example

```bash
npx ts-node examples/complete-setup.ts
```

This will run through all examples and demonstrate:
- Quick setup with `createObservability`
- Manual configuration of each component
- Production configuration
- Dashboard and alert generation
- Error handling and retry logic
- Context propagation

### Express.js Integration Example

```bash
npx ts-node examples/express-integration.ts
```

Start an Express server with full observability middleware:

```bash
# Start server
npx ts-node examples/express-integration.ts

# In another terminal, test the endpoints
curl http://localhost:3000/health
curl http://localhost:3000/metrics
curl http://localhost:3000/api/users
```

### Background Job Processing Example

```bash
npx ts-node examples/background-job.ts
```

This demonstrates:
- Job queue with tracing
- Job processing metrics
- Retry with exponential backoff
- Priority-based processing
- Scheduled jobs

## Notes

### Express Integration

The Express example requires the `express` package:

```bash
npm install express --save-dev
```

### Running Tests

```bash
npm test
npm run test:coverage
```

## Examples Overview

### complete-setup.ts

Demonstrates the complete observability stack configuration including:
- Quick setup with `createObservability()`
- Manual configuration of each component
- Production-ready setup with Jaeger exporter
- Dashboard and alert generation
- Error handling and retry logic
- Context propagation

### express-integration.ts

Shows how to integrate observability into Express.js applications:
- Request tracing middleware
- Response time metrics
- Error tracking
- Health check and metrics endpoints

### background-job.ts

Demonstrates background job processing with observability:
- Job queue implementation
- Tracing for each job
- Metrics for job processing
- Retry logic with exponential backoff
- Different job types

## License

MIT
