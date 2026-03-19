# Message-Driven多智能体决策流程向Task-Ledger/Typed-State驱动系统的演进研究报告

## 执行摘要

本研究报告针对Round Table（以下简称RT）产品的架构演进需求，深入分析了从传统的Message-Driven模式向Task-Ledger与Typed-State驱动模式转型的技术路径。研究的核心问题在于：RT作为一款不执行代码的决策产品，如何在不使用完整DAG运行时的情况下，实现状态可恢复性、对话回放、跟进续话等关键功能。

经过对Magentic-One双账本架构、LangGraph类型化状态管理机制以及相关工程实践的系统性调研，本报告得出以下核心结论：**RT应当采用最小化的Task Ledger设计，而非照搬Magentic-One的完整双账本模式**。具体而言，RT的Task Ledger应当包含五个核心字段：任务目标、当前阶段、已收集证据、决策草案和阶段状态指针。这一设计能够在保持状态可追溯性的同时，避免引入与代码执行相关的复杂性。

关于Progress Ledger的必要性，本报告认为RT不需要独立的Progress Ledger。现有的Magentic-One Progress Ledger设计主要服务于代码执行场景中的任务监控和停滞检测，而RT作为决策场景，其进度信息可以内嵌到Task Ledger的阶段状态字段中，通过阶段转换日志来实现类似的功能。

在运行时架构方面，本报告明确指出：为RT引入完整的LangGraph或类似DAG运行时属于过度工程。RT应当采用基于有限状态机（Finite State Machine，FSM）的轻量级流程引擎，仅支持必要的阶段转换逻辑，而非通用的图计算框架。

关于迁移策略，本报告提出了一条渐进式迁移路径：从现有的AllMessages历史记录系统逐步演进为Ledger驱动的架构，具体分为三个阶段——影子账本阶段、混合驱动阶段和账本优先阶段。

## 已验证的发现

### Magentic-One双账本架构的核心要素

Magentic-One作为微软推出的通用多智能体系统，其核心创新在于Orchestrator代理通过双账本机制管理任务执行。第一个账本称为Task Ledger（任务账本），其核心功能是存储已知事实（known facts）、假设（assumptions）和任务计划（task plan）。这个账本在任务初始化时创建，并在任务执行过程中根据新的观察和推理进行更新。

第二个账本称为Progress Ledger（进度账本），它在每个执行步骤中都会进行更新，用于检查任务完成情况、监控整体进度，并记录是否有任何子代理需要重新分配。这种设计体现了Magentic-One对任务执行状态精细化管理的追求。

值得注意的是，Magentic-One还实现了Stall Detection（停滞检测）机制。如果任务停滞超过两个执行周期，Orchestrator会自动修改Task Ledger和执行计划。这一机制对于处理复杂多步骤任务中的失败恢复至关重要。

然而，必须认识到Magentic-One的设计目标与RT存在本质差异。Magentic-One专注于开放式的代码执行和网络浏览任务，其四个专业代理（WebSurfer、FileSurfer、Coder、ComputerTerminal）都围绕代码执行和文件操作展开。这意味着其双账本架构中的相当部分设计——如代码执行状态、文件操作跟踪、终端会话管理——对于不执行代码的RT决策产品而言并不适用。

### LangGraph类型化状态管理的核心机制

LangGraph采用了与Magentic-One不同的状态管理策略，其核心设计围绕Typed State（类型化状态）展开。LangGraph使用TypedDict或Pydantic BaseModel来定义状态结构，所有节点都读写同一个状态对象，整个图维护统一的状态，通过类型定义来包含多个子状态或字段。

LangGraph的持久化机制通过Checkpointers实现。当使用Checkpointer编译图时，系统会在每个超级步骤（super-step）保存图状态的检查点。这些检查点被保存到线程（thread）中，可以在图执行后访问。每个检查点本质上是一个StateSnapshot对象，包含以下关键属性：config（与此检查点关联的配置）、metadata（元数据）、values（状态通道的值）、next（接下来要执行的节点名称）、tasks（包含待执行任务信息的PregelTask对象）。

