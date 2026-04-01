
[96m━━━ Setup ━━━[0m
[31m[ERROR][0m Eval failed
3084 |       ...description != null && { description }
3085 |     })),
3086 |     async parseCompleteOutput({ text: text2 }, context2) {
3087 |       const parseResult = await safeParseJSON2({ text: text2 });
3088 |       if (!parseResult.success) {
3089 |         throw new NoObjectGeneratedError({
                         ^
AI_NoObjectGeneratedError: No object generated: could not parse the response.
       text: "{\n  \"neurons\": [\n    {\n      \"id\": \"query-understanding\",\n      \"name\": \"Query Understanding\",\n      \"description\": \"Understands the types of queries the user is likely to ask.\",\n      \"instructions\": \"Understand the user's typical types of queries, including the scope, intent, and level of detail they seek.\\n\\nWatch for:\\n- The specific wording and phrasing used in the queries.\\n- The entities and concepts that are frequently mentioned.\\n- The context or background information provided within the queries.\\n\\nTrack answers to:\\n- What types of questions does the user frequently ask?\\n- What level of detail does the user expect in the responses?\\n- What are the key topics and entities mentioned in the user's queries?\",\n      \"type\": \"text\",\n      \"maintenance\": {\n        \"strategy\": \"continuous\"\n      }\n    },\n    {\n      \"id",
   response: {
  id: "gen-1770221707-rZ0VQ9dR7QXnvsyk9f0A",
  timestamp: 2026-02-04T16:15:11.212Z,
  modelId: "google/gemini-2.0-flash-001",
  headers: [Object ...],
  body: undefined,
  messages: [
    [Object ...]
  ],
},
      usage: {
  inputTokens: 1332,
  inputTokenDetails: [Object ...],
  outputTokens: 204,
  outputTokenDetails: [Object ...],
  totalTokens: 1536,
  raw: [Object ...],
  reasoningTokens: 0,
  cachedInputTokens: 0,
},
 finishReason: "stop",
 vercel.ai.error: true,
 vercel.ai.error.AI_NoObjectGeneratedError: true,

      at parseCompleteOutput (/Users/amir/projects/unbody/brain-v0/node_modules/ai/dist/index.mjs:3089:19)
      at /Users/amir/projects/unbody/brain-v0/node_modules/ai/dist/index.mjs:5000:21
      at /Users/amir/projects/unbody/brain-v0/node_modules/ai/dist/index.mjs:2566:30

2087 |     }
2088 |     return await safeValidateTypes({ value, schema });
2089 |   } catch (error) {
2090 |     return {
2091 |       success: false,
2092 |       error: JSONParseError.isInstance(error) ? error : new JSONParseError({ text, cause: error }),
                                                               ^
AI_JSONParseError: JSON parsing failed: Text: {
  "neurons": [
    {
      "id": "query-understanding",
      "name": "Query Understanding",
      "description": "Understands the types of queries the user is likely to ask.",
      "instructions": "Understand the user's typical types of queries, including the scope, intent, and level of detail they seek.\n\nWatch for:\n- The specific wording and phrasing used in the queries.\n- The entities and concepts that are frequently mentioned.\n- The context or background information provided within the queries.\n\nTrack answers to:\n- What types of questions does the user frequently ask?\n- What level of detail does the user expect in the responses?\n- What are the key topics and entities mentioned in the user's queries?",
      "type": "text",
      "maintenance": {
        "strategy": "continuous"
      }
    },
    {
      "id.
Error message: JSON Parse error: Unterminated string
      cause: SyntaxError: JSON Parse error: Unterminated string
,
       text: "{\n  \"neurons\": [\n    {\n      \"id\": \"query-understanding\",\n      \"name\": \"Query Understanding\",\n      \"description\": \"Understands the types of queries the user is likely to ask.\",\n      \"instructions\": \"Understand the user's typical types of queries, including the scope, intent, and level of detail they seek.\\n\\nWatch for:\\n- The specific wording and phrasing used in the queries.\\n- The entities and concepts that are frequently mentioned.\\n- The context or background information provided within the queries.\\n\\nTrack answers to:\\n- What types of questions does the user frequently ask?\\n- What level of detail does the user expect in the responses?\\n- What are the key topics and entities mentioned in the user's queries?\",\n      \"type\": \"text\",\n      \"maintenance\": {\n        \"strategy\": \"continuous\"\n      }\n    },\n    {\n      \"id",
 vercel.ai.error: true,
 vercel.ai.error.AI_JSONParseError: true,

      at safeParseJSON (/Users/amir/projects/unbody/brain-v0/node_modules/@ai-sdk/provider-utils/dist/index.mjs:2092:57)
      at safeParseJSON (/Users/amir/projects/unbody/brain-v0/node_modules/@ai-sdk/provider-utils/dist/index.mjs:2079:29)
      at parseCompleteOutput (/Users/amir/projects/unbody/brain-v0/node_modules/ai/dist/index.mjs:3087:33)
      at parseCompleteOutput (/Users/amir/projects/unbody/brain-v0/node_modules/ai/dist/index.mjs:3086:33)
      at <anonymous> (/Users/amir/projects/unbody/brain-v0/node_modules/ai/dist/index.mjs:4244:54)
      at async <anonymous> (/Users/amir/projects/unbody/brain-v0/node_modules/ai/dist/index.mjs:2124:38)

SyntaxError: JSON Parse error: Unterminated string

Exit code: 1
