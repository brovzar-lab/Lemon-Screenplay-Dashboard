# Google Generative AI SDK Migration Task

## Priority: CRITICAL
## Status: Not Started
## Estimated Time: 2-3 hours
## Complexity: High

---

## Problem Statement

The Screen Partner application is using **`@google/genai`** which is NOT the official Google SDK and returns 404 errors for all model requests. The correct package is **`@google/generative-ai`**.

### Current Broken State
- Package: `@google/genai@1.38.0` ❌
- Error: All AI requests fail with 404 "model not found for API version v1beta"
- Impact: ALL AI features broken (Brain Dump, Story Grid, Synopsis, etc.)

### Target Working State
- Package: `@google/generative-ai@latest` ✅
- Working API calls using official Google SDK
- All AI features functional

---

## Files Affected (4 services)

1. `services/geminiService.ts` (~3200 lines)
2. `services/storyGridAI.ts` (~600 lines)
3. `services/storyGridService.ts`
4. `services/devCompanionService.ts`

---

## Migration Steps

### Phase 1: Package Migration

**Step 1.1: Install Correct SDK**
```bash
npm uninstall @google/genai
npm install @google/generative-ai@latest
```

**Step 1.2: Update package.json**
Verify `package.json` shows:
```json
"@google/generative-ai": "^0.24.1"  // or latest
```

---

### Phase 2: Import Updates

**Step 2.1: Update Import Statements**

**OLD (broken):**
```typescript
import { GoogleGenAI, Type, Schema } from "@google/genai";
const ai = new GoogleGenAI({ apiKey });
```

**NEW (correct):**
```typescript
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(apiKey);
```

**Key Changes:**
- `GoogleGenAI` → `GoogleGenerativeAI`
- `Type` → `SchemaType`
- `Schema` interface changes (properties differ)
- Constructor changes: `new GoogleGenAI({ apiKey })` → `new GoogleGenerativeAI(apiKey)`

---

### Phase 3: API Call Pattern Updates

**Step 3.1: Model Instantiation Pattern**

**OLD Pattern:**
```typescript
const response = await ai.models.generateContent({
  model: 'gemini-1.5-flash',
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: schema
  }
});
const text = response.text;
```

**NEW Pattern:**
```typescript
const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash',
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: responseSchema
  }
});
const result = await model.generateContent(prompt);
const response = await result.response;
const text = response.text();  // Note: text is now a function
```

**Key API Differences:**
1. Get model instance first: `genAI.getGenerativeModel()`
2. `config` → `generationConfig`
3. `contents` passed to `generateContent()` not `getGenerativeModel()`
4. `response.text` → `response.text()` (method, not property)
5. Response is nested: `result.response.text()`

---

### Phase 4: Schema Definition Updates

**Step 4.1: Update Schema Syntax**

**OLD Schema:**
```typescript
const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    genre: { type: Type.STRING }
  },
  required: ['title', 'genre']
};
```

**NEW Schema:**
```typescript
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    genre: { type: SchemaType.STRING }
  },
  required: ['title', 'genre']
};
```

**Changes:**
- `Schema` type → plain object
- `Type.OBJECT` → `SchemaType.OBJECT`
- `Type.STRING` → `SchemaType.STRING`
- `Type.ARRAY` → `SchemaType.ARRAY`
- `Type.NUMBER` → `SchemaType.NUMBER`

---

### Phase 5: Service-Specific Migration

**Step 5.1: geminiService.ts (~35 functions to update)**

Critical functions (update these first):
1. ✅ `generateFullConcept()` - Brain Dump analysis
2. ✅ `analyzeExistingScreenplay()` - Script upload
3. ✅ `transcribeAudio()` - Voice recording
4. ✅ `generateBoxOfficeAnalysis()` - Greenlight
5. ✅ `generateSynopsis()` - Synopsis generation

**Step 5.2: storyGridAI.ts (~7 functions to update)**
1. ✅ `analyzeGenre()`
2. ✅ `suggestObligatoryScenes()`
3. ✅ `analyzeFiveCommandments()`
4. ✅ `suggestValueProgression()`
5. ✅ `analyzeBeatValueCharges()`
6. ✅ `suggestGlobalStructure()`

**Step 5.3: Other Services**
- Update `storyGridService.ts`
- Update `devCompanionService.ts`

