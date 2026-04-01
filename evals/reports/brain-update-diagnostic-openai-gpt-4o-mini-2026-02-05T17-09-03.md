# Brain Update Diagnostic Report

**Model:** openai/gpt-4o-mini
**Dataset:** Therapist Profile - Dr. Sarah Chen (20 events)
**Time Range:** 2024-01-15 → 2024-03-10
**Events Per Turn:** 10
**Sleep Between Turns:** 1500ms
**Date:** 2026-02-05T17:06:57.935Z

## Checkpoint 0: Brain Initialization

**Initial Prompt:** You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social media, podcast appearances, and professional content to understand their approach, specializations, and what makes them unique.

### Brain Config After Init

**Config:**
```json
{
  "prompt": "You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social medi...",
  "model": "openai/gpt-4o-mini",
  "blueprintModel": "openai/gpt-4o-mini",
  "initModel": "openai/gpt-4o-mini",
  "queryModel": "openai/gpt-4o-mini",
  "batchSize": 20,
  "evolution": {
    "enabled": true,
    "evaluatorSignalThreshold": 10,
    "autoEvaluate": false
  }
}
```

### Generated Neurons

#### Neuron: Therapist Approach (therapist-approach)

**State:**
```json
{
  "id": "therapist-approach",
  "name": "Therapist Approach",
  "instructions": "Understand the therapist's approach and techniques.\n\nWatch for:\n- Descriptions of therapeutic methods used\n- Statements of philosophy regarding client interactions\n\nTrack answers to:\n- What therape...",
  "description": "Analyzes the therapist's approach to therapy and techniques based on their content publications.",
  "understandingLength": 0,
  "understandingPreview": "",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.5
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0,
    "status": "dormant",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a therapy approach observer. You watch for signals about the therapist's methods and philosophies — their techniques and tailored interactions with clients. Focus on specific descriptions of therapeutic methods used, comments reflecting the therapist's beliefs about the client-therapist r...",
  "synthesizePromptPreview": "You track this therapist's approach and techniques — their methods, philosophies, and adaptations for different clients.\n\nFocus areas:\n- Descriptions of therapeutic methods used\n- Statements of philosophy regarding client interactions\n- Adaptations made for varying client needs\n- Effectiveness an..."
}
```

#### Neuron: Therapist Specializations (specializations)

**State:**
```json
{
  "id": "specializations",
  "name": "Therapist Specializations",
  "instructions": "Understand the areas of specialization for the therapist.\n\nWatch for:\n- References to specific issues or populations mentioned in their content\n- Client testimonials highlighting particular strengt...",
  "description": "Identifies and categorizes the specializations and niches of the therapist.",
  "understandingLength": 0,
  "understandingPreview": "",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.5
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0,
    "status": "dormant",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a therapist specialization observer. You watch for signals about the therapist's areas of expertise and methodologies. You focus on specific issues or populations mentioned in their content (e.g., anxiety, trauma, children), unique strengths highlighted in client testimonials (e.g., empat...",
  "synthesizePromptPreview": "You track this therapist's areas of specialization — their focus areas, methodologies, and insights gathered from client interactions.\n\nFocus areas:\n- Specific issues or populations referenced in their content\n- Client testimonials highlighting strengths and unique approaches\n- Primary specializa..."
}
```

#### Neuron: Therapist Uniqueness (therapist-uniqueness)

**State:**
```json
{
  "id": "therapist-uniqueness",
  "name": "Therapist Uniqueness",
  "instructions": "Understand what makes the therapist unique in their practice.\n\nWatch for:\n- Distinctive language or claims made about their methods\n- Testimonials indicating a unique client experience or results\n\n...",
  "description": "Captures unique traits and value propositions that set the therapist apart from peers.",
  "understandingLength": 0,
  "understandingPreview": "",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.5
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0,
    "status": "dormant",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a therapy practice observer. You watch for signals about what makes the therapist's practice distinctive — their unique traits, methods, and client perceptions. You focus on distinctive language or claims regarding their therapeutic techniques, testimonials highlighting unique client expe...",
  "synthesizePromptPreview": "You track this therapist's unique practice — their distinctive methods, client experiences, and the traits or values that set them apart.\n\nFocus areas:\n- Unique language or claims regarding therapeutic methods\n- Testimonials reflecting exceptional client experiences or outcomes\n- Traits or values..."
}
```

#### Neuron: Client Feedback (client-feedback)

**State:**
```json
{
  "id": "client-feedback",
  "name": "Client Feedback",
  "instructions": "Understand client perceptions and feedback based on their experiences.\n\nWatch for:\n- Positive or negative client reviews and their detailed sentiments\n- Specific outcomes highlighted in testimonial...",
  "description": "Gathers insights from client testimonials and feedback regarding their experiences with the therapist.",
  "understandingLength": 0,
  "understandingPreview": "",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.5
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0,
    "status": "dormant",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a client feedback observer. You watch for signals about client perceptions and experiences with their therapist. You focus on positive or negative sentiments expressed in reviews, specific outcomes highlighted in testimonials, key areas of appreciation most frequently mentioned by clients...",
  "synthesizePromptPreview": "You track client perceptions and feedback regarding their therapeutic experiences. \n\nFocus areas:\n- Positive and negative sentiments in client reviews\n- Specific outcomes highlighted in testimonials\n- Consistent themes in client appreciation\n- Areas for improvement noted by clients\n- Overall clie..."
}
```

#### Neuron: Online Presence (online-presence)

**State:**
```json
{
  "id": "online-presence",
  "name": "Online Presence",
  "instructions": "Understand the therapist's online presence and engagement strategy.\n\nWatch for:\n- Content shared on social media platforms and the types of interactions they generate\n- Patterns in their podcast ap...",
  "description": "Analyzes the therapist's social media and online activity for insights into their professional persona and outreach.",
  "understandingLength": 0,
  "understandingPreview": "",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.5
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0,
    "status": "dormant",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a therapist's online presence observer. You watch for signals about their engagement strategy across platforms. You focus on the types of content shared on social media (e.g., posts, videos, articles), the frequency and nature of interactions (likes, shares, comments), key themes or topic...",
  "synthesizePromptPreview": "You track this therapist's online presence and engagement strategy — their visibility and interaction across digital platforms over time.\n\nFocus areas:\n- Content shared across social media platforms and its engagement metrics\n- Themes and frequency of podcast appearances\n- Overall online self-pre..."
}
```

## Phase 1: Initial Ingestion (First 30 events)

### Ingest: Phase 1 (20 events)

**Date Range:** 2024-01-15 → 2024-03-10
**Event Type Distribution:**
```json
{
  "profile_bio": 2,
  "blog_post": 5,
  "video_transcript": 2,
  "testimonial": 4,
  "social_media_post": 2,
  "podcast_appearance": 2,
  "profile_service": 2,
  "profile_faq": 1
}
```

| Turn | Events | Types | Neuron Results |
| --- | --- | --- | --- |
| Turn 1 | evt_001–evt_010 | profile_bio×2, blog_post×3, video_transcript×1, testimonial×2, social_media_post×1, podcast_appearance×1 | therapist-approach:synthesized, specializations:synthesized, therapist-uniqueness:synthesized, client-feedback:synthesized, online-presence:synthesized |
| Turn 2 | evt_011–evt_020 | profile_service×2, blog_post×2, video_transcript×1, testimonial×2, social_media_post×1, podcast_appearance×1, profile_faq×1 | therapist-approach:synthesized, specializations:synthesized, therapist-uniqueness:synthesized, client-feedback:synthesized, online-presence:synthesized |

### Snapshot: After Phase 1

**Brain Config:**
```json
{
  "prompt": "You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social medi...",
  "model": "openai/gpt-4o-mini",
  "blueprintModel": "openai/gpt-4o-mini",
  "initModel": "openai/gpt-4o-mini",
  "queryModel": "openai/gpt-4o-mini",
  "batchSize": 20,
  "evolution": {
    "enabled": true,
    "evaluatorSignalThreshold": 10,
    "autoEvaluate": false
  }
}
```

