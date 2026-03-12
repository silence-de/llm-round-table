## UI/UX Cross-Review Audit Report

本次深度审查基于“像素级完美 (Pixel-Perfect)”及顶级现代 UI (Apple/Vercel/Linear 级) 的强迫症标准。发现代码库虽然在结构上非常成熟，但在**隐性基线、微交互的物理隐喻（Scale 缺失&挂载生硬）、动效曲线不够Spring化、以及阴影性能**上依然存在“破碇”。

以下是揪出的隐藏极深的体验瑕疵及直接可用的代码修复方案。

---

### 1. 微交互的匮乏与突兀 (Micro-interaction Deficits)

#### 🚨 缺陷 A：操作按钮仅变色无物理反馈 (Missing Active Scale)
**文件**: [src/components/discussion/discussion-feed.tsx](file:///Users/chengxi-mba/Projects/round-table/src/components/discussion/discussion-feed.tsx) -> `<CopyButton>`
**代码行**: ~211
**问题分析**: [CopyButton](file:///Users/chengxi-mba/Projects/round-table/src/components/discussion/discussion-feed.tsx#195-221) 的 hover 反馈仅仅是 `opacity-0 group-hover:opacity-100 transition-opacity`。作为一个高频且需要明确反馈的操作节点，缺失了点击时的物理下沉感 (`scale`)。纯透明度变化的交互容易产生“轻飘飘”的廉价感。
**修复建议**: 补充 `active:scale-90` 及毛玻璃底色，同时将 `transition-opacity` 改为 `transition-all`。
```tsx
// [修改前]
className="absolute -top-1.5 right-2 flex h-6 w-6 items-center justify-center rounded-md border rt-surface opacity-0 group-hover:opacity-100 transition-opacity z-10"

// [修改后]
className="absolute -top-1.5 right-2 flex h-6 w-6 items-center justify-center rounded-md border rt-surface backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 active:scale-90 hover:bg-[color-mix(in_srgb,var(--rt-text-strong)_5%,transparent)] z-10"
```

#### 🚨 缺陷 B：信号态指示器缺乏进入/退出动效 (Abrupt DOM Mount/Unmount)
**文件**: [src/components/discussion/round-table-stage.tsx](file:///Users/chengxi-mba/Projects/round-table/src/components/discussion/round-table-stage.tsx) -> Desktop `agents.map` (Live Indicator)
**代码行**: ~230 
**文件**: [src/components/discussion/discussion-feed.tsx](file:///Users/chengxi-mba/Projects/round-table/src/components/discussion/discussion-feed.tsx) -> `<FeedBubble>` (LiveDot)
**问题分析**: 当 Agent 开始或停止发言时，`isActive && (<span className="...">...</span>)` 被直接条件渲染，没有包裹在 `<AnimatePresence>` 中。这导致直播红点或光晕在出现/消失时极其突兀（生硬的闪现），破坏了沉浸式对话流的“连贯呼吸感”。
**修复建议**: 任何状态指示器必须配备 Spring 动效的 scale 进出场。
```tsx
// [修改前] src/components/discussion/round-table-stage.tsx ~Line 230
{isActive && (
  <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 items-center justify-center">
    ...
  </span>
)}

// [修改后] 引入 AnimatePresence 和 motion.span
<AnimatePresence>
  {isActive && (
    <motion.span 
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute -right-1 -top-1 flex h-2.5 w-2.5 items-center justify-center"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--rt-live-state)] opacity-40" style={{ animationDuration: '1.8s' }} />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--rt-live-state)] shadow-[0_0_6px_2px_color-mix(in_srgb,var(--rt-live-state)_60%,transparent)]" />
    </motion.span>
  )}
</AnimatePresence>
```

---

### 2. 动效曲线的不协调 (Animation Spring/Easing Mismatch)

#### 🚨 缺陷 C：几何缩放使用了非物理阻尼动画 (Linear/Tween Easing on Layout Scaling)
**文件**: [src/components/discussion/round-table-stage.tsx](file:///Users/chengxi-mba/Projects/round-table/src/components/discussion/round-table-stage.tsx) 
**代码行**: ~210 （Agent 节点放大）及 ~183（连接线加粗）
**问题分析**: 当 `isActive` 切换时，Agent 头像包裹层的动画配置为 `transition={{ duration: 0.3 }}`。在现代 UI（特别如 Linear/Vercel 中），尺寸或坐标的缩放（Scale/Layout）**绝不应该使用固定的 duration 线性/缓动动画**，这会产生拖沓的“泥泞感”。必须替换为由弹簧物理决定的阻尼动画 (Spring Physics)，带来极为干脆的快回弹体验。
**修复建议**: 
```tsx
// [修改前]
<motion.div animate={{ scale: isActive ? 1.08 : 1 }} transition={{ duration: 0.3 }}>

// [修改后] (Apple/Linear 常用阻尼感，干脆利落)
<motion.div animate={{ scale: isActive ? 1.08 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.8 }}>

// 对 motion.line 的 transition 同样处理：
<motion.line ... transition={{ type: "spring", stiffness: 350, damping: 30 }} />
```

---

### 3. 视觉层级、对比度与脏影 (Hierarchy, Contrast & Dirty Shadows)

#### 🚨 缺陷 D：动画直接强行驱动 `boxShadow` (Dirty Shadows during Animation)
**文件**: [src/components/discussion/round-table-stage.tsx](file:///Users/chengxi-mba/Projects/round-table/src/components/discussion/round-table-stage.tsx) 
**代码行**: ~216
**问题分析**: 对包含毛玻璃的容器 `animate={{ boxShadow: ... }}` 极其影响渲染性能，并容易引发像素模糊（脏影）。因为 Framer Motion 会在每一帧重新计算并投射复合的光晕阴影，导致浏览器进行重绘 (Repaint)。顶级大厂的做法是绝对避免插值化 boxShadow。
**修复建议**: 将 boxShadow 放置在一个具有绝对定位、 `pointer-events-none` 且带有 `inset-0` 的底层 `<motion.div>` 上，然后**仅动画它的 `opacity`**。
```tsx
// 架构重构建议：由于你在 Agent 节点同时变更边框色和外发光，正确的高端写法应当是：
<div className="rt-surface-glass relative flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-2.5 ...">
  {/* 专属阴影层：只做 Opacity 变化，极大提升帧率并消除脏影 */}
  <motion.div
    className="absolute inset-0 rounded-2xl pointer-events-none"
    style={{ boxShadow: `0 0 0 1.5px ${agent.accentGlow ?? agent.color}, 0 0 22px ${agent.accentGlow ?? agent.color}55` }}
    initial={{ opacity: 0 }}
    animate={{ opacity: isActive ? 1 : 0 }}
    transition={{ duration: 0.2 }}
  />
  ...
</div>
```

#### 🚨 缺陷 E：毛玻璃叠加逻辑下的实体验证缺位 (Lack of Backdrop Blur on Moderator Feed)
**文件**: [src/components/discussion/discussion-feed.tsx](file:///Users/chengxi-mba/Projects/round-table/src/components/discussion/discussion-feed.tsx)
**代码行**: ~259
**问题分析**: Moderator 的 Feed 消息框使用了带透明度的背景色 (`bg-[color-mix...]`) 并没有配合 `backdrop-blur`。这会导致如果底层有复杂滚动内容、或是 Stage 的光晕透过时，颜色直接脏乱叠加。既然项目主打毛玻璃，应当在带 Alpha 的图层上严格追加底衬模糊。
**修复建议**: 在 Moderator Bubble 的类年中加入 `backdrop-blur-md`。

---

### 4. 隐性布局破碎 (Layout & Baseline Inconsistencies)

#### 🚨 缺陷 F：内联 Code 标签导致行高/基线隐性偏移 (Inline Code Vertical Padding Shift)
**文件**: [src/components/ui/markdown-content.tsx](file:///Users/chengxi-mba/Projects/round-table/src/components/ui/markdown-content.tsx)
**代码行**: ~54
**问题分析**: `inline code` 定义了 `py-0.5`。当这串文本嵌入到 `leading-7` 的段落 `<p>` 中时，如果出现换行或字号计算差异，2px 的垂直内边距可能撑开当前行的 line-box 行基线，导致同一段落内有无 code 的行间距肉眼不齐平。
**修复建议**: 去掉 `py-0.5`，使用 `box-decoration-break: clone` 处理断行背景连续性，或严格约束 `leading-none` 并强行绑定到父级行高。
```tsx
// [修改后]
<code className="rounded px-1.5 font-mono text-[0.82em] bg-[color-mix(in_srgb,var(--rt-hh6-primary)_15%,transparent)] text-[var(--rt-hh6-primary)] border border-[color-mix(in_srgb,var(--rt-hh6-primary)_20%,transparent)] box-decoration-clone leading-normal" {...props}>
```

#### 🚨 缺陷 G：头部基线因为 Flex + Margin 失效 (Header Baseline Misalignment)
**文件**: [src/components/discussion/round-table-stage.tsx](file:///Users/chengxi-mba/Projects/round-table/src/components/discussion/round-table-stage.tsx) 
**代码行**: ~72 (Mobile Header)
**问题分析**: `<h2 className="mt-0.5 text-sm">` 与旁边的 `<span className="rt-chip-live... py-1">` 处在相同的 `items-center` 容器。因为 [h2](file:///Users/chengxi-mba/Projects/round-table/src/components/ui/markdown-content.tsx#15-20) 带有强制的 `mt-0.5`，而 chip 只有 `py-1`，它们在 flex 中心对齐时由于行高和 bounding-box 差异，内部文本基线（Text Baseline）大概率出现 1-2px 的参差不齐。
**修复建议**: 涉及文本与 Tag 标签同袍的排版，必须使用 `items-baseline`，切忌使用物理 top margin 去生硬下推元素。

---

### Verification Plan (验证计划)
1. **本地审查运行**: 启动 `npm run dev`，进入包含 Round Table Stage 及 Discussion Feed 的路由。
2. **交互细节验证 (A/B 测试)**:
   - 把鼠标移动到 Feed 中的 Copy 按钮上并按下，验证是否有干脆利落的 0.9 缩放 (Active Scale反馈)。
   - 发起一次对话。观察 Agent LiveDot (`<span className="h-2.5 w-2.5">`) 以及 activeSpeaker 状态的变化；是否丝滑缩放出场还是依旧闪现。
3. **物理动画回弹测试**: 观察 Speaker 更替时，Stage 中的气泡尺寸是否伴有物理弹簧 (`spring`) 的短促拉伸与回缩阻尼感，而非慢吞吞地线性放大。
4. **性能验证**: 打开 Chrome Performance 抽样动画切换时长的 GPU 重绘频率。确认使用 opacity 动画替代 boxShadow 后，帧率保持 144/120Hz，光晕周边无毛边脏影。