LangGraph的持久化机制支持几个关键特性：人机交互（Human-in-the-loop）、记忆功能、时间旅行（Time Travel）和容错性。其中，interrupt函数是实现人机交互的核心，它允许图在特定节点暂停、向人类展示信息，并使用人类的输入恢复图形执行。

LangGraph支持多种Checkpointer实现，包括MemorySaver（内存存储，适用于开发和测试）、SqliteSaver（SQLite数据库存储）和PostgresSaver（PostgreSQL存储，适用于生产环境）。

### Message History与Explicit State的权衡

传统Message-Driven模式的核心问题在于状态隐式化。当所有状态都存储在消息历史中时，LLM需要在每次推理时从完整的对话记录中提取当前状态，这导致了几个显著问题：上下文膨胀导致的Token消耗剧增、状态提取的不确定性、以及难以实现精确的状态回滚和恢复。

显式状态对象（Explicit State Object）通过将关键状态信息结构化地存储在独立的数据结构中来解决这些问题。然而，这并非没有代价：状态同步需要额外维护、状态表示的设计需要预先定义、以及过度结构化可能限制LLM的灵活性。

一个关键的权衡在于：完全依赖Message History意味着每次推理都需要重新总结状态，这不仅消耗大量Token，而且LLM对状态的理解可能不一致。完全依赖显式状态则可能丢失对话中的细微信息，而这些信息可能对后续推理有价值。

## 状态模型对比

### 三种状态模型的特征分析

经过深入研究，本报告识别出三种主要的状态模型，各有其适用场景和局限性。

第一种是纯Message-Driven模型。该模型将所有交互存储为消息列表，状态通过消息序列隐式表达。其优势在于实现简单、与LLM原生对话模式一致、以及灵活度高。劣势包括上下文膨胀导致Token成本上升、状态提取的不确定性、以及缺乏显式的状态转换控制。在RT的现有架构中，这种模型表现为AllMessages或History列表。

第二种是Magentic-One双账本模型。该模型将任务规划（Task Ledger）与执行进度（Progress Ledger）分离，通过Orchestrator统一管理。其优势在于明确区分了任务目标和执行状态、支持细粒度的进度跟踪和停滞检测、以及提供了结构化的任务状态表示。劣势在于设计复杂、与代码执行场景强耦合、以及Progress Ledger在非代码执行场景中可能过度设计。在RT场景中，这种模型需要大幅简化。

第三种是LangGraph类型化状态模型。该模型使用强类型定义状态结构，通过Checkpointer实现状态持久化，支持时间旅行和状态恢复。其优势在于类型安全、状态持久化标准化、支持丰富的状态操作。劣势在于需要预先定义完整的状态模式、运行时开销相对较高、以及完整功能需要外部存储支持。在RT场景中，这种模型的部分理念（类型化状态、检查点）可以借鉴，但完整引入则属于过度工程。

### RT场景的特殊性分析

RT作为决策产品，与Magentic-One等通用Agent系统存在本质差异。RT的核心特征包括：不执行代码，仅进行多阶段讨论和决策；Human-in-the-loop是核心交互模式，Moderator引导整个流程；关注状态正确性（State Correctness）和可恢复性（Recoverability）而非自主性（Autonomy）；Token效率是核心优化目标。

这些特征决定了RT不能简单套用任何一种现有模型，而需要汲取各模型的核心思想，设计适合自身场景的定制化方案。

## RT最小Task Ledger设计

### 核心字段定义

基于对Magentic-One和LangGraph的分析，以及对RT场景特殊性的理解，本报告提出RT的最小Task Ledger应当包含以下五个核心字段。

第一个字段是Objective（任务目标），类型为字符串，用于存储决策任务的全局目标。这是Task Ledger的锚点，确保所有阶段都围绕统一目标展开。在RT中，这个字段对应用户发起讨论时的问题或决策请求。

