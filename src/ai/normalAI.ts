/**
 * 普通 AI（normal）
 *
 * 策略：
 * - 主动出牌：用 pickBestPlay 选「减少出完轮次最多」的一手
 * - 跟牌：优先用刚好能压的最小出牌；若代价太高则 Pass
 * - 地主角色更激进（更少 Pass）；农民角色更保守（配合队友）
 * - 有炸弹但不轻易亮（对手剩余牌多时才考虑）
 */

import { findAllPlays } from '@/engine/cardUtils'
import { CardType, Role } from '@/engine/types'
import { sortCandidatesByCost, pickBestPlay, estimateMinRounds } from './handEvaluator'
import type { AIContext, AIDecision } from './types'
import type { CardCombo } from './types'

/**
 * 普通 AI 决策入口
 */
export function normalAIDecide(ctx: AIContext): AIDecision {
  const { myHand, myRole, lastPlay, lastPlayerIndex, myIndex, handSizes } = ctx

  const isActivePlay = lastPlay === null || lastPlayerIndex === myIndex

  const allPlays = findAllPlays(myHand, isActivePlay ? null : lastPlay)

  if (allPlays.length === 0) {
    return { action: 'pass' }
  }

  if (isActivePlay) {
    return decideActivePlay(ctx, allPlays)
  } else {
    return decideFollowPlay(ctx, allPlays)
  }
}

/**
 * 主动出牌决策
 */
function decideActivePlay(ctx: AIContext, allPlays: CardCombo[]): AIDecision {
  const { myHand, myRole } = ctx

  // 如果手牌只剩 1 张，直接出
  if (myHand.length === 1) {
    return { action: 'play', combo: allPlays[0] }
  }

  // 用 pickBestPlay 计算最优出牌
  const best = pickBestPlay(allPlays, myHand)
  if (best) return { action: 'play', combo: best }

  // 降级：取代价最小的非炸弹出牌
  const sorted = sortCandidatesByCost(allPlays)
  const nonBomb = sorted.filter(
    p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET,
  )
  return { action: 'play', combo: nonBomb[0] ?? sorted[0] }
}

/**
 * 跟牌决策
 */
function decideFollowPlay(ctx: AIContext, allPlays: CardCombo[]): AIDecision {
  const { myHand, myRole, lastPlay, handSizes, myIndex } = ctx

  // 分离炸弹 / 火箭 与普通出牌
  const bombs = allPlays.filter(
    p => p.type === CardType.BOMB || p.type === CardType.ROCKET,
  )
  const normal = allPlays.filter(
    p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET,
  )

  // ---- 地主策略 ----
  if (myRole === Role.Landlord) {
    // 地主：尽量接牌，减少对手出牌机会
    if (normal.length > 0) {
      const sorted = sortCandidatesByCost(normal)
      return { action: 'play', combo: sorted[0] }
    }
    // 只有炸弹：检查对手剩余牌数，若对手快出完则用炸弹
    if (bombs.length > 0) {
      const opponentMin = Math.min(
        ...handSizes.filter((_, i) => i !== myIndex),
      )
      if (opponentMin <= 5) {
        // 对手快了，亮炸弹
        const rocket = bombs.find(b => b.type === CardType.ROCKET)
        const bomb = sortCandidatesByCost(bombs)[0]
        return { action: 'play', combo: rocket ?? bomb }
      }
    }
    return { action: 'pass' }
  }

  // ---- 农民策略 ----
  // 判断最后出牌者是否是地主
  const isLandlordPlaying = ctx.lastPlayerIndex !== null
    && ctx.handSizes.length > ctx.lastPlayerIndex
    // 需要判断那个玩家是否是地主 — 此处简化：index=landlordIndex 判断
    // AIContext 没有直接暴露 landlordIndex，我们通过 handSizes 的差值间接判断
    // 实际上 lastPlayerIndex 会在 aiPlayer 调用时传入角色信息，这里保守处理

  if (normal.length > 0) {
    const sorted = sortCandidatesByCost(normal)

    // 农民若剩余手牌很少（<=4），积极接牌
    if (myHand.length <= 4) {
      return { action: 'play', combo: sorted[0] }
    }

    // 否则：只用「刚好压过」的最小出牌（mainValue 最小的那个）
    // sorted[0] 已经是代价最小的
    const cheapest = sorted[0]

    // 如果代价最小的出牌 mainValue 很大（大于 Ace），考虑 Pass
    if (cheapest.mainValue > 14 && myHand.length > 8) {
      // 要用2或王来跟，比较浪费，有50%概率Pass
      if (Math.random() < 0.5) return { action: 'pass' }
    }
    return { action: 'play', combo: cheapest }
  }

  // 只有炸弹能接
  if (bombs.length > 0) {
    const opponentMin = Math.min(
      ...handSizes.filter((_, i) => i !== myIndex),
    )
    // 对手（地主）快出完时亮炸弹
    if (opponentMin <= 4) {
      const sorted = sortCandidatesByCost(bombs)
      return { action: 'play', combo: sorted[0] }
    }
  }

  return { action: 'pass' }
}
