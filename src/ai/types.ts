/**
 * AI 模块专用类型定义
 *
 * 直接复用 engine/types.ts 中的 Card / CardCombo / Role 等核心类型，
 * 此文件只补充 AI 层所需的附加结构。
 */

import type { Card, CardCombo, Role, Difficulty } from '@/engine/types'

// 重新导出，方便 AI 子模块直接从这里导入
export type { Card, CardCombo, Role, Difficulty }

/**
 * AI 决策时所能观察到的游戏上下文
 */
export interface AIContext {
  /** AI 自己的手牌 */
  myHand: Card[]
  /** AI 自己的角色 */
  myRole: Role
  /** 场上最后一次有效出牌（null 表示主动出牌） */
  lastPlay: CardCombo | null
  /** 最后出牌的玩家索引（0=玩家, 1=AI左, 2=AI右） */
  lastPlayerIndex: number | null
  /** 当前 AI 的玩家索引 */
  myIndex: number
  /** 各玩家剩余手牌数量（按索引） */
  handSizes: [number, number, number]
  /** 当前局炸弹/火箭数量（用于评估倍率） */
  bombCount: number
  /** AI 难度 */
  difficulty: Difficulty
}

/**
 * AI 决策结果
 * - play：出这组牌
 * - pass：不出牌（跟牌阶段才可以）
 */
export type AIDecision =
  | { action: 'play'; combo: CardCombo }
  | { action: 'pass' }