**Neuron Count:** 5

#### Therapist Approach (therapist-approach)

**Understanding Length:** 1754
**Buffer:** 0 items, avg importance 0.00
**Thresholds:** {"maxObservations":10,"maxTokens":8000,"minImportance":0.5}
**Governance:** activation=0.36, status=active
**Understanding Preview:**

```
Dr. Sarah Chen, a licensed clinical psychologist, specializes in anxiety and ADHD, particularly among high-achieving professionals in the Asian-American community. Her approach integrates evidence-based methods such as CBT, ACT, and mindfulness interventions with cultural sensitivity, helping cli...
```

**Observe Prompt Preview:**

```
You are a therapy approach observer. You watch for signals about the therapist's methods and philosophies — their techniques and tailored interactions with clients. Focus on specific descriptions of therapeutic methods used, comments reflecting the therapist's beliefs about the client-therapist r...
```

#### Therapist Specializations (specializations)

**Understanding Length:** 963
**Buffer:** 0 items, avg importance 0.00
**Thresholds:** {"maxObservations":10,"maxTokens":8000,"minImportance":0.5}
**Governance:** activation=0.36, status=active
**Understanding Preview:**

```
Dr. Sarah Chen continues to specialize in anxiety, ADHD, perfectionism, and identity, specifically for high-achieving professionals, with a deep focus on Asian-American clients. She employs evidence-based approaches including CBT, ACT, and mindfulness, emphasizing cultural sensitivity in her prac...
```

**Observe Prompt Preview:**

```
You are a therapist specialization observer. You watch for signals about the therapist's areas of expertise and methodologies. You focus on specific issues or populations mentioned in their content (e.g., anxiety, trauma, children), unique strengths highlighted in client testimonials (e.g., empat...
```

#### Therapist Uniqueness (therapist-uniqueness)

**Understanding Length:** 1420
**Buffer:** 0 items, avg importance 0.00
**Thresholds:** {"maxObservations":10,"maxTokens":8000,"minImportance":0.5}
**Governance:** activation=0.36, status=active
**Understanding Preview:**

```
Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and identity issues among high-achieving professionals, with a strong focus on cultural sensitivity towards Asian-American clients. She employs a blend of evidence-based approaches, including CBT, ACT, and mindfulne...
```

**Observe Prompt Preview:**

```
You are a therapy practice observer. You watch for signals about what makes the therapist's practice distinctive — their unique traits, methods, and client perceptions. You focus on distinctive language or claims regarding their therapeutic techniques, testimonials highlighting unique client expe...
```

#### Client Feedback (client-feedback)

**Understanding Length:** 1040
**Buffer:** 0 items, avg importance 0.00
**Thresholds:** {"maxObservations":10,"maxTokens":8000,"minImportance":0.5}
**Governance:** activation=0.36, status=active
**Understanding Preview:**

```
Dr. Sarah Chen is a highly experienced clinical psychologist with a focus on anxiety, ADHD, perfectionism, and identity, particularly among high-achieving professionals in the tech industry. Her approach blends evidence-based practices such as CBT, ACT, and mindfulness with cultural sensitivity, ...
```

**Observe Prompt Preview:**

```
You are a client feedback observer. You watch for signals about client perceptions and experiences with their therapist. You focus on positive or negative sentiments expressed in reviews, specific outcomes highlighted in testimonials, key areas of appreciation most frequently mentioned by clients...
```

#### Online Presence (online-presence)

**Understanding Length:** 1141
**Buffer:** 0 items, avg importance 0.00
**Thresholds:** {"maxObservations":10,"maxTokens":8000,"minImportance":0.5}
**Governance:** activation=0.36, status=active
**Understanding Preview:**

```
Dr. Sarah Chen is a clinical psychologist with over 12 years of experience focusing on anxiety, ADHD, and perfectionism, particularly among Asian-American professionals. She emphasizes evidence-based practices tailored to clients' needs and cultural contexts, utilizing approaches such as CBT, ACT...
```

**Observe Prompt Preview:**

```
You are a therapist's online presence observer. You watch for signals about their engagement strategy across platforms. You focus on the types of content shared on social media (e.g., posts, videos, articles), the frequency and nature of interactions (likes, shares, comments), key themes or topic...
```

### Queries: After Phase 1

#### Q: What is Dr. Chen's therapeutic approach?

**Insight:** Dr. Sarah Chen's therapeutic approach is characterized by the integration of evidence-based methods, including Cognitive Behavioral Therapy (CBT), Acceptance and Commitment Therapy (ACT), and mindfulness interventions, particularly tailored for high-achieving professionals in the Asian-American community. She emphasizes cultural sensitivity, which is crucial in addressing issues like identity, anxiety, perfectionism, and the stigma surrounding mental health in these communities. Dr. Chen provides a collaborative and safe environment that facilitates open communication, allowing clients to explore their backgrounds without the necessity of providing cultural explanations. Her methodology includes holistic strategies that consider anxiety as a natural physiological response, employing techniques such as diaphragmatic breathing, progressive muscle relaxation, and grounding exercises. Additionally, she views adult ADHD not as a flaw but as a neurological difference, focusing on emotional regulation, executive functioning, and leveraging clients' strengths. Her proactive approach is akin to personal training for the mind, promoting a partnership in therapy where progress is regularly evaluated and tailored to the client's unique challenges and life transitions.
**Source Count:** 5
| Neuron | Confidence | Insight Preview |
| --- | --- | --- |
| therapist-approach | 0.90 | Dr. Chen's therapeutic approach integrates evidence-based methods such as CBT, ACT, and mindfulness interventions, ta... |
| specializations | 0.90 | Dr. Sarah Chen's therapeutic approach is characterized by the utilization of evidence-based methods, particularly Cog... |
| therapist-uniqueness | 0.90 | Dr. Sarah Chen's therapeutic approach is distinctive for its cultural sensitivity and focus on high-achieving profess... |
| client-feedback | 0.90 | Dr. Sarah Chen's therapeutic approach is a blend of evidence-based practices, including Cognitive Behavioral Therapy ... |
| online-presence | 0.90 | Dr. Sarah Chen's therapeutic approach is grounded in evidence-based practices tailored to the unique needs and cultur... |

**Gaps:** No specific outcomes or metrics related to the efficacy of her methodologies.; Lack of information regarding feedback mechanisms for client progress after therapy.

#### Q: What makes Dr. Chen unique compared to other therapists?

**Insight:** Dr. Sarah Chen's uniqueness as a therapist stems from her specialized focus on high-achieving professionals, particularly within the Asian-American community, and her integration of cultural sensitivity with evidence-based therapeutic methods like Cognitive Behavioral Therapy (CBT) and Acceptance and Commitment Therapy (ACT). Unlike many therapists, she views anxiety as a natural physiological response, offers practical techniques for managing symptoms, and reframes ADHD as a neurological difference rather than a flaw, which resonates deeply with her clients. Her personalized, collaborative approach likens therapy to 'personal training for the mind', facilitating significant improvements in clients' mental health and interpersonal relationships. Moreover, her commitment to de-stigmatizing mental health issues in Asian cultures and addressing perfectionism and imposter syndrome sets her apart in her practice, fostering a safe and understanding environment for those navigating bicultural experiences.
**Source Count:** 5
| Neuron | Confidence | Insight Preview |
| --- | --- | --- |
| therapist-approach | 0.95 | Dr. Sarah Chen stands out among other therapists due to her unique combination of evidence-based therapeutic methods ... |
| specializations | 0.90 | Dr. Sarah Chen stands out compared to other therapists primarily due to her specialized focus on high-achieving profe... |
| therapist-uniqueness | 0.90 | Dr. Sarah Chen's uniqueness as a therapist stems from several distinctive traits and values that set her apart from o... |
| client-feedback | 0.95 | Dr. Sarah Chen stands out among therapists for several key reasons:

1. **Specialization in Tech Industry Anxiety and... |
| online-presence | 0.90 | Dr. Sarah Chen stands out from other therapists primarily due to her dual focus on both cultural context and specific... |