第二个字段是CurrentPhase（当前阶段），类型为枚举或字符串，用于标识当前处于哪个讨论阶段。RT的典型阶段包括：问题澄清（Clarification）、证据收集（Evidence Collection）、方案讨论（Discussion）、方案评估（Evaluation）和决策（Decision）。这个字段替代了Magentic-One中的复杂Progress Ledger，提供简洁的进度指示。

第三个字段是EvidenceCollected（已收集证据），类型为结构化数组，用于存储讨论过程中收集的关键证据。每个证据条目应包含：证据内容、来源（发言者）、时间戳和相关性评分。这一字段对应Magentic-One Task Ledger中的Known Facts，但在RT场景中特化为决策证据。

第四个字段是DecisionDraft（决策草案），类型为对象，用于存储当前的决策建议或结论草案。这个字段是RT独有的需求——在决策场景中，需要持续维护一个逐步完善的决策草案，而非仅跟踪任务完成状态。

第五个字段是PhaseHistory（阶段历史），类型为数组，用于记录阶段转换的历史。每个记录应包含：上一阶段、当前阶段、转换原因、时间戳和关键产出。这一字段实现了Magentic-One Progress Ledger的核心功能——进度监控和历史追溯，但采用更简洁的结构化格式。

### TypeScript接口定义

以下是为RT设计的最小Task Ledger的TypeScript接口定义：

```typescript
interface TaskLedger {
  // 任务锚点
  objective: string;
  
  // 进度指示
  currentPhase: Phase;
  
  // 决策证据
  evidenceCollected: Evidence[];
  
  // 决策状态
  decisionDraft: DecisionDraft | null;
  
  // 阶段转换历史
  phaseHistory: PhaseTransition[];
}

type Phase = 
  | 'clarification'
  | 'evidence_collection'
  | 'discussion'
  | 'evaluation'
  | 'decision';

interface Evidence {
  id: string;
  content: string;
  sourceSpeaker: string;
  timestamp: number;
  relevanceScore: number;
}

interface DecisionDraft {
  content: string;
  supportingEvidence: string[];
  opposingEvidence: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
}

interface PhaseTransition {
  fromPhase: Phase;
  toPhase: Phase;
  trigger: string;
  timestamp: number;
  keyOutputs: string[];
}
```

### 与Magentic-One的对比

将上述设计与Magentic-One的原始设计进行对比，可以清晰地看出裁剪逻辑。Magentic-One的Task Ledger包含Known Facts、Assumptions和Task Plan三个主要组件。其中，Assumptions（假设）在RT场景中意义不大——RT是证据驱动的决策系统，而非探索性的代码执行系统，假设的动态生成和更新并非核心需求。Task Plan在RT中被简化为Phase（阶段）的概念，因为RT的流程相对固定，不需要动态生成复杂的执行计划。

Magentic-One的Progress Ledger包含任务完成检查、进度监控和代理重分配记录。在RT场景中，任务完成检查可以通过CurrentPhase是否到达决策阶段来判断；进度监控通过PhaseHistory实现；代理重分配记录在RT中不存在，因为RT使用固定角色的Moderator和参与者，而非动态分配的专业代理。

## 持久化边界

### 数据库持久化字段

以下字段应当持久化到数据库，作为长期存储的核心数据。

Task Ledger的全部五个字段都应当持久化：Objective存储决策问题的描述，用于会话恢复时的上下文重建；CurrentPhase存储当前所处阶段，用于确定下一步操作；EvidenceCollected存储所有收集的证据，这是决策的核心依据；DecisionDraft存储当前决策草案，支持决策过程的续写；PhaseHistory存储阶段转换历史，支持完整的审计和回溯。

原始消息历史（Message History）也应当持久化，但可以采用分区存储策略。具体而言，可以将消息分为活跃分区和非活跃分区——当前阶段相关的消息保留在快速访问存储中，历史消息可以压缩或归档。这一设计在保持历史可访问性的同时，优化了存储成本。

