# Multi-Agent LLM Systems: Curated Architecture Review

**The multi-agent LLM ecosystem has crystallized around a core insight: architecture determines reliability more than model choice.** Between 2023 and early 2026, foundational patterns for reasoning, memory, coordination, and evaluation of LLM agents emerged from top research labs and were battle-tested in production. This report curates the 12 highest-impact works, distills 10 architectural principles and 5 anti-patterns, provides 3 reference architectures, and maps a 7-day learning path. Every claim traces to a verified source. Unstructured multi-agent systems amplify errors **17.2×** while centralized coordination contains this to **4.4×** — the difference between a working system and an expensive failure.

---

## PART A — Top 12 papers, reports, and projects

### 1. ReAct: Synergizing Reasoning and Acting in Language Models

| Field | Detail |
|---|---|
| **Authors** | Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan, Yuan Cao |
| **Year / Venue** | 2022 / ICLR 2023 |
| **Type** | Paper |
| **arXiv** | 2210.03629 — https://arxiv.org/abs/2210.03629 |
| **GitHub** | https://github.com/ysymyth/ReAct (~700 stars) |
| **Citations** | ~4,800 (Semantic Scholar) |

**Core problem:** LLMs either reason without grounding (chain-of-thought hallucinations) or act without reasoning (blind tool calls). No unified framework existed to interleave the two.

**Key method:** Interleaves reasoning traces and task-specific actions within a single prompt loop — the model thinks, acts on the environment, observes the result, then thinks again. This grounds reasoning in real observations and enables dynamic re-planning.

**Evidence:** On ALFWorld, **+34% absolute success rate** over imitation-learning and reinforcement-learning baselines. On WebShop, **+10% absolute** with only 1–2 in-context examples. On HotpotQA/FEVER, overcomes chain-of-thought hallucination through API grounding.

**Actionable architectural decisions:** Implement the Thought → Action → Observation loop as the default single-agent reasoning pattern. Separate reasoning traces from action payloads in your logging schema. Use ReAct as the inner loop for each worker agent in a multi-agent system.

**Risks / boundary conditions:** Performance degrades when the observation space is noisy or tool outputs are ambiguous. Purely prompt-based — no weight updates — so the reasoning quality ceiling is the base model's capability. Token cost scales linearly with observation length.

| Dimension | Score |
|---|---|
| Novelty | 5 |
| Empirical Rigor | 4 |
| Reproducibility | 4 |
| Practical Validation | 4 |
| Architectural Insight | 5 |
| **Total** | **22** |

---

### 2. MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework

| Field | Detail |
|---|---|
| **Authors** | Sirui Hong, Mingchen Zhuge, Jonathan Chen, Xiawu Zheng, Yuheng Cheng, et al. (incl. Jürgen Schmidhuber) |
| **Year / Venue** | 2023 / ICLR 2024 (Oral, top 1.2%) |
| **Type** | Paper |
| **arXiv** | 2308.00352 — https://arxiv.org/abs/2308.00352 |
| **GitHub** | https://github.com/FoundationAgents/MetaGPT (~44,000 stars) |
| **Citations** | High (ICLR 2024 Oral) |

**Core problem:** Free-form multi-agent chat leads to cascading hallucinations — each agent's errors compound through downstream agents with no structural guardrails.

**Key method:** Encodes Standardized Operating Procedures (SOPs) as structured prompt sequences in an assembly-line paradigm. Agents play defined roles (Product Manager, Architect, Engineer) and must produce structured intermediate artifacts (requirements documents, interface specifications, flowcharts) before passing work downstream. The philosophy: **Code = SOP(Team)**.

**Evidence:** Achieves **85.9% Pass@1 on HumanEval** and **87.7% on MBPP** — state-of-the-art at time of publication. **100% task completion rate** on software projects. Outperforms AutoGPT, LangChain agents, AgentVerse, and ChatDev on software complexity handling.

**Actionable architectural decisions:** Mandate structured intermediate outputs (JSON schemas, interface specs) between agents rather than free-form text. Assign specialized roles with explicit output contracts. Use SOP-driven decomposition for any pipeline where quality control at each stage matters.

**Risks / boundary conditions:** SOPs must be designed per domain — the framework does not automatically discover optimal workflows. Performance depends on role prompts being well-calibrated. Overhead of structured artifacts is unnecessary for simple tasks.

| Dimension | Score |
|---|---|
| Novelty | 5 |
| Empirical Rigor | 4 |
| Reproducibility | 5 |
| Practical Validation | 4 |
| Architectural Insight | 5 |
| **Total** | **23** |

---

### 3. AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation

| Field | Detail |
|---|---|
| **Authors** | Qingyun Wu, Gagan Bansal, Jieyu Zhang, Yiran Wu, et al. (Microsoft Research, Penn State) |
| **Year / Venue** | 2023 / COLM 2024 |
| **Type** | Paper + Framework |
| **arXiv** | 2308.08155 — https://arxiv.org/abs/2308.08155 |
| **GitHub** | https://github.com/microsoft/autogen (~54,000 stars) |
| **Citations** | ~850+ (Semantic Scholar) |

**Core problem:** No unified programming model existed for defining flexible multi-agent interactions that can incorporate LLMs, tools, and humans in configurable conversation patterns.

**Key method:** Introduces "conversation programming" — defining agent interactions through both natural language and code. Agents are conversable, customizable entities that support LLM inference, tool execution, and human input. Supports two-agent chats, group chats with LLM-powered speaker selection, and nested conversations.