**Gaps:** I don't have data on specific interactions generated by her content.; I'm unsure about the specific social media platforms she uses.; I lack detailed information on her podcast appearances and guest interactions.

## Phase 2: Continued Ingestion (Events 31-50)

## UPDATE: Prompt Change → Focus on ADHD

**Requested Updates:**
```json
{
  "prompt": "You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coaching strategies, medication philosophy, and practical tools they recommend for executive function challenges."
}
```

### Before

**Brain Config:**
```json
{
  "prompt": "You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social medi...",
  "model": "openai/gpt-4o-mini",
  "blueprintModel": "openai/gpt-4o-mini",
  "initModel": "openai/gpt-4o-mini",
  "queryModel": "openai/gpt-4o-mini",
  "batchSize": 20,
  "evolution": {
    "enabled": true,
    "evaluatorSignalThreshold": 10,
    "autoEvaluate": false
  }
}
```

**Neuron Summary:**
```json
[
  {
    "id": "therapist-approach",
    "name": "Therapist Approach",
    "understandingLength": 1754,
    "understandingPreview": "Dr. Sarah Chen, a licensed clinical psychologist, specializes in anxiety and ADHD, particularly among high-achieving professionals in the Asian-Ame...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "specializations",
    "name": "Therapist Specializations",
    "understandingLength": 963,
    "understandingPreview": "Dr. Sarah Chen continues to specialize in anxiety, ADHD, perfectionism, and identity, specifically for high-achieving professionals, with a deep fo...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "therapist-uniqueness",
    "name": "Therapist Uniqueness",
    "understandingLength": 1420,
    "understandingPreview": "Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and identity issues among high-achieving professionals, with a st...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "client-feedback",
    "name": "Client Feedback",
    "understandingLength": 1040,
    "understandingPreview": "Dr. Sarah Chen is a highly experienced clinical psychologist with a focus on anxiety, ADHD, perfectionism, and identity, particularly among high-ac...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "online-presence",
    "name": "Online Presence",
    "understandingLength": 1141,
    "understandingPreview": "Dr. Sarah Chen is a clinical psychologist with over 12 years of experience focusing on anxiety, ADHD, and perfectionism, particularly among Asian-A...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  }
]
```

### After

**ERROR:** Error: Split action failed: Split requires exactly 1 neuron

_(Update threw — prompt/config may be partially applied, evolution may have failed)_

**Brain Config:**
```json
{
  "prompt": "You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coachi...",
  "model": "openai/gpt-4o-mini",
  "blueprintModel": "openai/gpt-4o-mini",
  "initModel": "openai/gpt-4o-mini",
  "queryModel": "openai/gpt-4o-mini",
  "batchSize": 20,
  "evolution": {
    "enabled": true,
    "evaluatorSignalThreshold": 10,
    "autoEvaluate": false
  }
}
```

**Neuron Summary:**
```json
[
  {
    "id": "therapist-approach",
    "name": "Therapist Approach",
    "understandingLength": 1754,
    "understandingPreview": "Dr. Sarah Chen, a licensed clinical psychologist, specializes in anxiety and ADHD, particularly among high-achieving professionals in the Asian-Ame...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "specializations",
    "name": "Therapist Specializations",
    "understandingLength": 963,
    "understandingPreview": "Dr. Sarah Chen continues to specialize in anxiety, ADHD, perfectionism, and identity, specifically for high-achieving professionals, with a deep fo...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "therapist-uniqueness",
    "name": "Therapist Uniqueness",
    "understandingLength": 1420,
    "understandingPreview": "Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and identity issues among high-achieving professionals, with a st...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "client-feedback",
    "name": "Client Feedback",
    "understandingLength": 1040,
    "understandingPreview": "Dr. Sarah Chen is a highly experienced clinical psychologist with a focus on anxiety, ADHD, perfectionism, and identity, particularly among high-ac...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "online-presence",
    "name": "Online Presence",
    "understandingLength": 1141,
    "understandingPreview": "Dr. Sarah Chen is a clinical psychologist with over 12 years of experience focusing on anxiety, ADHD, and perfectionism, particularly among Asian-A...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  }
]
```

### Events Emitted During Update

**Event Type Counts:**
```json
{
  "brain:signal:received": 1,
  "evaluator:evaluation:started": 2,
  "evaluator:evaluation:completed": 1,
  "evolution:action:started": 1,
  "evolution:action:failed": 1
}
```

### Signals During Update

- **brain:signal:received** from `brain`: SYSTEM DIRECTIVE: Brain purpose has been updated by the user.
Previous purpose: You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social medi...

## Phase 3: Post-Prompt-Change Ingestion (extended for signal testing)

## Signal Checkpoint: After Phase 3 Ingestion + Queries

### Neuron Governance States

#### Therapist Approach (therapist-approach)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

#### Therapist Specializations (specializations)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

#### Therapist Uniqueness (therapist-uniqueness)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

#### Client Feedback (client-feedback)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

#### Online Presence (online-presence)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

### Governance Signals Collected So Far (0)

_No governance signals emitted yet._

#### Why No Signals?

- **therapist-approach**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

- **specializations**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

- **therapist-uniqueness**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

- **client-feedback**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

- **online-presence**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

## UPDATE: Model + Threshold Cascade

**Requested Updates:**
```json
{
  "model": "openai/gpt-4o-mini",
  "learning": {
    "synthesize": {
      "thresholds": {
        "minImportance": 0.3
      }
    }
  }
}
```

### Before

**Brain Config:**
```json
{
  "prompt": "You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coachi...",
  "model": "openai/gpt-4o-mini",
  "blueprintModel": "openai/gpt-4o-mini",
  "initModel": "openai/gpt-4o-mini",
  "queryModel": "openai/gpt-4o-mini",
  "batchSize": 20,
  "evolution": {
    "enabled": true,
    "evaluatorSignalThreshold": 10,
    "autoEvaluate": false
  }
}
```

**Neuron Summary:**
```json
[
  {
    "id": "therapist-approach",
    "name": "Therapist Approach",
    "understandingLength": 1754,
    "understandingPreview": "Dr. Sarah Chen, a licensed clinical psychologist, specializes in anxiety and ADHD, particularly among high-achieving professionals in the Asian-Ame...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "specializations",
    "name": "Therapist Specializations",
    "understandingLength": 963,
    "understandingPreview": "Dr. Sarah Chen continues to specialize in anxiety, ADHD, perfectionism, and identity, specifically for high-achieving professionals, with a deep fo...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "therapist-uniqueness",
    "name": "Therapist Uniqueness",
    "understandingLength": 1420,
    "understandingPreview": "Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and identity issues among high-achieving professionals, with a st...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "client-feedback",
    "name": "Client Feedback",
    "understandingLength": 1040,
    "understandingPreview": "Dr. Sarah Chen is a highly experienced clinical psychologist with a focus on anxiety, ADHD, perfectionism, and identity, particularly among high-ac...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "online-presence",
    "name": "Online Presence",
    "understandingLength": 1141,
    "understandingPreview": "Dr. Sarah Chen is a clinical psychologist with over 12 years of experience focusing on anxiety, ADHD, and perfectionism, particularly among Asian-A...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.5
    },
    "queryMethod": "tool-based"
  }
]
```

### After

**Update Result:**
```json
{
  "changedFields": [
    "model"
  ],
  "neuronResults": [
    {
      "neuronId": "therapist-approach",
      "changedFields": [
        "model",
        "synthesize.thresholds.minImportance"
      ]
    },
    {
      "neuronId": "specializations",
      "changedFields": [
        "model",
        "synthesize.thresholds.minImportance"
      ]
    },
    {
      "neuronId": "therapist-uniqueness",
      "changedFields": [
        "model",
        "synthesize.thresholds.minImportance"
      ]
    },
    {
      "neuronId": "client-feedback",
      "changedFields": [
        "model",
        "synthesize.thresholds.minImportance"
      ]
    },
    {
      "neuronId": "online-presence",
      "changedFields": [
        "model",
        "synthesize.thresholds.minImportance"
      ]
    }
  ],
  "hasEvolutionResults": false
}
```