### 运行时状态字段

以下字段仅需作为运行时状态存在，不需要持久化到数据库。

当前正在处理的中间结果（In-Progress Results）不应当持久化。当Moderator正在处理某个发言或正在进行阶段性总结时，这些中间结果仅存在于内存中。如果会话中断，这些未完成的处理可以丢弃，从上一个持久化的检查点重新开始。

UI状态相关的字段（如展开/折叠面板位置、滚动位置等）属于前端状态，不应持久化到后端数据库。这些状态可以通过前端状态管理处理，在会话恢复时使用默认值或通过UI Hydration机制重新构建。

临时计算结果（如LLM推理的中间步骤）不应当持久化。这些是计算过程的副产品，不影响决策的正确性。

### 持久化策略建议

基于上述分析，本报告建议采用以下持久化策略。

在检查点频率方面，不应每个消息后都创建检查点，而应在每个阶段转换时创建检查点。这平衡了状态粒度和存储开销。具体而言，当CurrentPhase发生变化时，创建新的检查点；当DecisionDraft发生重大更新时（如结构化内容变化），也可以创建检查点。

在存储后端方面，生产环境应使用PostgreSQL存储Task Ledger，利用其JSON支持存储EvidenceCollected等复杂字段。Message History可以存储在专门的消息数据库中，或使用同一数据库的分区表。

在数据保留策略方面，Task Ledger应当永久保留，作为决策过程的权威记录；Message History可以设置保留期限，超过期限的消息可以归档或删除；PhaseHistory作为Task Ledger的一部分，随Task Ledger永久保留。

## Resume、Replay、Follow-up的影响

### Resume（恢复续话）

Typed State架构对Resume功能的支持体现在多个方面。首先是状态恢复的确定性：与从Message History中提取状态不同，Task Ledger提供了明确的状态结构，可以精确恢复到任何一个检查点。在RT场景中，这允许用户中断讨论后，从任意阶段继续，而非从头开始。

其次是上下文重建的效率：Resume时，系统不需要将完整的Message History全部加载到LLM上下文中。只需要加载Task Ledger（结构化、紧凑）和当前阶段相关的最近若干消息。这种设计显著降低了Token消耗。

第三是Decison Draft的完整性维护：RT的一个核心需求是维护决策草案的逐步演进。在Typed State架构下，DecisionDraft字段完整地存储了决策的当前状态，支持精确恢复。Resume后，用户可以查看、修改当前的决策草案，而非重新构建。

### Replay（回放）

Replay功能允许用户回溯到讨论的任意历史节点，重新观看或分析该节点的状态。Typed State架构通过PhaseHistory字段提供支持。

每个PhaseTransition记录包含了转换的原因和关键产出，用户可以通过这些信息理解每个阶段的决策依据。更进一步，可以将每个检查点对应的Task Ledger快照存储起来，支持真正的“时间旅行”——用户不仅可以查看阶段转换历史，还可以查看任意时间点的完整状态。

在RT场景中，Replay功能具有重要的产品价值：用户可以重新审视关键阶段的讨论；审计人员可以检查决策过程是否合规；新参与者可以通过回放快速了解讨论背景。

### Follow-up（跟进续话）

Follow-up是RT的核心产品需求之一——在主讨论结束后，用户可能基于新的信息或变化的情况发起跟进讨论。

Typed State架构对Follow-up的支持体现在：新讨论可以继承主讨论的Task Ledger，包括已收集的证据和当前的决策草案；新讨论可以在Task Ledger中标注为“Follow-up”，与主讨论建立关联；系统可以自动总结主讨论的结论，作为跟进讨论的起点。

这种设计避免了传统Message History中“跟帖”与“主帖”关系模糊的问题。Task Ledger提供了清晰的结构来表达讨论之间的层次关系。

