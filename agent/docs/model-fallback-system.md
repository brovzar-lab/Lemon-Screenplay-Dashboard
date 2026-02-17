# Intelligent Model Fallback System

## Overview
Implemented automatic fallback from experimental to stable Gemini models to maximize performance while ensuring reliability.

## How It Works

### Strategy
1. **Try Experimental Model First** (`gemini-2.0-flash-exp`)
   - Cutting-edge performance
   - Latest capabilities
   - May occasionally be unavailable

2. **Silent Fallback to Stable** (`gemini-1.5-flash`)
   - Activates only when experimental model fails with:
     - `MODEL_UNAVAILABLE` error
     - `RATE_LIMIT` error
   - User sees no error message
   - Seamless experience

3. **Report Only If Both Fail**
   - If stable model also fails, show error to user
   - Preserves useful error messages (API key, network, etc.)

## Implementation

### Services Updated
- ✅ `geminiService.ts` - Core AI service (33 functions)
- ✅ `storyGridAI.ts` - Story Grid analysis

### Key Functions with Fallback
1. **`generateFullConcept`** - Brain Dump → Concept generation
2. **`analyzeGenre`** - Story Grid genre analysis

### Code Pattern
```typescript
// Fallback wrapper
async function withModelFallback<T>(
  operation: (model: string) => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation(EXPERIMENTAL_MODEL);
  } catch (error) {
    if (shouldFallback) {
      console.warn(`Falling back to stable model`);
      return await operation(STABLE_MODEL);
    }
    throw error;
  }
}

// Usage
return withModelFallback(async (model) => {
  const response = await ai.models.generateContent({ model, ... });
  return parseResponse(response);
}, 'operationName');
```

## Benefits

### User Experience
- ✅ **No "temporarily unavailable" errors** for experimental model issues
- ✅ **Faster responses** when experimental model is available
- ✅ **Reliable fallback** when it's not
- ✅ **Single click** - no retry needed

### Developer Experience
- ✅ **Console warnings** for monitoring fallback usage
- ✅ **Automatic recovery** from transient failures
- ✅ **Easy to extend** to other functions

## Monitoring

Check browser console for fallback warnings:
```
[GeminiService] generateFullConcept: Experimental model unavailable, falling back to stable model
```

This helps identify when experimental model is having issues without impacting users.

## Performance Characteristics

| Scenario | Model Used | User Impact |
|----------|------------|-------------|
| Experimental available | `gemini-2.0-flash-exp` | Best performance |
| Experimental busy/unavailable | `gemini-1.5-flash` | Slightly slower, still fast |
| Both fail | Error shown | User sees helpful error message |

## Version
Implemented in v2.13.0 (Jan 27, 2026)