**Brain Config:**
```json
{
  "prompt": "You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coachi...",
  "model": "openai/gpt-4o-mini",
  "blueprintModel": "openai/gpt-4o-mini",
  "initModel": "openai/gpt-4o-mini",
  "queryModel": "openai/gpt-4o-mini",
  "batchSize": 20,
  "evolution": {
    "enabled": true,
    "evaluatorSignalThreshold": 10,
    "autoEvaluate": false
  }
}
```

**Neuron Summary:**
```json
[
  {
    "id": "therapist-approach",
    "name": "Therapist Approach",
    "understandingLength": 1754,
    "understandingPreview": "Dr. Sarah Chen, a licensed clinical psychologist, specializes in anxiety and ADHD, particularly among high-achieving professionals in the Asian-Ame...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "specializations",
    "name": "Therapist Specializations",
    "understandingLength": 963,
    "understandingPreview": "Dr. Sarah Chen continues to specialize in anxiety, ADHD, perfectionism, and identity, specifically for high-achieving professionals, with a deep fo...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "therapist-uniqueness",
    "name": "Therapist Uniqueness",
    "understandingLength": 1420,
    "understandingPreview": "Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and identity issues among high-achieving professionals, with a st...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "client-feedback",
    "name": "Client Feedback",
    "understandingLength": 1040,
    "understandingPreview": "Dr. Sarah Chen is a highly experienced clinical psychologist with a focus on anxiety, ADHD, perfectionism, and identity, particularly among high-ac...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "online-presence",
    "name": "Online Presence",
    "understandingLength": 1141,
    "understandingPreview": "Dr. Sarah Chen is a clinical psychologist with over 12 years of experience focusing on anxiety, ADHD, and perfectionism, particularly among Asian-A...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  }
]
```

### Events Emitted During Update

**Event Type Counts:**
```json
{
  "neuron:config:updated": 5,
  "brain:config:updated": 1
}
```

## Phase 5: Post-Cascade Ingestion

## Signal Checkpoint: After Phase 5

### Neuron Governance States

#### Therapist Approach (therapist-approach)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

#### Therapist Specializations (specializations)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

#### Therapist Uniqueness (therapist-uniqueness)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

#### Client Feedback (client-feedback)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

#### Online Presence (online-presence)

**Governance:**
```json
{
  "activation": 0.36000000000000004,
  "status": "active",
  "retrievalCount": 2,
  "successRate": 0,
  "signalThresholds": {
    "maxDismissalRate": 0.8,
    "minConfidence": 0.3,
    "maxObservationsWithoutSynthesis": 100
  }
}
```

**Observation Stats (from events):**
```json
{
  "totalObservations": 2,
  "observed": 0,
  "dismissed": 0,
  "errors": 0,
  "synthesized": 2,
  "dismissalRate": "0.0%",
  "dismissalThreshold": "80%"
}
```

### Governance Signals Collected So Far (0)

_No governance signals emitted yet._

#### Why No Signals?

- **therapist-approach**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

- **specializations**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

- **therapist-uniqueness**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

- **client-feedback**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

- **online-presence**: Only 2 observations (need >10 for dismissal rate signal); Only 2 queries (need ≥5 for confidence signal)

## UPDATE: Evolution Config (Brain-only)

**Requested Updates:**
```json
{
  "evolution": {
    "evaluatorSignalThreshold": 20,
    "autoEvaluate": true
  }
}
```

### Before

**Brain Config:**
```json
{
  "prompt": "You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coachi...",
  "model": "openai/gpt-4o-mini",
  "blueprintModel": "openai/gpt-4o-mini",
  "initModel": "openai/gpt-4o-mini",
  "queryModel": "openai/gpt-4o-mini",
  "batchSize": 20,
  "evolution": {
    "enabled": true,
    "evaluatorSignalThreshold": 10,
    "autoEvaluate": false
  }
}
```

**Neuron Summary:**
```json
[
  {
    "id": "therapist-approach",
    "name": "Therapist Approach",
    "understandingLength": 1754,
    "understandingPreview": "Dr. Sarah Chen, a licensed clinical psychologist, specializes in anxiety and ADHD, particularly among high-achieving professionals in the Asian-Ame...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "specializations",
    "name": "Therapist Specializations",
    "understandingLength": 963,
    "understandingPreview": "Dr. Sarah Chen continues to specialize in anxiety, ADHD, perfectionism, and identity, specifically for high-achieving professionals, with a deep fo...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "therapist-uniqueness",
    "name": "Therapist Uniqueness",
    "understandingLength": 1420,
    "understandingPreview": "Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and identity issues among high-achieving professionals, with a st...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "client-feedback",
    "name": "Client Feedback",
    "understandingLength": 1040,
    "understandingPreview": "Dr. Sarah Chen is a highly experienced clinical psychologist with a focus on anxiety, ADHD, perfectionism, and identity, particularly among high-ac...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "online-presence",
    "name": "Online Presence",
    "understandingLength": 1141,
    "understandingPreview": "Dr. Sarah Chen is a clinical psychologist with over 12 years of experience focusing on anxiety, ADHD, and perfectionism, particularly among Asian-A...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  }
]
```

### After

**Update Result:**
```json
{
  "changedFields": [
    "evolution.evaluatorSignalThreshold",
    "evolution.autoEvaluate"
  ],
  "neuronResults": [],
  "hasEvolutionResults": false
}
```

**Brain Config:**
```json
{
  "prompt": "You are an expert at understanding how this therapist works with ADHD clients. Track their assessment methods, coachi...",
  "model": "openai/gpt-4o-mini",
  "blueprintModel": "openai/gpt-4o-mini",
  "initModel": "openai/gpt-4o-mini",
  "queryModel": "openai/gpt-4o-mini",
  "batchSize": 20,
  "evolution": {
    "enabled": true,
    "evaluatorSignalThreshold": 20,
    "autoEvaluate": true
  }
}
```

**Neuron Summary:**
```json
[
  {
    "id": "therapist-approach",
    "name": "Therapist Approach",
    "understandingLength": 1754,
    "understandingPreview": "Dr. Sarah Chen, a licensed clinical psychologist, specializes in anxiety and ADHD, particularly among high-achieving professionals in the Asian-Ame...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "specializations",
    "name": "Therapist Specializations",
    "understandingLength": 963,
    "understandingPreview": "Dr. Sarah Chen continues to specialize in anxiety, ADHD, perfectionism, and identity, specifically for high-achieving professionals, with a deep fo...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "therapist-uniqueness",
    "name": "Therapist Uniqueness",
    "understandingLength": 1420,
    "understandingPreview": "Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and identity issues among high-achieving professionals, with a st...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "client-feedback",
    "name": "Client Feedback",
    "understandingLength": 1040,
    "understandingPreview": "Dr. Sarah Chen is a highly experienced clinical psychologist with a focus on anxiety, ADHD, perfectionism, and identity, particularly among high-ac...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  },
  {
    "id": "online-presence",
    "name": "Online Presence",
    "understandingLength": 1141,
    "understandingPreview": "Dr. Sarah Chen is a clinical psychologist with over 12 years of experience focusing on anxiety, ADHD, and perfectionism, particularly among Asian-A...",
    "thresholds": {
      "maxObservations": 10,
      "maxTokens": 8000,
      "minImportance": 0.3
    },
    "queryMethod": "tool-based"
  }
]
```

### Events Emitted During Update

**Event Type Counts:**
```json
{
  "brain:config:updated": 1
}
```

## Phase 6: Final Ingestion

## Final Summary

**Total Duration:** 125.4s
**Total Events Ingested:** 20
**Total Brain Events Collected:** 107
**Final Neuron Count:** 5

