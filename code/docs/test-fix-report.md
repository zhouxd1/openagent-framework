# OpenAgent Framework Test Fix Report

## Summary

Fixed major test failures across multiple packages in the OpenAgent Framework. The main issues were:

1. **Policy Engine** - Cache key not including context (time/IP), causing incorrect cache hits
2. **Audit Logger** - Buffer not flushed before query, causing data to be invisible
3. **Shell Tool** - Security validation throwing exceptions instead of returning error results
4. **File Tool** - Path traversal throwing exceptions instead of returning error results  
5. **JSON Tool** - Not unwrapping single-element arrays, and not validating JSONPath syntax
6. **LLM Providers** - Mock configuration issues and `instanceof` checks failing in tests

## Detailed Fixes

### 1. Policy Engine (`packages/permission/src/policy-engine.ts`)

**Problem**: The cache key didn't include context values (time, IP, attributes), causing incorrect cache hits when evaluating permissions with time-based conditions.

**Fix**: Updated `getCacheKey()` to include context values:
```typescript
private getCacheKey(
  permissions: Permission[],
  resource: string,
  action: string,
  context: EvaluationContext
): string {
  const permIds = permissions.map(p => p.id).sort().join(',');
  const userId = context.user.id;
  // Include context values that affect evaluation
  const timeKey = context.currentTime ? context.currentTime.getTime() : '';
  const ipKey = context.ip || '';
  const attrsKey = context.user.attributes 
    ? JSON.stringify(Object.entries(context.user.attributes).sort()) 
    : '';
  
  return `${userId}:${permIds}:${resource}:${action}:${timeKey}:${ipKey}:${attrsKey}`;
}
```

### 2. Audit Logger (`packages/permission/src/audit-logger.ts`)

**Problem**: The `log()` method added entries to a buffer that was only flushed when full or on interval. Tests called `log()` then immediately `query()`, but data was still in buffer.

**Fix**: Modified `query()` to flush buffer before returning results:
```typescript
async query(filter: AuditLogFilter): Promise<AuditLog[]> {
  // Flush buffer before querying to ensure all logs are visible
  await this.flush();
  
  let results = [...this.logs];
  // ... apply filters
}
```

### 3. Shell Tool (`packages/tools/src/builtin/shell-tool.ts`)

**Problem**: Security validation threw `OpenAgentError` for blacklisted patterns instead of returning error results.

**Fix**: Changed `validateCommand()` to return error message string, and handler returns error result:
```typescript
function validateCommand(command: string): string | null {
  for (const { pattern, name } of BLACKLISTED_PATTERNS) {
    if (pattern.test(command)) {
      return `Command contains blacklisted pattern: ${name}`;
    }
  }
  return null;
}

// In handler:
const securityError = validateCommand(command);
if (securityError) {
  return {
    success: false,
    error: securityError,
    metadata: { command: command.substring(0, 100), duration },
  };
}
```

Also added `reject: false` to execa options to handle non-zero exit codes gracefully.

### 4. File Tool (`packages/tools/src/builtin/file-tool.ts`)

**Problem**: Path traversal validation threw `OpenAgentError` instead of returning error results.

**Fix**: Similar pattern - validation returns error message, handler returns error result:
```typescript
function validateFilePath(filePath: string): string | null {
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.includes('..')) {
    return 'Directory traversal detected in file path';
  }
  // ... other checks
  return null;
}
```

### 5. JSON Tool (`packages/tools/src/builtin/json-tool.ts`)

**Problem**: 
1. Single value extraction returned array `['Alice']` instead of unwrapped value `'Alice'`
2. Invalid JSONPath expressions didn't fail properly

**Fix**:
1. Unwrap single-element arrays for cleaner API:
```typescript
const finalData = Array.isArray(results) && results.length === 1
  ? results[0]
  : results;
```

2. Added JSONPath syntax validation:
```typescript
function isValidJSONPath(path: string): boolean {
  if (!path.startsWith('$')) return false;
  if (path.match(/[^.]\.\.[^.]/) || path.match(/\.\.\.\./)) return false;
  // Check balanced brackets
  let bracketCount = 0;
  for (const char of path) {
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
    if (bracketCount < 0) return false;
  }
  return bracketCount === 0;
}
```

### 6. LLM Providers (`packages/llm-claude`, `packages/llm-openai`, `packages/llm-deepseek`)

**Problems**:
1. Mock SDK not properly configured - tests couldn't access mock functions
2. `instanceof` checks failing because mock didn't include error classes

**Fixes**:

1. **Claude Provider** - Check if `APIError` exists before using `instanceof`:
```typescript
private isRetryableError(error: any): boolean {
  if (Anthropic.APIError && error instanceof Anthropic.APIError) {
    return error.status === 429 || (error.status >= 500);
  }
  return false;
}
```

2. **Test Mocks** - Define mock functions at module scope for accessibility:
```typescript
const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: mockCreate,
      stream: mockStream,
    };
  },
}));
```

### 7. Removed Old Compiled Files

**Problem**: Old `.js` and `.d.ts` files in `src/builtin/` directory were being used instead of TypeScript source files by vitest.

**Fix**: Deleted all `.js` and `.d.ts` files from `src/builtin/` directory to ensure vitest uses TypeScript source files directly.

## Test Results After Fixes

| Package | Before | After |
|---------|--------|-------|
| llm-claude | 14 failed | 6 failed |
| llm-openai | 13 failed | 5 failed |
| llm-deepseek | 8 failed | 3 failed |
| permission | 20 failed | 0 failed ✅ |
| tools | 13 failed | 6 failed |

**Overall**: 68 failed → 20 failed (70% reduction)

## Remaining Issues

1. **Shell Tool**: 
   - Timeout test fails (command times out but error message doesn't match)
   - Environment variable test fails (Windows echo doesn't expand $VAR)

2. **LLM Tests**:
   - Some tests need mock methods for `isAvailable()` and `getModels()`
   - Stream tests need proper mock implementation

3. **JSON Tool**:
   - `nonexistent` JSONPath pattern not caught by validation

## Recommendations

1. **Platform-specific tests**: Skip or adjust tests for Windows environment variable expansion
2. **Mock improvements**: Add `isAvailable()` and `getModels()` to provider mocks
3. **JSONPath validation**: Consider using a library for JSONPath validation instead of custom regex
4. **Documentation**: Add testing guide with mock patterns for external dependencies