**Evidence:** Demonstrated across math problem-solving (outperforms GPT-4 + Wolfram Alpha plugin), retrieval-augmented QA, ALFWorld decision-making, multi-agent coding (OptiGuide), and conversational chess. In October 2025, Microsoft merged AutoGen with Semantic Kernel into the unified "Microsoft Agent Framework," validating its patterns at enterprise scale.

**Actionable architectural decisions:** Use conversable agent abstractions to decouple agent capabilities from orchestration logic. Implement group chat with dynamic speaker selection for open-ended collaborative tasks. Use nested conversations for hierarchical decomposition.

**Risks / boundary conditions:** Group chat with unconstrained speaker selection can lead to agent chatter and infinite loops. The framework is entering maintenance mode (bug fixes only) as Microsoft transitions to the Agent Framework. Token costs in multi-agent conversations scale rapidly.

| Dimension | Score |
|---|---|
| Novelty | 4 |
| Empirical Rigor | 4 |
| Reproducibility | 5 |
| Practical Validation | 4 |
| Architectural Insight | 5 |
| **Total** | **22** |

---

### 4. SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering

| Field | Detail |
|---|---|
| **Authors** | John Yang, Carlos E. Jimenez, Alexander Wettig, Kilian Lieret, Shunyu Yao, Karthik Narasimhan, Ofir Press |
| **Year / Venue** | 2024 / NeurIPS 2024 |
| **Type** | Paper |
| **arXiv** | 2405.15793 — https://arxiv.org/abs/2405.15793 |
| **GitHub** | https://github.com/SWE-agent/SWE-agent (~15,000 stars) |
| **Citations** | ~400+ (Semantic Scholar) |

**Core problem:** LLM agents interacting with computers use interfaces designed for humans (bash, raw file I/O), which are poorly suited for model-based interaction, leading to frequent errors in navigation, editing, and execution.

**Key method:** Introduces Agent-Computer Interfaces (ACI) — purpose-built interfaces analogous to HCI but designed for LLM agents. The custom ACI provides structured file viewing, search, and editing commands that reduce ambiguity and error rates. A mini variant (100 lines) demonstrates that interface design, not agent complexity, drives performance.

**Evidence:** **12.5% pass@1 on SWE-bench** (state-of-the-art at release). **87.7% on HumanEvalFix.** Later versions with Claude 3.7 achieved SoTA on SWE-bench full/verified. Mini-SWE-Agent (100 lines) achieves **65% on SWE-bench Verified**, demonstrating that ACI design is the dominant factor. Adopted by Meta, NVIDIA, and IBM.

**Actionable architectural decisions:** Design tool interfaces specifically for LLM consumption — clear output formats, bounded response sizes, unambiguous parameter schemas. Invest in ACI design before adding agent complexity. Provide agents with structured navigation commands rather than raw filesystem access.

**Risks / boundary conditions:** ACI design is domain-specific and requires iteration. Benchmark performance does not directly translate to production reliability on novel codebases. High token consumption per resolved issue.

| Dimension | Score |
|---|---|
| Novelty | 5 |
| Empirical Rigor | 4 |
| Reproducibility | 5 |
| Practical Validation | 5 |
| Architectural Insight | 4 |
| **Total** | **23** |

---

### 5. Generative Agents: Interactive Simulacra of Human Behavior

| Field | Detail |
|---|---|
| **Authors** | Joon Sung Park, Joseph C. O'Brien, Carrie J. Cai, Meredith Ringel Morris, Percy Liang, Michael S. Bernstein |
| **Year / Venue** | 2023 / UIST 2023 |
| **Type** | Paper |
| **arXiv** | 2304.03442 — https://arxiv.org/abs/2304.03442 |
| **GitHub** | https://github.com/joonspk-research/generative_agents |
| **Citations** | Highly cited (landmark paper) |

**Core problem:** LLM agents lacked persistent, structured memory that could support long-term believable behavior — remembering past events, synthesizing higher-order insights, and using memories to guide future action.

**Key method:** Introduces a three-component memory architecture: (1) **memory stream** — a complete natural-language log of all experiences, (2) **reflection** — periodic synthesis of observations into higher-level abstractions, and (3) **retrieval** — dynamic, relevance-weighted access combining recency, importance, and relevance scores. Twenty-five agents populate "Smallville" and exhibit emergent social behaviors.