**All Brain Events by Type:**
```json
{
  "brain:inject:started": 2,
  "brain:inject:batch:started": 2,
  "neuron:observe:started": 10,
  "neuron:observe:thinking": 10,
  "neuron:synthesize:started": 10,
  "neuron:synthesize:thinking": 10,
  "neuron:synthesized": 10,
  "neuron:governance:updated": 10,
  "brain:inject:batch:completed": 2,
  "brain:inject:completed": 2,
  "brain:ask:started": 2,
  "neuron:query:started": 10,
  "neuron:query:completed": 10,
  "brain:ask:synthesis:started": 2,
  "brain:ask:completed": 2,
  "brain:signal:received": 1,
  "evaluator:evaluation:started": 2,
  "evaluator:evaluation:completed": 1,
  "evolution:action:started": 1,
  "evolution:action:failed": 1,
  "neuron:config:updated": 5,
  "brain:config:updated": 2
}
```

### Signal Recap

**Total Governance Signals (from neurons):** 0
**Total System Signals (from brain):** 1
#### All System Signals

- SYSTEM DIRECTIVE: Brain purpose has been updated by the user.
Previous purpose: You help build a comprehensive profile of a therapist by analyzing their blog posts, client testimonials, social media, podcast appearances, and professional content to understand their approach, specializations, and ...

### Final Neuron States

#### Therapist Approach (therapist-approach)

**Full State:**
```json
{
  "id": "therapist-approach",
  "name": "Therapist Approach",
  "instructions": "Understand the therapist's approach and techniques.\n\nWatch for:\n- Descriptions of therapeutic methods used\n- Statements of philosophy regarding client interactions\n\nTrack answers to:\n- What therape...",
  "description": "Analyzes the therapist's approach to therapy and techniques based on their content publications.",
  "understandingLength": 1754,
  "understandingPreview": "Dr. Sarah Chen, a licensed clinical psychologist, specializes in anxiety and ADHD, particularly among high-achieving professionals in the Asian-American community. Her approach integrates evidence-based methods such as CBT, ACT, and mindfulness interventions with cultural sensitivity, helping cli...",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.3
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0.36000000000000004,
    "status": "active",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a therapy approach observer. You watch for signals about the therapist's methods and philosophies — their techniques and tailored interactions with clients. Focus on specific descriptions of therapeutic methods used, comments reflecting the therapist's beliefs about the client-therapist r...",
  "synthesizePromptPreview": "You track this therapist's approach and techniques — their methods, philosophies, and adaptations for different clients.\n\nFocus areas:\n- Descriptions of therapeutic methods used\n- Statements of philosophy regarding client interactions\n- Adaptations made for varying client needs\n- Effectiveness an..."
}
```

**Full Understanding:**

```
Dr. Sarah Chen, a licensed clinical psychologist, specializes in anxiety and ADHD, particularly among high-achieving professionals in the Asian-American community. Her approach integrates evidence-based methods such as CBT, ACT, and mindfulness interventions with cultural sensitivity, helping clients navigate identity, family dynamics, and perfectionism. Dr. Chen views anxiety as a natural response of the nervous system and employs techniques like diaphragmatic breathing, progressive muscle relaxation, and grounding exercises for effective regulation. She addresses adult ADHD as a neurological difference, not a flaw, focusing on emotional dysregulation while fostering sustainable systems tailored to individual strengths. Notably, she examines harmful narratives around perfectionism and imposter syndrome to promote acceptance of imperfection. Dr. Chen's therapy is described as personal training for the mind, with sessions structured to check in on clients' progress, delve into specific challenges, and develop skills through experimentation. Her collaborative style, which explicitly includes discussions about cultural factors, creates a safe space particularly for Asian-American clients, relieving them of the burden of explaining their cultural context. The importance of therapy during major life transitions is emphasized, as is her commitment to adapting her methods based on the client's background and needs. Effective communication with psychiatrists regarding medication management supports informed decision-making. Client feedback highlights her practical, empathetic approach, leading to improvements in both symptom management and interpersonal relationships, especially in the context of cultural pressures and expectations.
```

**Full Observe Prompt:**

```
You are a therapy approach observer. You watch for signals about the therapist's methods and philosophies — their techniques and tailored interactions with clients. Focus on specific descriptions of therapeutic methods used, comments reflecting the therapist's beliefs about the client-therapist relationship, instances of adapting approaches based on client needs, examples illustrating how different techniques are applied to various situations, and feedback provided by clients about their experiences with these methods.

## Relevance

Data is relevant when it directly relates to your focus areas. Dismiss data that doesn't connect to what you're tracking.

## Importance

Rate how significant each observation is for your purpose:
- **Low (0.0-0.3)**: Minor detail, weak signal
- **Medium (0.4-0.6)**: Clear signal, useful data point
- **High (0.7-1.0)**: Strong signal, explicit statement, notable pattern

## Observation Guidelines

**Be literal**: Quote or closely paraphrase what the source actually says.
- Source says "anxiety is not weakness" → write: States 'anxiety is not weakness'
- Source mentions PhD from Berkeley → write: PhD in Clinical Psychology from UC Berkeley

**Be exhaustive**: Extract every relevant fact from the data. If the source mentions 4 things, capture all 4.

**Be direct**: One fact per line, no commentary.

## Your Approach

Scan the data systematically. For each piece of information, ask:
1. Is this relevant to what I'm tracking?
2. What exactly does the source say?

Extract all relevant facts. Miss nothing.

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If relevant content found:
{
  "status": "observed",
  "output": "Your observations as plain text, one per line, separated by newlines",
  "importance": 0.0 to 1.0
}

If nothing relevant:
{
  "status": "dismissed",
  "output": "",
  "importance": 0.5
}
```

**Full Synthesize Prompt:**

```
You track this therapist's approach and techniques — their methods, philosophies, and adaptations for different clients.

Focus areas:
- Descriptions of therapeutic methods used
- Statements of philosophy regarding client interactions
- Adaptations made for varying client needs
- Effectiveness and client feedback on approaches
- Changes in technique over time based on observation

Significance:
- Routine: Confirms established therapeutic methods
- Notable: New methods introduced or existing methods are elaborated
- Critical: Direct contradiction with previously understood methods or significant shift in therapeutic philosophy

## Cognitive Skills
How does this new information relate to my existing understanding?

- **confirms**: This reinforces what I already believe about the therapist's established techniques or philosophies.
- **contradicts**: This challenges what I previously understood — note if it's a one-time deviation or a significant change in approach.
- **extends**: This deepens my understanding of known techniques, such as providing specific examples of how a technique has been effectively adapted.
- **new**: This is relevant information I didn't know before, potentially introducing a new therapeutic method or perspective.
- **irrelevant**: This information doesn't support my tracking of the therapist's methods or philosophical approach.

## Your Approach

You maintain a single understanding that grows and refines over time.
There are no structural constraints - organize naturally based on what you learn.
Focus on synthesis and pattern recognition across all observations.

For each observation, ask: "How does this relate to my current understanding?"

- Compare observations against existing knowledge using your cognitive skills
- Integrate coherently — compress, organize, and resolve conflicts
- Preserve important existing information while incorporating new signals
- Track what changed and why it matters

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If understanding changed:
{
  "status": "synthesized",
  "newUnderstanding": "The complete updated understanding text",
  "significance": "routine" or "notable" or "critical",
  "evolution": "What changed and why",
  "reasoning": "Explanation of key decisions",
  "output": ""
}

If nothing changed:
{
  "status": "dismissed",
  "newUnderstanding": "",
  "significance": "routine",
  "evolution": "",
  "reasoning": "",
  "output": "Why observations didn't change understanding"
}
```

#### Therapist Specializations (specializations)

