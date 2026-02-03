# Unbody Brain v0

[Briefing - generated

Unbody Brain v0 — Executive Brief](https://www.notion.so/Briefing-generated-Unbody-Brain-v0-Executive-Brief-2c20b5596dd88077b836d6bc1e951a67?pvs=21)

# Brainstorming

- vector DB ({id, vector}[])
- graph DB ({id, graph})
- postgres DB ({id, rawdata})

```tsx

const kb = Unbody.createKnoweldgebase(
"these are all my data from balbalabala...",
 dbs: {
	 vector: ...,
	 graph: ...,
	 postgress: ...
 }
);
```

// new data incoming

```tsx
const records = Array<unknown>
kb.inject(newRecord)
```

// use of KB

```tsx

const kb = Unbody.getKnoweldgeBase("id")

const insightIntoProfiles = await kb.ask("how many female profiles we have?")
const insightIntoProfiles = await kb.ask("give me a full profile data from Pim")

const answer = await kb.ask("how many users are female")
const answer = await kb.search("fashion design")
const patterns = await kb.patterns("users onboarding")
conat next = await kb.prediction(...sequence).next()
```

```jsx
const memory = Unbody.createKnoweldgebase(
`You will be a intelegent memory for converastions of a user
your job is to keep observing all incoming conversations from two peers

you will be using a Theory of Mind as your first pricinple
the idea is to create a mental model from each of peers

your focus has to be on mainly around politics`,
vectorDb, graphDB, sqlDn
);

const user = new memory.subject("describe the subject")
const assiatant = new memory.subject("describe the subject")

user.inject(...)
assiatant.inject(...)

const question = "do you remember the articles you showed me two days ago?"
const question = "what topics most of our team members have been talking about in last 2 weeks"

```

```jsx
const patternEngine = Unbody.createKnoweldgebase(
`you will be observing one person in the house, 	 your input will be a series of logs of acitvity of this person in house 	 you are part of IOT system` 	,
vectorDb, graphDB, sqlDn
);

const person = new memory.subject("")
person.inject(...)

patternEngine.ask("how many of people usually have their coffe between 10 to 11 am?")

patternEngine.ask("how similar the behviours of these two agents are?", {
   aganetIds: [
	   personA.id, 
	   personB.id
	  ]
})
```

```jsx
const patternEngine = Unbody.createKnoweldgebase(
`you will be observing one person in the house.
 your input will be a series of logs of acitvity of this person in house.
 you are part of IOT system`,
 vectorDb, graphDB, sqlDn
);

const person = new memory.subject("")
person.inject(...)

patternEngine.ask("how many of people usually have their coffe between 10 to 11 am?")

patternEngine.ask("how similar the behviours of these two agents are?", {
aganetIds: [personA.id,personB.id]
})

PatternEngine.predict()
```

```jsx
const ragAgent = new Agent({
	tools: {
		vectorSearch,
		graphSearch,
		recordSearch
	},
})

const contextFragments = {
	overviewOfEntireKB: "",
	// statistics: "we have 2019 profile, we have ",
}

```

```jsx
//memory for my programming 

const gaborMind = = Unbody.create(
`you are repsenting me who is ... you keep track of all my activities, classify them and you will help every tool that asks yu about me and ...
whenever I come across images, you should apply caption  
`,
tools: [
	linearMCP, 
	...
]
);

~~const myBorwser = gaborMind.subject("you are an spaxlized aganet observing my browser activties")

const mycoding = gaborMind.subject("...")~~

onPagevisit((data) => myBrowser.inject(data))

mycoding.inject("gabor message")
mycoding.inject("claud code message")

// inside cload skills or mcps
tool: myBorwser.ask()

gaborMind.ask("what should I work on?")
// this will look into my linear and gmail and answer
```

what happens behind the scene

- phase 1
the retrivial agents gets generated and defined as we go in and of course it can always be
started from the main system prompt
- phase 2
we wont have any pre-fixeated agent in background
we generate agents upon type of questions > this means that each question
will be answered either by already generated set of agents or if not existed then
gets generetaed.

> for example query is **"how many females profiles we have"**
> 

**previously we do not know such a question wil lbe ask so it does not make sense to try to aggreagate them**
or if we do, we might not be able to even think of "female profiles"

so what do we do ?

## 1. What Happens Behind the Scenes

On **every query**, Unbody Brain follows a structured orchestration flow:

1. **Question classification**
    
    The orchestrator agent analyzes and classifies the incoming query.
    
2. **Agent-chain resolution ("skill")**
    - If a suitable agent-chain already exists → it is reused.
    - If the query represents a new type → a new agent-chain is generated and deployed.
3. **Context fragment management**
    
    The resolved agent-chain creates or updates its dedicated context fragments.
    
4. **Tool execution**
    
    Worker agents execute vector, graph, and SQL tools as needed.
    
5. **Reasoning & aggregation**
    
    Workers aggregate results, reason over data, and extract patterns.
    
6. **Answer generation**
    
    A final response is produced. Context fragments may be updated to improve future queries.
    

## 2. Context Fragments

Context fragments are structured memory units maintained per agent-chain to keep reasoning **fast**, **accurate**, and **consistent** across queries of the same family.

```tsx
const contextFragments = {
  overviewOfEntireKB: "",
  statistics: "",
  schemaHints: "",
  inferredConcepts: "",
  // each agent-chain maintains its own fragment
}
```

Each agent-chain owns and evolves its fragments independently.

## 3. Example: Conversational Memory

An intelligent memory designed to observe conversations and build theory-of-mind models.

```tsx
const memory = Unbody.createKnowledgebase(
  records,
  `
    you will be an intelligent memory for conversations.
    your job is to observe peers and create theory-of-mind models.
    you focus mainly on politics.
  `,
  { vectorDb, graphDb, sqlDb }
)

const user = memory.subject("user")
const assistant = memory.subject("assistant")

user.inject(...)
assistant.inject(...)

memory.ask("what does the user care about recently?")
memory.predict({ subject: "user", target: "next_topic" })
```

---

## 4. Example: IoT Behaviour Engine

A behavioral intelligence engine observing activity patterns in a household.

```tsx
const patternEngine = Unbody.createKnowledgebase(
  logs,
  `
    you observe one person in the house.
    your input is a series of activity logs.
    you are part of an IoT system.
  `,
  { vectorDb, graphDb, sqlDb },
  {
    useCases: [
      "how many people drink coffee 10-11am?",
      "compare behaviours of {A} and {B}",
      "morning routine patterns"
    ]
  }
)

const person = patternEngine.subject("person:a")
person.inject(...)

patternEngine.ask("how many people usually have coffee between 10 and 11 am?")

patternEngine.ask(
  "how similar the behaviours of these two agents are?",
  { agentIds: [personA.id, personB.id] }
)
```

---

## 5. Example: RAG Agent Tools

Agent-chains dynamically use retrieval tools based on question type and active context fragments.

```tsx
const ragAgent = new Agent({
  tools: {
    vectorSearch,
    graphSearch,
    recordSearch,
  },
})
```

Agent-chains automatically invoke the appropriate tools without explicit wiring.

---

## 6. Summary

**Unbody Brain:**

- Unifies **vector**, **graph**, and **SQL** data
- Is shaped by **natural-language instructions**
- Uses **subjects** for modularity
- Generates and deploys **agent-chains per use case**
- Maintains **context fragments** for speed and consistency
- Answers queries via `.ask()`
- Discovers insights via `.patterns()`
- Forecasts outcomes via `.predict()`

> A domain-programmable intelligence layer for any product.
>