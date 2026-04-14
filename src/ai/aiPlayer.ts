/**
 * AI 玩家调度器
 *
 * 统一入口：根据 AIContext.difficulty 分发到对应难度的决策函数。
 * 同时提供「AI 执行出牌」的封装，方便 gameStore 直接调用。
 */

import type { AIContext, AIDecision } from './types'
import { easyAIDecide } from './easyAI'
import { normalAIDecide } from './normalAI'
import { hardAIDecide } from './hardAI'

/**
 * 根据难度调用对应 AI 决策函数
 *
 * @param ctx AI 上下文（手牌、角色、场上状态等）
 * @returns AI 决策结果
 */
export function aiDecide(ctx: AIContext): AIDecision {
  switch (ctx.difficulty) {
    case 'easy':
      return easyAIDecide(ctx)
    case 'normal':
      return normalAIDecide(ctx)
    case 'hard':
      return hardAIDecide(ctx)
    default: {
      // 类型守卫：TypeScript 穷举保护
      const _exhaustive: never = ctx.difficulty
      return normalAIDecide(ctx)
    }
  }
}