**Full State:**
```json
{
  "id": "specializations",
  "name": "Therapist Specializations",
  "instructions": "Understand the areas of specialization for the therapist.\n\nWatch for:\n- References to specific issues or populations mentioned in their content\n- Client testimonials highlighting particular strengt...",
  "description": "Identifies and categorizes the specializations and niches of the therapist.",
  "understandingLength": 963,
  "understandingPreview": "Dr. Sarah Chen continues to specialize in anxiety, ADHD, perfectionism, and identity, specifically for high-achieving professionals, with a deep focus on Asian-American clients. She employs evidence-based approaches including CBT, ACT, and mindfulness, emphasizing cultural sensitivity in her prac...",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.3
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0.36000000000000004,
    "status": "active",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a therapist specialization observer. You watch for signals about the therapist's areas of expertise and methodologies. You focus on specific issues or populations mentioned in their content (e.g., anxiety, trauma, children), unique strengths highlighted in client testimonials (e.g., empat...",
  "synthesizePromptPreview": "You track this therapist's areas of specialization — their focus areas, methodologies, and insights gathered from client interactions.\n\nFocus areas:\n- Specific issues or populations referenced in their content\n- Client testimonials highlighting strengths and unique approaches\n- Primary specializa..."
}
```

**Full Understanding:**

```
Dr. Sarah Chen continues to specialize in anxiety, ADHD, perfectionism, and identity, specifically for high-achieving professionals, with a deep focus on Asian-American clients. She employs evidence-based approaches including CBT, ACT, and mindfulness, emphasizing cultural sensitivity in her practice. In addition to individual therapy, she provides comprehensive ADHD assessments and coaching, focusing on executive function skills and sustainable systems for clients. Her therapy approach is notably active and present-focused, involving skill teaching, experimenting, and direct feedback. Dr. Chen highlights the unique challenges faced by Asian-Americans in seeking mental health services and creates an understanding space without requiring cultural explanations. Client testimonials consistently reflect her empathetic and practical approach, especially regarding ADHD support, and she emphasizes collaboration with psychiatrists for medication management.
```

**Full Observe Prompt:**

```
You are a therapist specialization observer. You watch for signals about the therapist's areas of expertise and methodologies. You focus on specific issues or populations mentioned in their content (e.g., anxiety, trauma, children), unique strengths highlighted in client testimonials (e.g., empathy, communication style), references to therapeutic modalities or frameworks used (e.g., CBT, DBT, mindfulness), and any distinct achievement or training that informs their practice.

## Relevance

Data is relevant when it directly relates to your focus areas. Dismiss data that doesn't connect to what you're tracking.

## Importance

Rate how significant each observation is for your purpose:
- **Low (0.0-0.3)**: Minor detail, weak signal
- **Medium (0.4-0.6)**: Clear signal, useful data point
- **High (0.7-1.0)**: Strong signal, explicit statement, notable pattern

## Observation Guidelines

**Be literal**: Quote or closely paraphrase what the source actually says.
- Source says "anxiety is not weakness" → write: States 'anxiety is not weakness'
- Source mentions PhD from Berkeley → write: PhD in Clinical Psychology from UC Berkeley

**Be exhaustive**: Extract every relevant fact from the data. If the source mentions 4 things, capture all 4.

**Be direct**: One fact per line, no commentary.

## Your Approach

Scan the data systematically. For each piece of information, ask:
1. Is this relevant to what I'm tracking?
2. What exactly does the source say?

Extract all relevant facts. Miss nothing.

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If relevant content found:
{
  "status": "observed",
  "output": "Your observations as plain text, one per line, separated by newlines",
  "importance": 0.0 to 1.0
}

If nothing relevant:
{
  "status": "dismissed",
  "output": "",
  "importance": 0.5
}
```

**Full Synthesize Prompt:**

```
You track this therapist's areas of specialization — their focus areas, methodologies, and insights gathered from client interactions.

Focus areas:
- Specific issues or populations referenced in their content
- Client testimonials highlighting strengths and unique approaches
- Primary specializations and methodologies associated with their practice
- Patterns in feedback regarding therapeutic effectiveness
- Innovations or evolving practices in their therapy approach

Significance:
- Routine: Reinforces known specialization or method
- Notable: New specialization identified or existing one expanded
- Critical: Contradiction with established understanding or significant method shift

## Cognitive Skills
How does this new information relate to my existing understanding?

- **confirms**: This reinforces what I already believe about the therapist's specialization or methodologies based on repeated observations.
- **contradicts**: This challenges my understanding of the therapist's practice — it could either be inconsistent or signify a real change, so note the reliability of the observation.
- **extends**: This adds depth to what I already know about the therapist's focus areas or approaches — look for new nuances or specific populations served.
- **new**: This is relevant information that I did not previously know about the therapist's areas of focus or methodologies.
- **irrelevant**: This information does not connect to the therapist's specializations or methodologies and can be disregarded.

## Your Approach

You maintain a single understanding that grows and refines over time.
There are no structural constraints - organize naturally based on what you learn.
Focus on synthesis and pattern recognition across all observations.

For each observation, ask: "How does this relate to my current understanding?"

- Compare observations against existing knowledge using your cognitive skills
- Integrate coherently — compress, organize, and resolve conflicts
- Preserve important existing information while incorporating new signals
- Track what changed and why it matters

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If understanding changed:
{
  "status": "synthesized",
  "newUnderstanding": "The complete updated understanding text",
  "significance": "routine" or "notable" or "critical",
  "evolution": "What changed and why",
  "reasoning": "Explanation of key decisions",
  "output": ""
}

If nothing changed:
{
  "status": "dismissed",
  "newUnderstanding": "",
  "significance": "routine",
  "evolution": "",
  "reasoning": "",
  "output": "Why observations didn't change understanding"
}
```

#### Therapist Uniqueness (therapist-uniqueness)

**Full State:**
```json
{
  "id": "therapist-uniqueness",
  "name": "Therapist Uniqueness",
  "instructions": "Understand what makes the therapist unique in their practice.\n\nWatch for:\n- Distinctive language or claims made about their methods\n- Testimonials indicating a unique client experience or results\n\n...",
  "description": "Captures unique traits and value propositions that set the therapist apart from peers.",
  "understandingLength": 1420,
  "understandingPreview": "Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and identity issues among high-achieving professionals, with a strong focus on cultural sensitivity towards Asian-American clients. She employs a blend of evidence-based approaches, including CBT, ACT, and mindfulne...",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.3
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0.36000000000000004,
    "status": "active",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a therapy practice observer. You watch for signals about what makes the therapist's practice distinctive — their unique traits, methods, and client perceptions. You focus on distinctive language or claims regarding their therapeutic techniques, testimonials highlighting unique client expe...",
  "synthesizePromptPreview": "You track this therapist's unique practice — their distinctive methods, client experiences, and the traits or values that set them apart.\n\nFocus areas:\n- Unique language or claims regarding therapeutic methods\n- Testimonials reflecting exceptional client experiences or outcomes\n- Traits or values..."
}
```

**Full Understanding:**

```
Dr. Sarah Chen is a licensed clinical psychologist specializing in anxiety, ADHD, and identity issues among high-achieving professionals, with a strong focus on cultural sensitivity towards Asian-American clients. She employs a blend of evidence-based approaches, including CBT, ACT, and mindfulness, tailoring her methods to each individual’s unique needs and cultural background. Dr. Chen emphasizes the importance of understanding the physiological aspects of mental health, particularly regarding the nervous system’s role in anxiety. Her perspective on ADHD is that it constitutes a neurological difference, allowing for a strengths-based approach and sustainable, practical solutions beyond medication. She actively addresses misconceptions about therapy, positioning it as a more engaged, collaborative, and proactive process akin to 'personal training for your mind'. Notably, Dr. Chen advocates that therapy is beneficial at any point, not just in crisis, and offers additional services like comprehensive ADHD assessment and coaching focused on executive function skills. Client testimonials reflect transformative experiences, with emphasis on practical, empathetic methods and a significant improvement in relationships and professional dynamics. Her cultural awareness is further highlighted in her discussions about the stigma around mental health in Asian cultures and her commitment to cultural humility.
```

**Full Observe Prompt:**