### Judge（判断）

Judge功能指的是对讨论质量或决策质量的评估。在Typed State架构下，Judge可以基于结构化的状态信息进行更准确的评估。

例如，系统可以基于EvidenceCollected的relevanceScore统计证据质量；可以基于PhaseHistory分析阶段转换是否合理（是否存在频繁的阶段回退）；可以基于DecisionDraft的confidenceLevel评估决策的成熟度。这些分析在纯Message History架构下难以实现，因为需要从非结构化文本中提取和计算。

### UI Hydration

UI Hydration指的是根据状态数据动态渲染用户界面。在Typed State架构下，这变得更为直接和可靠。

前端可以根据CurrentPhase确定当前应显示的UI视图；可以根据DecisionDraft的内容动态渲染决策面板；可以根据PhaseHistory生成进度指示器。这些都是确定性操作，不依赖于对消息内容的解释。

与传统架构对比：在Message History架构下，UI需要解析消息内容来推断当前状态，这种推断可能不一致且容易出错。Typed State架构提供了明确的真相来源（Single Source of Truth）。

## RT的最小运行时设计

### 为什么完整DAG Runtime是过度工程

LangGraph等完整的DAG Runtime提供了强大的功能，包括：任意图结构的节点和边定义、条件分支和循环支持、异步执行和并行处理、以及复杂的状态通道管理。然而，这些功能对于RT场景而言属于过度工程。

RT的流程具有高度的规律性：讨论按照Clarification→Evidence Collection→Discussion→Evaluation→Decision的固定顺序进行；每个阶段的目标和行为是预定义的；不需要动态生成执行计划；不涉及代码执行或外部工具调用。

引入完整DAG Runtime的代价是显著的：学习曲线陡峭，需要理解图编译、节点、边、通道等概念；运行时开销增加，包括状态序列化和图执行调度；调试困难，图执行的不确定性和状态复杂性使得问题定位更加困难；与RT现有架构的集成复杂度高。

### 最小替代方案：有限状态机

本报告建议采用基于有限状态机（FSM）的轻量级流程引擎作为替代方案。

FSM的核心要素包括：状态集合（States），对应RT的讨论阶段；事件集合（Events），对应触发阶段转换的条件；转换函数（Transition Function），定义在给定状态和事件下的下一状态；动作（Actions），在状态转换时执行的副作用（如更新Task Ledger）。

在RT场景中，FSM可以设计为：

```typescript
type Phase = 
  | 'clarification'
  | 'evidence_collection'
  | 'discussion'
  | 'evaluation'
  | 'decision';

type Event = 
  | 'phase_complete'
  | 'user_request_pause'
  | 'all_evidence_collected'
  | 'consensus_reached'
  | 'timeout';

interface Transition {
  from: Phase;
  event: Event;
  to: Phase;
  action: () => void;
}

const transitions: Transition[] = [
  { from: 'clarification', event: 'phase_complete', to: 'evidence_collection', action: updateLedger },
  { from: 'evidence_collection', event: 'all_evidence_collected', to: 'discussion', action: updateLedger },
  { from: 'discussion', event: 'phase_complete', to: 'evaluation', action: updateLedger },
  { from: 'evaluation', event: 'consensus_reached', to: 'decision', action: finalizeDecision },
  // 支持回退
  { from: 'discussion', event: 'user_request_pause', to: 'clarification', action: updateLedger },
];
```

这种设计的优势在于：简单直观，状态和转换易于理解和维护；确定性执行，没有复杂的分支和循环；易于调试，转换逻辑清晰可见；与Task Ledger自然集成，FSM的每个状态对应Task Ledger的CurrentPhase。

### Dual-Ledger在RT中的简化

如前所述，RT不需要独立的Progress Ledger。以下是具体的简化逻辑。

在任务完成检查方面，Magentic-One通过Progress Ledger检查任务是否完成。在RT中，这可以通过CurrentPhase === 'decision'来判断。如果CurrentPhase是'Decision'，则任务完成。

