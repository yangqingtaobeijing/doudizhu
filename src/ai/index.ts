/**
 * AI 模块统一导出
 *
 * 外部（gameStore、UI）只需从 '@/ai' 导入即可。
 */

// 调度器（主入口）
export { aiDecide } from './aiPlayer'

// 各难度决策函数（供测试或独立使用）
export { easyAIDecide } from './easyAI'
export { normalAIDecide } from './normalAI'
export { hardAIDecide } from './hardAI'

// 手牌评估工具（供 UI 层展示或调试）
export {
  evaluateHand,
  estimateMinRounds,
  hasRocket,
  hasBomb,
  sortCandidatesByCost,
  pickBestPlay,
} from './handEvaluator'

// 类型
export type { AIContext, AIDecision } from './types'
