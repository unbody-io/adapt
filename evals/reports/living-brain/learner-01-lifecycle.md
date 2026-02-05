
[96m━━━ Setup ━━━[0m
[37mLearner Config:[0m
{
  "name": "Test Learner",
  "description": "A learner for testing lifecycle",
  "instructions": "You are responsible for tracking information about TypeScript best practices and design patterns.",
  "thresholds": {
    "minImportance": 0.6,
    "maxObservations": 10
  }
}

[96m━━━ Before State ━━━[0m
[37mLearners:[0m
{
  "count": 0,
  "learners": []
}

[96m━━━ Action: Create Learner ━━━[0m
[32m[EVENT][0m learner:init:started [33m{
  "learnerId": "learner_Sev4f3WHCW9Zyi0_t_Hn4"
}[0m
[32m[EVENT][0m learner:init:completed [33m{
  "learnerId": "learner_Sev4f3WHCW9Zyi0_t_Hn4",
  "systemPrompt": "You are a TypeScript best practices and design patterns observer. You watch for signals about recommended approaches to common problems, anti-patterns that should be avoided, evolving TypeScript language features used to improve code, specific library usage that promotes better patterns (e.g., zod for validation), and discussions around architectural choices like monorepo vs multi-repo.\n\n## Relevance\n\nData is relevant when it directly relates to your focus areas. Dismiss data that doesn't connect to what you're tracking.\n\n## Importance\n\nRate how significant each observation is for your purpose:\n- **Low (0.0-0.3)**: Minor detail, weak signal\n- **Medium (0.4-0.6)**: Clear signal, useful data point\n- **High (0.7-1.0)**: Strong signal, explicit statement, notable pattern\n\n## Observation Guidelines\n\n**Be literal**: Quote or closely paraphrase what the source actually says.\n- Source says \"anxiety is not weakness\" → write: States 'anxiety is not weakness'\n- Source mentions PhD from Berkeley → write: PhD in Clinical Psychology from UC Berkeley\n\n**Be exhaustive**: Extract every relevant fact from the data. If the source mentions 4 things, capture all 4.\n\n**Be direct**: One fact per line, no commentary.\n\n## Your Approach\n\nScan the data systematically. For each piece of information, ask:\n1. Is this relevant to what I'm tracking?\n2. What exactly does the source say?\n\nExtract all relevant facts. Miss nothing.\n\n## CRITICAL: Response Format\n\nYou MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.\nALL fields are required.\n\nIf relevant content found:\n{\n  \"status\": \"observed\",\n  \"output\": \"Your observations as plain text, one per line, separated by newlines\",\n  \"importance\": 0.0 to 1.0\n}\n\nIf nothing relevant:\n{\n  \"status\": \"dismissed\",\n  \"output\": \"\",\n  \"importance\": 0.5\n}",
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0,
    "totalTokens": 0
  }
}[0m
[32m[EVENT][0m brain:learner:added [33m{
  "name": "Test Learner",
  "instructions": "You are responsible for tracking information about TypeScript best practices and design patterns."
}[0m

[96m━━━ After State ━━━[0m
[37mLearner Created:[0m
{
  "learner": {
    "id": "learner_Sev4f3WHCW9Zyi0_t_Hn4",
    "name": "Test Learner",
    "description": "A learner for testing lifecycle",
    "instructions": "You are responsible for tracking information about TypeScript best practices and design patterns.",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.6
    },
    "governance": {
      "activation": 0,
      "status": "dormant"
    }
  }
}

[96m━━━ Assertions ━━━[0m
[32m✓[0m [PASS] Learner ID is defined
[32m✓[0m [PASS] Learner name matches config
[32m✓[0m [PASS] Learner description matches config
[32m✓[0m [PASS] Learner instructions match config
[32m✓[0m [PASS] minImportance threshold matches
[32m✓[0m [PASS] maxObservations threshold matches
[32m✓[0m [PASS] Activation starts at 0 (dormant)
[32m✓[0m [PASS] Status is dormant
[32m✓[0m [PASS] Event learner:init:started emitted with matching payload
[32m✓[0m [PASS] Event learner:init:completed emitted with matching payload
[32m✓[0m [PASS] Event brain:learner:added emitted with matching payload
[32m[SUCCESS][0m All assertions passed!