---

## Testing Checklist

After migration, test EVERY AI feature:

### Stage 1 Tests
- [ ] Brain Dump → Generate Concept (Text mode)
- [ ] Upload Script → Extract concept
- [ ] Voice Recording → Transcribe & analyze
- [ ] Story Grid AI Analysis

### Stage 2 Tests
- [ ] Greenlight Analysis (Box office + reviews)
- [ ] Character generation
- [ ] Synopsis generation
- [ ] Theme analysis
- [ ] Beat generation

### Stage 3 Tests
- [ ] Scene drafting
- [ ] Dialogue generation
- [ ] Format passes

---

## Rollback Plan

If migration fails:

```bash
# Revert to old (broken) package
git checkout services/geminiService.ts services/storyGridAI.ts
npm uninstall @google/generative-ai
npm install @google/genai@1.38.0

# Note: This keeps the app broken but in a known state
```

---

## Implementation Strategy

### Recommended Approach: Incremental Migration

**Option A: Function-by-Function** (Safest)
1. Start with `generateFullConcept()` only
2. Test thoroughly
3. Migrate next function
4. Repeat

**Option B: File-by-File** (Faster)
1. Complete `geminiService.ts` first
2. Test all Stage 1 features
3. Complete `storyGridAI.ts`
4. Test Story Grid features
5. Complete remaining services

**Option C: All-at-Once** (Riskiest, fastest)
1. Update all imports
2. Global search/replace for API patterns
3. Fix compilation errors
4. Test everything

---

## Code Snippets for Quick Reference

### Complete Example: Before & After

**BEFORE (Broken @google/genai):**
```typescript
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING }
  }
};

const response = await ai.models.generateContent({
  model: 'gemini-1.5-flash',
  contents: 'Hello',
  config: {
    responseMimeType: "application/json",
    responseSchema: schema
  }
});

const text = response.text;
```

**AFTER (Working @google/generative-ai):**
```typescript
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING }
  },
  required: ['title']
};

const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash',
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema
  }
});

const result = await model.generateContent('Hello');
const response = await result.response;
const text = response.text();  // Now a function
```

---

## Model Fallback Compatibility

The existing `withModelFallback()` wrapper is COMPATIBLE with new SDK:

```typescript
// This pattern still works!
return withModelFallback(async (modelName) => {
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return parseJsonResponse(response.text(), fallback, context);
}, 'functionName');
```

---

## Additional Resources

- Official Docs: https://ai.google.dev/gemini-api/docs/get-started/node
- NPM Package: https://www.npmjs.com/package/@google/generative-ai
- Migration Guide: https://ai.google.dev/gemini-api/docs/migrate-to-gemini-api

---

## Acceptance Criteria

Migration is complete when:

✅ All 4 service files compile without errors  
✅ Dev server starts successfully  
✅ Brain Dump generates concept successfully  
✅ Story Grid analysis works  
✅ Greenlight analysis works  
✅ Synopsis generation works  
✅ All AI features tested and working  
✅ No console errors related to AI API calls  

---

## Notes

- **DO NOT** try to fix `@google/genai` - it's fundamentally broken
- The package name difference is NOT a typo - they are different SDKs
- `@google/genai` appears to be unofficial/deprecated
- `@google/generative-ai` is the official Google SDK
- API key format is the same - no changes needed there
- Environment variables (`.env.local`) stay the same

---

## Estimated Breakdown

- **Phase 1-2** (Package & Imports): 15 minutes
- **Phase 3-4** (API Patterns & Schemas): 30 minutes  
- **Phase 5** (Service Migration): 60-90 minutes
- **Testing**: 30 minutes
- **Fixes & Debugging**: 30 minutes

**Total**: 2-3 hours for careful, tested migration

---

## Status Log

| Date | Developer | Status | Notes |
|------|-----------|--------|-------|
| 2026-01-27 | - | Created | Task file created, migration not started |
|  |  |  |  |

---

## Questions to Resolve

1. Should we migrate all at once or incrementally?
2. Do we keep the model fallback system (experimental → stable)?
3. Any AI features we can temporarily disable to reduce migration scope?

---

**Ready to start?** Begin with Phase 1 and work through systematically. Test after each phase!