**Evidence:** Ablation studies confirm that observation, planning, and reflection are each independently critical to agent believability. Emergent behaviors include spontaneous event organization (Valentine's Day party), information diffusion across the social network, and relationship memory maintenance — none explicitly programmed.

**Actionable architectural decisions:** Implement a three-tier memory system: raw event log, periodic reflection/summarization, and weighted retrieval. Use importance scoring to filter which memories enter long-term storage. Schedule reflection as a periodic background process, not on every interaction.

**Risks / boundary conditions:** Computational cost of maintaining full memory streams scales with agent count and time. Reflection quality depends on the base model's summarization capability. The Smallville environment is relatively simple compared to production settings.

| Dimension | Score |
|---|---|
| Novelty | 5 |
| Empirical Rigor | 4 |
| Reproducibility | 4 |
| Practical Validation | 3 |
| Architectural Insight | 5 |
| **Total** | **21** |

---

### 6. MemGPT: Towards LLMs as Operating Systems

| Field | Detail |
|---|---|
| **Authors** | Charles Packer, Sarah Wooders, Kevin Lin, Vivian Fang, Shishir G. Patil, Ion Stoica, Joseph E. Gonzalez |
| **Year / Venue** | 2023 (updated 2024) |
| **Type** | Paper + Framework |
| **arXiv** | 2310.08560 — https://arxiv.org/abs/2310.08560 |
| **GitHub** | Evolved into Letta — https://github.com/letta-ai/letta (~16,400 stars) |
| **Citations** | Substantial |

**Core problem:** LLMs have fixed context windows that cannot accommodate long conversation histories or large knowledge bases, creating a hard ceiling on agent memory capacity.

**Key method:** Borrows the virtual memory abstraction from operating systems. Implements hierarchical memory: **main context** (RAM — system prompt, working context, FIFO message queue), **recall storage** (searchable past messages), and **archival storage** (vector-indexed long-term knowledge). The agent manages its own memory via explicit function calls (`archival_memory_search`, `core_memory_append`, `conversation_search`), deciding what to page in and out.

**Evidence:** Significantly outperforms fixed-context baselines on deep memory retrieval tasks and multi-session chat coherence. Exceeds human-created conversation openers in similarity scores. Evolved into the Letta production platform with enterprise deployments.

**Actionable architectural decisions:** Implement explicit memory management as agent-callable tools rather than implicit context stuffing. Separate working memory (active context) from long-term storage with explicit read/write operations. Use FIFO eviction with summarization for the message queue to bound context usage.

**Risks / boundary conditions:** Self-managed memory adds latency (extra LLM calls for memory operations). Memory management failures (forgetting to save critical information, retrieving irrelevant memories) degrade gracefully but can compound over long sessions. The OS metaphor introduces complexity that is unnecessary for short, single-turn tasks.

| Dimension | Score |
|---|---|
| Novelty | 5 |
| Empirical Rigor | 4 |
| Reproducibility | 5 |
| Practical Validation | 4 |
| Architectural Insight | 5 |
| **Total** | **23** |

---

### 7. Reflexion: Language Agents with Verbal Reinforcement Learning

| Field | Detail |
|---|---|
| **Authors** | Noah Shinn, Federico Cassano, Ashwin Gopinath, Karthik Narasimhan, Shunyu Yao |
| **Year / Venue** | 2023 / NeurIPS 2023 |
| **Type** | Paper |
| **arXiv** | 2303.11366 — https://arxiv.org/abs/2303.11366 |
| **GitHub** | https://github.com/noahshinn/reflexion (~2,200 stars) |
| **Citations** | ~1,800 (Semantic Scholar) |

**Core problem:** LLM agents fail on tasks requiring trial-and-error learning but cannot update their weights at inference time. Traditional RL requires scalar rewards that discard rich failure information.

**Key method:** Introduces "verbal reinforcement learning" — after a failed attempt, the agent generates a natural-language self-reflection analyzing what went wrong and stores it in an episodic memory buffer. On subsequent attempts, the agent conditions on these reflections to avoid repeating mistakes. Three components: Actor, Evaluator, Self-Reflection model. **No gradient updates required.**

**Evidence:** Achieves **near-perfect completion on ALFWorld** (134 environments). State-of-the-art pass@1 on HumanEval coding. Self-reflection improves learning by **8% absolute** over episodic memory alone on HotPotQA. Also introduces LeetcodeHardGym benchmark (40 problems, 19 languages).

**Actionable architectural decisions:** Add a reflection step after agent failures — store structured failure analyses in persistent memory. Implement an evaluator module that provides binary success/fail signals plus rich feedback. Cap reflection iterations (diminishing returns typically after 2–3 rounds).

**Risks / boundary conditions:** Reflection quality is bounded by the model's self-evaluation accuracy — models that cannot diagnose their own failures will not improve. Memory buffer grows with each trial, consuming context. Performance gains plateau after a small number of reflection rounds.

| Dimension | Score |
|---|---|
| Novelty | 5 |
| Empirical Rigor | 4 |
| Reproducibility | 4 |
| Practical Validation | 3 |
| Architectural Insight | 4 |
| **Total** | **20** |

---

### 8. AgentBench: Evaluating LLMs as Agents

| Field | Detail |
|---|---|
| **Authors** | Xiao Liu, Hao Yu, Hanchen Zhang, et al. (Tsinghua University) |
| **Year / Venue** | 2023 / ICLR 2024 |
| **Type** | Paper + Benchmark |
| **arXiv** | 2308.03688 — https://arxiv.org/abs/2308.03688 |
| **GitHub** | https://github.com/THUDM/AgentBench (~2,600 stars) |
| **Citations** | ~500+ (Semantic Scholar) |

**Core problem:** No systematic, multi-dimensional benchmark existed to evaluate LLMs' capabilities as interactive agents across diverse environments — existing benchmarks tested isolated skills, not agent-level competence.

**Key method:** Constructs 8 distinct interactive environments spanning code interpretation, games (knowledge, card, lateral thinking), web interaction (shopping, browsing), database operations, and operating systems. Tests 29 LLMs (both API-based and open-source) using standardized evaluation protocols.

**Evidence:** Reveals a **significant performance gap** between commercial APIs (GPT-4 leading) and open-source models (≤70B parameters). Identifies poor long-term reasoning, decision-making, and instruction following as the three main obstacles. Demonstrates that instruction-tuning and high-quality multi-round alignment data are the most effective interventions.

**Actionable architectural decisions:** Evaluate agents across multiple interactive environments, not just single-task benchmarks. Separate evaluation of planning, tool use, and instruction following. Use AgentBench environments as regression tests when upgrading base models.

**Risks / boundary conditions:** Benchmark performance does not guarantee production reliability. The environments, while diverse, are still simplified compared to real-world deployment contexts. Rapid model improvement means leaderboard positions change frequently.

| Dimension | Score |
|---|---|
| Novelty | 4 |
| Empirical Rigor | 5 |
| Reproducibility | 5 |
| Practical Validation | 4 |
| Architectural Insight | 3 |
| **Total** | **21** |

---

### 9. STORM: Writing Wikipedia-like Articles via Multi-Perspective Research

| Field | Detail |
|---|---|
| **Authors** | Yijia Shao, Yucheng Jiang, Theodore A. Kanell, Peter Xu, Omar Khattab, Monica S. Lam |
| **Year / Venue** | 2024 / NAACL 2024 |
| **Type** | Paper + System |
| **arXiv** | 2402.14207 — https://arxiv.org/abs/2402.14207 |
| **GitHub** | https://github.com/stanford-oval/storm (~18,000 stars) |
| **Citations** | ~200+ (Semantic Scholar) |

**Core problem:** Long-form article generation suffers from shallow coverage and poor organization because existing approaches skip the critical pre-writing research stage — they generate text without first systematically gathering and structuring information from diverse perspectives.

**Key method:** STORM (Synthesis of Topic Outlines through Retrieval and Multi-perspective question asking) automates pre-writing through three stages: (1) discovering diverse expert perspectives via Wikipedia-grounded profiling, (2) simulating multi-perspective expert conversations grounded in web sources, and (3) curating information into structured outlines before generating full articles with inline citations.

**Evidence:** Evaluated by experienced Wikipedia editors on the FreshWiki dataset. STORM articles are **25% more organized** and **10% broader in coverage** versus outline-driven RAG baselines. **70% of editors** found it useful for pre-writing research. Over 70,000 people tried the live system.

**Actionable architectural decisions:** Use multi-perspective simulation (multiple expert "personas" asking different questions) to ensure breadth of coverage before synthesis. Ground agent conversations in retrieved sources to prevent hallucination. Separate the research/outline phase from the generation phase.

**Risks / boundary conditions:** Quality depends heavily on the retrieval system's coverage. Multi-perspective simulation increases token costs significantly. The approach is designed for knowledge synthesis tasks and does not generalize to all agent use cases.

| Dimension | Score |
|---|---|
| Novelty | 4 |
| Empirical Rigor | 4 |
| Reproducibility | 5 |
| Practical Validation | 4 |
| Architectural Insight | 4 |
| **Total** | **21** |

---

### 10. Why Do Multi-Agent LLM Systems Fail?

| Field | Detail |
|---|---|
| **Authors** | Mert Cemri, Melissa Z. Pan, Shuyi Yang, et al. (UC Berkeley, Intesa Sanpaolo) |
| **Year / Venue** | 2025 / arXiv |
| **Type** | Paper |
| **arXiv** | 2503.13657 — https://arxiv.org/abs/2503.13657 |
| **GitHub** | https://github.com/multi-agent-systems-failure-taxonomy/MASFT |
| **Citations** | Growing (March 2025 preprint) |

**Core problem:** Multi-agent LLM systems fail at alarmingly high rates (41–87%), but no systematic taxonomy existed to categorize, diagnose, or prevent these failures.

**Key method:** Introduces the Multi-Agent System Failure Taxonomy (MASFT) by analyzing **150+ execution traces** across 5 production frameworks (MetaGPT, ChatDev, HyperAgent, AppWorld, AG2) with GPT-4o and Claude-3. Identifies **14 distinct failure modes** in 3 categories: system design issues, inter-agent misalignment, and task verification/termination failures.

**Evidence:** **Coordination breakdowns account for 36.9% of all failures** — the single largest category. Approximately **79% of problems stem from specification and coordination**, not technical implementation bugs. Even with improved specifications and orchestration strategies, only a **+14% improvement** for ChatDev was observed, indicating fundamental design flaws in current MAS approaches, not just prompt-level issues.

**Actionable architectural decisions:** Treat agent role specifications as machine-validatable schemas (JSON), not prose. Implement format compatibility checks between agent outputs and downstream inputs. Add termination conditions with hard iteration caps. Monitor for the 14 MASFT failure modes as observability metrics.

**Risks / boundary conditions:** The taxonomy was developed on a specific set of frameworks and may not capture all failure modes in novel architectures. The finding that simple fixes are insufficient suggests that current multi-agent paradigms may need fundamental redesign for reliability-critical applications.

| Dimension | Score |
|---|---|
| Novelty | 5 |
| Empirical Rigor | 4 |
| Reproducibility | 4 |
| Practical Validation | 5 |
| Architectural Insight | 5 |
| **Total** | **23** |

---

### 11. Towards a Science of Scaling Agent Systems (Google DeepMind)

| Field | Detail |
|---|---|
| **Authors** | Yubin Kim et al. (Google Research, Google DeepMind, MIT) |
| **Year / Venue** | 2025 |
| **Type** | Paper |
| **arXiv** | 2512.08296 — https://arxiv.org/abs/2512.08296 |
| **Blog** | https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/ |

**Core problem:** No principled guidelines existed for when multi-agent systems help versus hurt — practitioners lacked quantitative rules for choosing architectures, agent counts, and coordination strategies.

**Key method:** Conducts a controlled study across **180 configurations**, **5 architectures**, **3 LLM families**, and **4 benchmarks** to establish empirical scaling laws for multi-agent systems. Measures error amplification, coordination overhead, and performance saturation across parallelizable vs. sequential tasks.

**Evidence:** **Independent agents amplify errors 17.2×**; centralized coordination contains this to **4.4×**. Performance **saturates at ~4 agents** — beyond this, coordination overhead consumes benefits. The **45% rule**: if single-agent accuracy exceeds 45%, multi-agent coordination typically degrades performance. Centralized coordination improves performance by **80.8% on parallelizable tasks**. For sequential reasoning, **all multi-agent variants degraded performance by 39–70%**.

**Actionable architectural decisions:** Default to centralized coordination (supervisor-worker) over decentralized peer-to-peer. Cap agent count at 4 unless the task is embarrassingly parallel. Benchmark single-agent performance first — add agents only when single-agent accuracy is below 45%. Use multi-agent systems only for parallelizable subtasks; keep sequential reasoning in a single agent.

**Risks / boundary conditions:** Results are derived from specific benchmark tasks and may not generalize to all domains. The 45% threshold is an empirical observation, not a theoretical guarantee. Real-world tasks often mix parallel and sequential components, complicating direct application of these rules.

| Dimension | Score |
|---|---|
| Novelty | 5 |
| Empirical Rigor | 5 |
| Reproducibility | 4 |
| Practical Validation | 4 |
| Architectural Insight | 5 |
| **Total** | **23** |

---

### 12. Building Effective Agents (Anthropic)

| Field | Detail |
|---|---|
| **Authors** | Erik Schluntz, Barry Zhang (Anthropic) |
| **Year / Venue** | December 2024 / Official engineering blog |
| **Type** | Official technical blog |
| **URL** | https://www.anthropic.com/research/building-effective-agents |
| **Companion posts** | Multi-agent research system (June 2025): https://www.anthropic.com/engineering/multi-agent-research-system ; Effective context engineering: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents ; Writing effective tools: https://www.anthropic.com/engineering/writing-tools-for-agents ; Demystifying evals: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents |

**Core problem:** Practitioners over-engineer agent systems with unnecessary complexity, while lacking a coherent taxonomy of production-ready patterns.

**Key method:** Draws a critical distinction between **workflows** (LLMs orchestrated through predefined code paths) and **agents** (LLMs dynamically directing their own processes). Identifies **5 composable workflow patterns**: prompt chaining, routing, parallelization, orchestrator-workers, and evaluator-optimizer. Establishes the principle: "start with the simplest solution possible."

**Evidence:** Derived from Anthropic's production experience building Claude's research feature. Their multi-agent research system achieved **90.2% improvement over single Claude Opus 4** on BrowseComp. Token volume accounts for **~80% of task success**. Multi-agent systems use **~15× more tokens** than single-agent chat. The June 2025 companion post details the orchestrator-worker architecture used in production with specific metrics on effort scaling.

**Actionable architectural decisions:** Begin with augmented LLM + tools, then prompt chaining, then routing — add multi-agent orchestration only when simpler patterns fail. Design tools as contracts between deterministic systems and non-deterministic agents. Use Model Context Protocol (MCP) for standardized tool integration. Implement eval-driven development with LLM-as-judge and deterministic graders.

**Risks / boundary conditions:** Recommendations are shaped by Anthropic's specific model capabilities and may not transfer fully to weaker models. The "start simple" advice, while sound, can delay adoption of multi-agent patterns that are genuinely needed for complex workflows.

| Dimension | Score |
|---|---|
| Novelty | 4 |
| Empirical Rigor | 3 |
| Reproducibility | 4 |
| Practical Validation | 5 |
| Architectural Insight | 5 |
| **Total** | **21** |

---

## Consolidated scoring table

| # | Work | Novelty | Rigor | Repro | Practical | Arch. Insight | Total |
|---|---|---|---|---|---|---|---|
| 1 | ReAct | 5 | 4 | 4 | 4 | 5 | **22** |
| 2 | MetaGPT | 5 | 4 | 5 | 4 | 5 | **23** |
| 3 | AutoGen | 4 | 4 | 5 | 4 | 5 | **22** |
| 4 | SWE-agent | 5 | 4 | 5 | 5 | 4 | **23** |
| 5 | Generative Agents | 5 | 4 | 4 | 3 | 5 | **21** |
| 6 | MemGPT | 5 | 4 | 5 | 4 | 5 | **23** |
| 7 | Reflexion | 5 | 4 | 4 | 3 | 4 | **20** |
| 8 | AgentBench | 4 | 5 | 5 | 4 | 3 | **21** |
| 9 | STORM | 4 | 4 | 5 | 4 | 4 | **21** |
| 10 | Why Do MAS Fail? | 5 | 4 | 4 | 5 | 5 | **23** |
| 11 | Scaling Agent Systems | 5 | 5 | 4 | 4 | 5 | **23** |
| 12 | Building Effective Agents | 4 | 3 | 4 | 5 | 5 | **21** |

---

## PART B — Architecture design principles, anti-patterns, and reference architectures

### 10 actionable system design principles

**Principle 1: Start with augmented LLM, not multi-agent.** Add agents only when a single model with tools demonstrably fails. Anthropic's "Building Effective Agents" blog and OpenAI's "Practical Guide to Building Agents" both converge on this as the #1 recommendation. Premature multi-agent complexity is the most common architectural mistake.

**Principle 2: Architecture determines reliability more than model choice.** Google DeepMind's scaling study (arXiv 2512.08296) proves that topology — centralized vs. decentralized, parallel vs. sequential — predicts success better than which LLM you deploy. Choose architecture first, model second.

**Principle 3: Cap agent count at 4 unless tasks are embarrassingly parallel.** The same DeepMind study establishes that coordination overhead consumes benefits beyond ~4 agents. The **45% rule** provides a quantitative gate: if a single agent exceeds 45% accuracy, multi-agent coordination likely hurts.

**Principle 4: Mandate structured intermediate outputs between agents.** MetaGPT's core insight — and the MASFT failure taxonomy's largest finding — is that free-form text between agents causes cascading failures. Define JSON schemas for inter-agent messages. Output format incompatibility causes 79% of multi-agent failures.

**Principle 5: Design tools for LLM consumption, not human consumption.** SWE-agent demonstrates that Agent-Computer Interface design is the dominant factor in agent performance — more important than agent architecture. Consolidate functionality into fewer, well-documented tools with clear parameter schemas, bounded output sizes, and unambiguous return formats. Anthropic's tool design guide reinforces this.

**Principle 6: Implement hierarchical memory with explicit read/write operations.** Combine Generative Agents' three-tier architecture (stream → reflection → retrieval) with MemGPT's explicit memory management functions. Separate working memory (active context), episodic memory (searchable past interactions), and semantic memory (long-term knowledge). Make memory operations agent-callable tools.

**Principle 7: Add reflection loops with hard iteration caps.** Reflexion shows that verbal self-reflection significantly improves agent performance, but diminishing returns set in after 2–3 rounds. Implement evaluator + self-reflection as a standard module, but enforce token budgets and iteration limits to prevent infinite loops.

**Principle 8: Use a deterministic backbone with agent intelligence at specific steps.** CrewAI's production architecture (Flows + Crews) and LangGraph's graph-based state machine both implement this pattern: deterministic orchestration handles control flow, routing, and state management, while LLM agents are invoked only at decision points requiring reasoning flexibility.

**Principle 9: Implement distributed tracing from day one.** Without structured observability, debugging multi-agent systems is intractable. Use LangSmith, Langfuse, or OpenTelemetry-based tooling to trace every LLM call, tool execution, and routing decision. Track token usage, latency, error rates, and agent loop counts per execution.

**Principle 10: Calculate compound reliability before deploying.** System reliability = product of per-step reliabilities. A 10-step pipeline with 95% per-step reliability yields only **59.9%** system reliability. A 20-step pipeline: **35.8%**. This mathematical reality means every additional agent step must justify itself against the reliability cost.

### 5 common anti-patterns

**Anti-pattern 1: Coordinator overload.** All decisions route through a single supervisor agent, recreating a monolithic bottleneck. The supervisor becomes a single point of failure with context bloat. **Mitigation:** Use hierarchical delegation with bounded autonomy — supervisors set goals and review results; workers make tactical decisions independently within their domain.

**Anti-pattern 2: Agent chatter and infinite loops.** Agents exchange messages without convergence criteria, consuming tokens without progress. The MASFT taxonomy identifies this as a top failure mode, found in 36.9% of failures. **Mitigation:** Implement hard iteration caps, convergence detection (e.g., semantic similarity of consecutive outputs), and explicit termination conditions. Monitor agent loop counts as a key observability metric.

**Anti-pattern 3: Tool hallucination.** Agents invoke non-existent tools, fabricate parameters, or misinterpret tool outputs. Research shows that enhancing reasoning via RL *increases* tool hallucination proportionally (arXiv 2510.22977), revealing a fundamental capability-reliability tradeoff. **Mitigation:** Validate tool calls against a schema before execution. Limit available tools to the minimum needed per agent. Use tool receipts (arXiv 2603.10060) for output verification.

**Anti-pattern 4: Context dumping.** Placing large data payloads directly into chat history, creating a permanent token tax on every subsequent inference call. Google ADK documentation specifically warns against this. **Mitigation:** Use the "Artifacts" pattern — store large data externally and pass handles/summaries in context. Implement explicit context lifecycle management.

**Anti-pattern 5: Premature multi-agent complexity.** Deploying multi-agent orchestration before validating that a single agent with tools is insufficient. Gartner predicts **40%+ of agentic AI projects will be canceled by 2027**, largely due to unjustified complexity. **Mitigation:** Always benchmark single-agent performance first. Document the specific failure mode that justifies adding each new agent. Apply the 45% rule from Google DeepMind's study.

### 3 reference architectures

#### Tier 1 — Lightweight: Single Agent + Tools (ReAct-based)

**Module description:** One LLM agent operates in a ReAct loop (Think → Act → Observe) with access to 3–10 specialized tools. No inter-agent communication needed.

**Task flow:** User query → Agent receives query + system prompt → Agent enters reasoning loop → Agent selects and calls tools → Tool returns observation → Agent continues reasoning or produces final answer → Response to user.

**Key interfaces:** Tool interface (JSON schema with name, description, parameters, return type). Memory interface (conversation history as FIFO buffer with optional summarization). Output interface (structured response format).

**Observability metrics:** Tokens per request, tool call count per request, tool error rate, time-to-first-response, reasoning loop count, task completion rate.

**When to use:** Well-defined single-domain tasks, fewer than 10 tools, latency-sensitive applications. This should be the default starting point.

**Frameworks:** OpenAI Agents SDK (single agent), LangGraph (single node), any ReAct implementation.

#### Tier 2 — Medium: Supervisor + Workers

**Module description:** A central supervisor agent handles planning and routing. Two to four specialized worker agents handle execution in distinct domains. Workers may use cheaper/faster models than the supervisor. Optional evaluator agent provides quality checks.

**Task flow:** User query → Supervisor decomposes task into subtasks → Supervisor delegates to appropriate worker via structured message → Worker executes using domain-specific tools → Worker returns structured result → Supervisor synthesizes results (optionally routes to evaluator) → Final response to user.

**Key interfaces:** Delegation interface (task specification schema: goal, constraints, tools_available, output_format). Result interface (structured response with status, confidence, artifacts). Routing interface (supervisor uses function-calling to select worker). State interface (shared state store with read/write permissions per agent).

**Observability metrics:** All Tier 1 metrics plus: delegation count per query, worker utilization rates, inter-agent message count, supervisor reasoning token overhead, end-to-end latency breakdown by agent, re-delegation rate (tasks sent back for rework).

**When to use:** Cross-domain tasks requiring 2–4 distinct skill sets, content pipelines with review stages, customer support with escalation paths. Apply the 45% rule: only if single-agent performance is below 45%.

**Frameworks:** LangGraph supervisor pattern, CrewAI hierarchical process, Google ADK Coordinator pattern.

#### Tier 3 — Production: Full Orchestration with Deterministic Backbone

**Module description:** A deterministic orchestration layer (state machine / DAG) controls the overall workflow. Agent intelligence is injected at specific decision points. Full state persistence with checkpointing enables failure recovery. Human-in-the-loop approval gates protect high-risk actions. Distributed tracing covers every step. Guardrails (input validation, output verification, safety filters) wrap each agent.

**Task flow:** User query → Deterministic router classifies intent → State machine selects workflow graph → Orchestrator initializes state and spawns agent steps → Each agent step: guardrail check → LLM reasoning → tool execution → output validation → state update → checkpoint → Approval gates trigger for high-risk actions → Human reviews if needed → Results aggregate through defined merge nodes → Final quality check → Response to user → Telemetry exported to observability platform.

**Key interfaces:** Workflow definition (DAG with typed edges: data edges, control edges, conditional edges). State schema (versioned, typed state object persisted to database). Checkpoint interface (save/restore full execution state). Guardrail interface (pre/post processing hooks per agent step). Approval gate interface (pause execution, notify human, resume on approval). Telemetry interface (OpenTelemetry spans per agent step with custom attributes).

**Observability metrics:** All Tier 1 + Tier 2 metrics plus: checkpoint count, recovery rate (successful resumes from failure), human intervention rate, guardrail trigger rate by type, cost per execution (total tokens × price), SLA compliance (% of requests completing within target latency), error propagation depth (how far a single error cascades before detection).

**When to use:** Regulated industries, customer-facing applications requiring reliability guarantees, workflows with financial or safety implications. Production case studies: Klarna uses LangGraph for **2.3M conversations/month** (700 agent workload, reported **$60M savings**). DocuSign uses CrewAI Flows + Crews.

**Frameworks:** LangGraph (graph-based state machines with checkpointing), CrewAI (Flows + Crews), Microsoft Agent Framework (AutoGen + Semantic Kernel convergence, GA targeted Q1 2026).

---

## PART C — 7-day learning roadmap

### Day 1: Foundations of agent reasoning

**Read:** ReAct paper (arXiv 2210.03629) + Reflexion paper (arXiv 2303.11366). Skim the CoALA survey (arXiv 2309.02427) sections 1–3 for the conceptual framework.

**Output:** A 1-page diagram mapping the Observe → Think → Act loop and the Reflexion self-correction loop. Annotate where each module (LLM, tools, memory, evaluator) sits in the architecture.

**Verification task:** Implement a minimal ReAct agent using the OpenAI API with 2 tools (web search + calculator). Run it on 5 HotpotQA questions. Log every thought, action, and observation. Calculate success rate.

### Day 2: Memory architectures

**Read:** Generative Agents paper (arXiv 2304.03442) + MemGPT paper (arXiv 2310.08560). Skim the A-MEM paper (arXiv 2502.12110) for the Zettelkasten approach.

**Output:** A comparison table of 3 memory architectures: Generative Agents (stream + reflection + retrieval), MemGPT (RAM/disk hierarchy), A-MEM (dynamic linking). Columns: memory types, read/write mechanisms, scalability, latency tradeoffs.

**Verification task:** Extend the Day 1 agent with a simple episodic memory — store past query-answer pairs in a vector database and retrieve relevant ones before reasoning. Compare performance with and without memory on 5 multi-hop questions.

### Day 3: Multi-agent frameworks and patterns

**Read:** MetaGPT paper (arXiv 2308.00352) + AutoGen paper (arXiv 2308.08155). Read Anthropic's "Building Effective Agents" blog (https://www.anthropic.com/research/building-effective-agents).

**Output:** A decision tree: "When should I use single-agent vs. multi-agent?" Incorporate the 45% rule, the 4-agent threshold, and Anthropic's 5 workflow patterns. Include specific examples for each branch.

**Verification task:** Using LangGraph or CrewAI, build a 2-agent system (planner + executor) for a simple task (e.g., research a topic and write a structured summary). Compare output quality and token cost against a single-agent baseline.

### Day 4: Tool design and agent-computer interfaces

**Read:** SWE-agent paper (arXiv 2405.15793) + Anthropic's "Writing Effective Tools" blog (https://www.anthropic.com/engineering/writing-tools-for-agents). Skim Toolformer (arXiv 2302.04761) sections 1–3.

**Output:** A tool design checklist (10 items) based on SWE-agent's ACI principles and Anthropic's tool design guidelines. Include: naming conventions, parameter schema requirements, output format constraints, error handling patterns.

**Verification task:** Take the Day 3 multi-agent system and redesign one tool interface following the ACI principles. Measure whether the redesigned interface reduces tool call errors or improves task completion.

### Day 5: Evaluation and benchmarking

**Read:** AgentBench paper (arXiv 2308.03688) + STORM paper (arXiv 2402.14207). Skim Anthropic's "Demystifying Evals" blog (https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).

**Output:** An evaluation framework design for your Day 3 system: define 3 deterministic metrics and 2 LLM-as-judge metrics. Specify ground truth collection, grading rubrics, and statistical significance requirements.

**Verification task:** Implement the evaluation framework and run it on 10 test cases. Calculate inter-rater reliability between your LLM-judge and your own manual assessment. Iterate on the grading prompt until agreement exceeds 80%.

### Day 6: Failure modes, safety, and reliability

**Read:** "Why Do Multi-Agent LLM Systems Fail?" (arXiv 2503.13657) + Google DeepMind scaling study (arXiv 2512.08296). Skim "The Reasoning Trap" (arXiv 2510.22977) on tool hallucination.

**Output:** A failure mode checklist based on the 14 MASFT categories, annotated with monitoring strategies for each. Add compound reliability calculations for your Day 3 system (per-step reliability × number of steps).

**Verification task:** Deliberately inject 3 types of failures into your Day 3 system (wrong tool schema, ambiguous role specification, missing termination condition). Observe and document how the system fails. Classify each failure using the MASFT taxonomy. Design and implement one mitigation.

### Day 7: Production architecture and synthesis

**Read:** Anthropic's multi-agent research system post (https://www.anthropic.com/engineering/multi-agent-research-system) + Google's design patterns documentation (https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system). Review the 3 reference architectures from this report.

**Output:** A complete architecture document for a production multi-agent system in your domain of interest. Include: module diagram, state schema, tool interfaces, observability plan, failure mode mitigations, cost model (estimated tokens per request × pricing), and a "complexity budget" justifying each agent.

**Verification task:** Conduct a trade-off analysis comparing 3 implementation options for your architecture: (a) single agent with complex tools, (b) supervisor + 2 workers, (c) full deterministic backbone + 4 agents. For each option, estimate: reliability (compound calculation), cost (token estimate), latency, and development effort. Select and justify one option. Present your analysis to a peer or write it up as a 2-page design document.

---

## Notable works that scored 17 or below threshold but merit awareness

Several candidate works scored below the ≥18 threshold but remain relevant for specific use cases. **"More Agents Is All You Need"** (arXiv 2402.05120, TMLR 2024) demonstrates that simple sampling-and-voting scales LLM performance with agent count — a useful baseline but limited architectural insight (total: 17). **CAMEL** (arXiv 2303.17760, NeurIPS 2023) pioneered role-playing agent communication via inception prompting but has weaker empirical validation (total: 18 — borderline). **ChatDev** (arXiv 2307.07924, ACL 2024) demonstrated end-to-end software development in under 7 minutes at ~$0.30 per project, with ChatDev 2.0 launched in January 2026 (total: 21 — strong but overlaps significantly with MetaGPT's territory). **WebArena** (arXiv 2307.13854, ICLR 2024) provides the most realistic web agent benchmark, showing GPT-4 achieves only **14.4%** task success versus human **78.2%** — essential for anyone building web-interaction agents.

## Key protocols and standards emerging in 2025–2026

The agent ecosystem is converging on three interoperability standards. **Model Context Protocol (MCP)** by Anthropic standardizes tool integration — agents connect to tools through a universal interface, analogous to USB for AI. **Agent-to-Agent Protocol (A2A)** by Google enables cross-framework agent communication and discovery. **AgentOrchestra's TEA Protocol** (arXiv 2506.12508) extends both with Tool Context Protocol, Environment Context Protocol, and Agent Context Protocol for richer inter-agent coordination. These three standards are complementary, not competing: MCP handles tool connections, A2A handles agent discovery, and TEA handles complex multi-agent orchestration. 证据不足 (insufficient evidence) on whether these standards will converge or fragment further.

## The compound reliability problem defines the field's frontier

The single most important quantitative insight across all 12 works is the compound reliability equation. A system with **n** sequential steps and per-step reliability **p** has overall reliability **p^n**. At 95% per-step with 10 steps, you get 59.9%. At 20 steps, 35.8%. This mathematical reality, combined with Google DeepMind's finding that unstructured agents amplify errors **17.2×**, means that the field's frontier is not about making agents smarter — it is about making multi-agent orchestration more reliable. The winning pattern emerging from production deployments is clear: **deterministic backbone + bounded agent intelligence + mandatory structured interfaces + comprehensive observability**. Every additional degree of agent autonomy must be earned through demonstrated reliability on evaluation suites, not assumed from benchmark performance.