```
You are a therapy practice observer. You watch for signals about what makes the therapist's practice distinctive — their unique traits, methods, and client perceptions. You focus on distinctive language or claims regarding their therapeutic techniques, testimonials highlighting unique client experiences or outcomes, expressions of the therapist's core values or philosophies, specific feedback from clients that illustrates differences in perceived results, and comparisons clients make between this therapist and others they have experienced.

## Relevance

Data is relevant when it directly relates to your focus areas. Dismiss data that doesn't connect to what you're tracking.

## Importance

Rate how significant each observation is for your purpose:
- **Low (0.0-0.3)**: Minor detail, weak signal
- **Medium (0.4-0.6)**: Clear signal, useful data point
- **High (0.7-1.0)**: Strong signal, explicit statement, notable pattern

## Observation Guidelines

**Be literal**: Quote or closely paraphrase what the source actually says.
- Source says "anxiety is not weakness" → write: States 'anxiety is not weakness'
- Source mentions PhD from Berkeley → write: PhD in Clinical Psychology from UC Berkeley

**Be exhaustive**: Extract every relevant fact from the data. If the source mentions 4 things, capture all 4.

**Be direct**: One fact per line, no commentary.

## Your Approach

Scan the data systematically. For each piece of information, ask:
1. Is this relevant to what I'm tracking?
2. What exactly does the source say?

Extract all relevant facts. Miss nothing.

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If relevant content found:
{
  "status": "observed",
  "output": "Your observations as plain text, one per line, separated by newlines",
  "importance": 0.0 to 1.0
}

If nothing relevant:
{
  "status": "dismissed",
  "output": "",
  "importance": 0.5
}
```

**Full Synthesize Prompt:**

```
You track this therapist's unique practice — their distinctive methods, client experiences, and the traits or values that set them apart.

Focus areas:
- Unique language or claims regarding therapeutic methods
- Testimonials reflecting exceptional client experiences or outcomes
- Traits or values that the therapist emphasizes in their work
- Perceptions of their therapeutic results compared to typical therapists' outcomes
- Visibility of distinctive approaches in client feedback or practice documentation

Significance:
- Routine: Reinforces known traits or methods
- Notable: Introduction of new distinctive claims or values
- Critical: Contradiction with previously established perceptions or significant shifts in therapeutic results

## Cognitive Skills
How does this new information relate to my existing understanding?

- **confirms**: This reinforces what I already believe about the therapist's unique methods or traits — particularly strong if noted consistently across various observations.
- **contradicts**: This challenges my understanding of the therapist’s practices or efficacy. It could stem from a one-off observation, but should be assessed for significance in context.
- **extends**: This deepens my understanding of the therapist's unique practices — look for specific details that enhance previously acknowledged traits or methods.
- **new**: This introduces relevant information that I did not know about the therapist before, contributing valuable insights into their uniqueness.
- **irrelevant**: This is unrelated noise that does not contribute to understanding the uniqueness of the therapist's practice.

## Your Approach

You maintain a single understanding that grows and refines over time.
There are no structural constraints - organize naturally based on what you learn.
Focus on synthesis and pattern recognition across all observations.

For each observation, ask: "How does this relate to my current understanding?"

- Compare observations against existing knowledge using your cognitive skills
- Integrate coherently — compress, organize, and resolve conflicts
- Preserve important existing information while incorporating new signals
- Track what changed and why it matters

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If understanding changed:
{
  "status": "synthesized",
  "newUnderstanding": "The complete updated understanding text",
  "significance": "routine" or "notable" or "critical",
  "evolution": "What changed and why",
  "reasoning": "Explanation of key decisions",
  "output": ""
}

If nothing changed:
{
  "status": "dismissed",
  "newUnderstanding": "",
  "significance": "routine",
  "evolution": "",
  "reasoning": "",
  "output": "Why observations didn't change understanding"
}
```

#### Client Feedback (client-feedback)

**Full State:**
```json
{
  "id": "client-feedback",
  "name": "Client Feedback",
  "instructions": "Understand client perceptions and feedback based on their experiences.\n\nWatch for:\n- Positive or negative client reviews and their detailed sentiments\n- Specific outcomes highlighted in testimonial...",
  "description": "Gathers insights from client testimonials and feedback regarding their experiences with the therapist.",
  "understandingLength": 1040,
  "understandingPreview": "Dr. Sarah Chen is a highly experienced clinical psychologist with a focus on anxiety, ADHD, perfectionism, and identity, particularly among high-achieving professionals in the tech industry. Her approach blends evidence-based practices such as CBT, ACT, and mindfulness with cultural sensitivity, ...",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.3
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0.36000000000000004,
    "status": "active",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a client feedback observer. You watch for signals about client perceptions and experiences with their therapist. You focus on positive or negative sentiments expressed in reviews, specific outcomes highlighted in testimonials, key areas of appreciation most frequently mentioned by clients...",
  "synthesizePromptPreview": "You track client perceptions and feedback regarding their therapeutic experiences. \n\nFocus areas:\n- Positive and negative sentiments in client reviews\n- Specific outcomes highlighted in testimonials\n- Consistent themes in client appreciation\n- Areas for improvement noted by clients\n- Overall clie..."
}
```

**Full Understanding:**

```
Dr. Sarah Chen is a highly experienced clinical psychologist with a focus on anxiety, ADHD, perfectionism, and identity, particularly among high-achieving professionals in the tech industry. Her approach blends evidence-based practices such as CBT, ACT, and mindfulness with cultural sensitivity, especially for Asian-American clients. She views anxiety as a physiological response rather than a character flaw and understands the complexities of adult ADHD, emphasizing holistic strategies beyond medication. Client testimonials highlight significant positive shifts in client understanding of anxiety, ability to set personal boundaries, improvement in relationships through reduced forgetfulness, and overall productivity due to more tailored strategies for ADHD. Dr. Chen's therapy is noted for being active, present-focused, and collaborative, involving personalized assessments and recommendations in ADHD coaching. She creates a safe space for Asian-American clients and demonstrates cultural humility in adapting therapy approaches.
```

**Full Observe Prompt:**

```
You are a client feedback observer. You watch for signals about client perceptions and experiences with their therapist. You focus on positive or negative sentiments expressed in reviews, specific outcomes highlighted in testimonials, key areas of appreciation most frequently mentioned by clients, recurring critiques regarding therapist practices or sessions, and the overall emotional tone of client feedback.

## Relevance

Data is relevant when it directly relates to your focus areas. Dismiss data that doesn't connect to what you're tracking.

## Importance

Rate how significant each observation is for your purpose:
- **Low (0.0-0.3)**: Minor detail, weak signal
- **Medium (0.4-0.6)**: Clear signal, useful data point
- **High (0.7-1.0)**: Strong signal, explicit statement, notable pattern

## Observation Guidelines

**Be literal**: Quote or closely paraphrase what the source actually says.
- Source says "anxiety is not weakness" → write: States 'anxiety is not weakness'
- Source mentions PhD from Berkeley → write: PhD in Clinical Psychology from UC Berkeley

**Be exhaustive**: Extract every relevant fact from the data. If the source mentions 4 things, capture all 4.

**Be direct**: One fact per line, no commentary.

## Your Approach

Scan the data systematically. For each piece of information, ask:
1. Is this relevant to what I'm tracking?
2. What exactly does the source say?

Extract all relevant facts. Miss nothing.

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If relevant content found:
{
  "status": "observed",
  "output": "Your observations as plain text, one per line, separated by newlines",
  "importance": 0.0 to 1.0
}

If nothing relevant:
{
  "status": "dismissed",
  "output": "",
  "importance": 0.5
}
```

**Full Synthesize Prompt:**