在进度监控方面，Magentic-One通过Progress Ledger监控每个子任务的进度。在RT中，PhaseHistory提供了完整的阶段转换记录，可以从中分析讨论的进度。无需独立的Progress Ledger。

在停滞检测方面，Magentic-One通过检测两个周期内无进展来触发重新规划。在RT中，这可以通过监控当前阶段是否超时来实现。如果某个阶段超过预定时间阈值，可以触发提醒或自动转换。

在RT场景中，进度信息可以完全内嵌到Task Ledger中。CurrentPhase提供当前进度指针，PhaseHistory提供历史进度轨迹。这种设计比独立的Progress Ledger更简洁，且功能足够。

## 反模式

### 过度工程类反模式

第一种反模式是引入完整Graph Runtime。RT的流程相对固定，不需要LangGraph、AutoGen等框架的完整功能。这些框架虽然强大，但引入了不必要的复杂性和开销。对于RT场景，一个几百行的FSM实现就能满足需求。

第二种反模式是照搬Magentic-One的双账本设计。Magentic-One的Progress Ledger是针对代码执行场景设计的，包含了代理重分配、任务完成检查等RT不需要的概念。简单移植会导致系统复杂度上升但功能冗余。

第三种反模式是过度类型化状态。状态字段不是越多越好，过度的类型约束会限制LLM的灵活性。建议只对核心状态（CurrentPhase、DecisionDraft等）进行强类型定义，对其他字段（如Evidence内容）保持灵活性。

### 设计缺陷类反模式

第一种反模式是将所有消息都纳入Task Ledger。Task Ledger应当存储结构化的状态摘要，而非原始消息的副本。原始消息应当保留在Message History中，由Task Ledger通过引用（messageId）关联。

第二种反模式是检查点过于频繁。每个消息后都创建检查点会导致存储开销剧增，且大多数检查点没有实际价值。建议在阶段转换等关键节点创建检查点。

第三种反模式是忽视Message History的价值。Typed State并不意味着完全抛弃Message History。相反，两者应当共存——Task Ledger提供状态操作的抽象，Message History提供完整的审计记录。

### 实现错误类反模式

第一种错误是在状态更新时不维护一致性。Task Ledger的多个字段之间存在一致性约束。例如，当CurrentPhase从'evidence_collection'转换到'discussion'时，EvidenceCollected应当已经包含足够的证据。在代码实现中，应当使用事务或原子操作来维护这种一致性。

第二种错误是不处理状态迁移。当Task Ledger的Schema演进时（如添加新字段），需要考虑历史数据的迁移。简单的做法是在读取时为缺失字段提供默认值，复杂的做法是编写数据迁移脚本。

## 待解决的开放问题

### 状态粒度的最佳平衡点

虽然本报告建议了五个核心字段，但这并非一成不变的最优解。状态的粒度需要在多个目标之间平衡：粒度过粗会导致状态信息不足，难以支持Resume和Replay；粒度过细会导致维护成本上升，且可能限制LLM的灵活性。

具体需要进一步验证的问题包括：EvidenceCollected是否需要进一步结构化（如区分事实性证据和观点性证据）？DecisionDraft是否需要支持版本历史？PhaseHistory是否需要包含更详细的状态快照？

### 与现有AllMessages系统的集成策略

本报告假设RT现有系统使用AllMessages或History列表来存储对话。这是一个需要验证的假设。如果现有系统已经采用了其他架构，迁移策略需要调整。

更关键的问题是：如何确保迁移过程平滑，用户无感知？本报告建议采用影子账本方式逐步迁移，但这需要进一步的工程验证。

### 多轮讨论的账本设计

RT可能支持多轮讨论（即一个决策任务中包含多个子讨论）。在这种场景下，Task Ledger是否需要嵌套结构？每个子讨论是否应该有独立的进度跟踪？这些问题需要根据RT的产品需求进一步明确。