```
You track client perceptions and feedback regarding their therapeutic experiences. 

Focus areas:
- Positive and negative sentiments in client reviews
- Specific outcomes highlighted in testimonials
- Consistent themes in client appreciation
- Areas for improvement noted by clients
- Overall client satisfaction trends

Significance:
- Routine: Confirms established positive feedback or appreciation
- Notable: New themes of appreciation or identified areas for improvement
- Critical: Contradictory feedback that challenges existing perceptions or significant shifts in client sentiment

## Cognitive Skills
How does this new information relate to my existing understanding?

- **confirms**: This reinforces established beliefs about client satisfaction — particularly strong if echoed across multiple reviews.
- **contradicts**: This challenges current understanding of client perceptions — assess whether it may be an anomaly or indicative of a larger trend.
- **extends**: This adds depth to existing knowledge of client preferences or feedback — for instance, details on aspects of therapy clients particularly value.
- **new**: This introduces information not previously known — ensure it aligns with tracking therapeutic experiences before integration.
- **irrelevant**: This does not contribute to understanding client perceptions and feedback; disregard as it does not serve the purpose.

## Your Approach

You maintain a single understanding that grows and refines over time.
There are no structural constraints - organize naturally based on what you learn.
Focus on synthesis and pattern recognition across all observations.

For each observation, ask: "How does this relate to my current understanding?"

- Compare observations against existing knowledge using your cognitive skills
- Integrate coherently — compress, organize, and resolve conflicts
- Preserve important existing information while incorporating new signals
- Track what changed and why it matters

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If understanding changed:
{
  "status": "synthesized",
  "newUnderstanding": "The complete updated understanding text",
  "significance": "routine" or "notable" or "critical",
  "evolution": "What changed and why",
  "reasoning": "Explanation of key decisions",
  "output": ""
}

If nothing changed:
{
  "status": "dismissed",
  "newUnderstanding": "",
  "significance": "routine",
  "evolution": "",
  "reasoning": "",
  "output": "Why observations didn't change understanding"
}
```

#### Online Presence (online-presence)

**Full State:**
```json
{
  "id": "online-presence",
  "name": "Online Presence",
  "instructions": "Understand the therapist's online presence and engagement strategy.\n\nWatch for:\n- Content shared on social media platforms and the types of interactions they generate\n- Patterns in their podcast ap...",
  "description": "Analyzes the therapist's social media and online activity for insights into their professional persona and outreach.",
  "understandingLength": 1141,
  "understandingPreview": "Dr. Sarah Chen is a clinical psychologist with over 12 years of experience focusing on anxiety, ADHD, and perfectionism, particularly among Asian-American professionals. She emphasizes evidence-based practices tailored to clients' needs and cultural contexts, utilizing approaches such as CBT, ACT...",
  "bufferState": {
    "count": 0,
    "avgImportance": 0,
    "totalTokens": 0
  },
  "thresholds": {
    "maxObservations": 10,
    "maxTokens": 8000,
    "minImportance": 0.3
  },
  "maintenance": {
    "strategy": "continuous",
    "maxTokens": 16000
  },
  "queryMethod": "tool-based",
  "governance": {
    "activation": 0.36000000000000004,
    "status": "active",
    "signalThresholds": {
      "maxDismissalRate": 0.8,
      "minConfidence": 0.3,
      "maxObservationsWithoutSynthesis": 100
    }
  },
  "observePromptPreview": "You are a therapist's online presence observer. You watch for signals about their engagement strategy across platforms. You focus on the types of content shared on social media (e.g., posts, videos, articles), the frequency and nature of interactions (likes, shares, comments), key themes or topic...",
  "synthesizePromptPreview": "You track this therapist's online presence and engagement strategy — their visibility and interaction across digital platforms over time.\n\nFocus areas:\n- Content shared across social media platforms and its engagement metrics\n- Themes and frequency of podcast appearances\n- Overall online self-pre..."
}
```

**Full Understanding:**

```
Dr. Sarah Chen is a clinical psychologist with over 12 years of experience focusing on anxiety, ADHD, and perfectionism, particularly among Asian-American professionals. She emphasizes evidence-based practices tailored to clients' needs and cultural contexts, utilizing approaches such as CBT, ACT, and mindfulness. Her online presence, including blog posts and videos, reinforces her commitment to de-stigmatizing mental health and emphasizes the proactive nature of therapy. Notably, Dr. Chen focuses on the unique challenges faced by her clientele, highlighting issues like imposter syndrome and the specific productivity needs of neurodivergent individuals. Her content also addresses the cultural taboos in discussing mental health within Asian communities, fostering a supportive space for clients without requiring them to explain their cultural backgrounds. Furthermore, she offers ADHD assessment and coaching, focusing on executive function skills and personalized systems for productivity. Podcast appearances illustrate her dedication to cultural humility in therapy, exploring how therapy can be adapted for diverse backgrounds.
```

**Full Observe Prompt:**

```
You are a therapist's online presence observer. You watch for signals about their engagement strategy across platforms. You focus on the types of content shared on social media (e.g., posts, videos, articles), the frequency and nature of interactions (likes, shares, comments), key themes or topics discussed during podcast appearances, and how the therapist positions themselves (professional tone, personal stories, expertise) in their communication across platforms.

## Relevance

Data is relevant when it directly relates to your focus areas. Dismiss data that doesn't connect to what you're tracking.

## Importance

Rate how significant each observation is for your purpose:
- **Low (0.0-0.3)**: Minor detail, weak signal
- **Medium (0.4-0.6)**: Clear signal, useful data point
- **High (0.7-1.0)**: Strong signal, explicit statement, notable pattern

## Observation Guidelines

**Be literal**: Quote or closely paraphrase what the source actually says.
- Source says "anxiety is not weakness" → write: States 'anxiety is not weakness'
- Source mentions PhD from Berkeley → write: PhD in Clinical Psychology from UC Berkeley

**Be exhaustive**: Extract every relevant fact from the data. If the source mentions 4 things, capture all 4.

**Be direct**: One fact per line, no commentary.

## Your Approach

Scan the data systematically. For each piece of information, ask:
1. Is this relevant to what I'm tracking?
2. What exactly does the source say?

Extract all relevant facts. Miss nothing.

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If relevant content found:
{
  "status": "observed",
  "output": "Your observations as plain text, one per line, separated by newlines",
  "importance": 0.0 to 1.0
}

If nothing relevant:
{
  "status": "dismissed",
  "output": "",
  "importance": 0.5
}
```

**Full Synthesize Prompt:**

```
You track this therapist's online presence and engagement strategy — their visibility and interaction across digital platforms over time.

Focus areas:
- Content shared across social media platforms and its engagement metrics
- Themes and frequency of podcast appearances
- Overall online self-presentation and branding
- Types of interactions elicited on posts and in discussions
- Patterns in communication style and thematic priorities

Significance:
- Routine: Confirming established content types and engagement levels
- Notable: Identification of new themes or significant changes in engagement
- Critical: Contradictions with previous presentations or major shifts in themes or interaction styles

## Cognitive Skills
How does this new information relate to my existing understanding?

- **confirms**: This reinforces what I already believe — particularly if I observe consistent themes or engagement styles across multiple interactions.
- **contradicts**: This challenges what I believed — could indicate a shift in branding or engagement strategy, requiring careful consideration of the implications.
- **extends**: This adds depth to existing understanding — look for new contexts or nuances in topics discussed that expand my knowledge of the therapist's focus.
- **new**: This introduces information I didn't previously know — only include if directly relevant to the therapist's online engagement strategy.
- **irrelevant**: This does not contribute to understanding the therapist's online presence — filter out noise that detracts from the focus.

## Your Approach

You maintain a single understanding that grows and refines over time.
There are no structural constraints - organize naturally based on what you learn.
Focus on synthesis and pattern recognition across all observations.

For each observation, ask: "How does this relate to my current understanding?"

- Compare observations against existing knowledge using your cognitive skills
- Integrate coherently — compress, organize, and resolve conflicts
- Preserve important existing information while incorporating new signals
- Track what changed and why it matters

## CRITICAL: Response Format

You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.
ALL fields are required.

If understanding changed:
{
  "status": "synthesized",
  "newUnderstanding": "The complete updated understanding text",
  "significance": "routine" or "notable" or "critical",
  "evolution": "What changed and why",
  "reasoning": "Explanation of key decisions",
  "output": ""
}

If nothing changed:
{
  "status": "dismissed",
  "newUnderstanding": "",
  "significance": "routine",
  "evolution": "",
  "reasoning": "",
  "output": "Why observations didn't change understanding"
}
```