### 离线场景的支持

如果RT需要支持离线场景（如网络中断后的本地讨论），持久化策略需要相应调整。检查点是否需要本地存储？如何在重新上线后同步状态？这些问题影响存储后端的选择。

## 推荐RT最小设计总结

基于本报告的全面分析，以下是针对RT的推荐最小设计。

在状态模型方面，RT应当采用Typed State + Message History的混合模式。Typed State（Task Ledger）提供状态操作的抽象，Message History提供完整的审计记录。两者通过messageId引用关联。

在Task Ledger Schema方面，应当包含五个核心字段：Objective（任务目标）、CurrentPhase（当前阶段）、EvidenceCollected（已收集证据）、DecisionDraft（决策草案）、PhaseHistory（阶段历史）。

在运行时方面，不应引入完整的DAG Runtime，而应采用基于FSM的轻量级流程引擎。FSM负责管理阶段转换，Task Ledger负责存储状态快照。

在持久化方面，Task Ledger和Message History应当持久化到数据库，运行时中间结果不持久化。检查点创建于阶段转换时，而非每个消息后。

在Progress Ledger方面，RT不需要独立的Progress Ledger。进度信息通过CurrentPhase和PhaseHistory内嵌在Task Ledger中提供。

## 迁移路线图

### 第一阶段：影子账本（Shadow Ledger）

这一阶段的目标是在不改变现有系统行为的前提下，构建并验证Task Ledger的设计。

具体工作包括：在现有AllMessages系统旁，增量构建一个Task Ledger更新模块；该模块通过旁路观察对话流，尝试实时更新Task Ledger；所有更新先写入内存，不持久化到数据库；开发调试工具，对比Task Ledger与从Message History提取的状态是否一致。

这一阶段的关键指标是Task Ledger的准确率——系统能否正确地跟踪当前阶段和收集证据。

### 第二阶段：混合驱动（Hybrid Mode）

这一阶段的目标是让Task Ledger开始影响系统行为，但不完全替代现有逻辑。

具体工作包括：将Task Ledger持久化到数据库，支持会话恢复；修改UI，让Task Ledger状态（如进度条、证据列表）可见；修改核心逻辑，在预测下一步行动时参考Task Ledger（但不完全依赖）；保持AllMessages作为完整的真相来源，Task Ledger作为加速读取的缓存。

这一阶段结束后，用户应当能看到Task Ledger提供的增强体验（如进度可视化），但系统行为应当与之前基本一致。

### 第三阶段：账本优先（Ledger-First）

这一阶段的目标是让Task Ledger成为状态管理的主角，AllMessages退居辅助位置。

具体工作包括：修改核心逻辑，主要基于Task Ledger而非Message History做决策；调整检查点策略，完全基于Task Ledger状态创建；Message History保留为审计日志和完整上下文来源；移除影子阶段的过渡代码。

这一阶段需要谨慎推进，确保所有依赖Message History的功能都有对应的Task Ledger支持。

### 迁移风险与缓解

主要风险包括：迁移过程中可能出现状态不一致，导致用户体验下降。缓解策略是保持完整的回滚能力，一旦发现问题可以回到上一阶段。

另一个风险是Task Ledger设计可能不完整，遗漏某些重要状态。缓解策略是在每个阶段都进行充分的验证，确保Task Ledger能够准确反映系统状态。

## 源列表

以下是一手资料来源，按优先级排序：

微软Magentic-One官方技术文档和博客文章，介绍了Task Ledger和Progress Ledger的双账本设计架构。

LangGraph官方文档和博客，深入解析了Typed State、Checkpoint和持久化机制。

微软AutoGen研究论文，提供了多智能体协作框架的背景知识。

各技术博客和开发者社区的实践文章，提供了对上述框架的深入解读和对比分析。

本报告建议的技术决策基于对上述一手资料的系统性分析，并结合RT场景的特殊性进行了定制化推导。