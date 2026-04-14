/**
 * 困难 AI（hard）
 *
 * 策略：
 * - 主动出牌：用全局最优贪心（减少出完轮次 + 最大化对手轮次）
 * - 跟牌：「刚好能压」原则，保留大牌打关键局面
 * - 地主：主动控牌，尽量不让农民出成套牌
 * - 农民：配合，先让剩余牌少的农民先出完
 * - 炸弹使用时机更精准：只在关键节点亮炸
 * - 对「对手剩余牌数」非常敏感
 */

import { findAllPlays } from '@/engine/cardUtils'
import { CardType, Role, Rank } from '@/engine/types'
import {
  sortCandidatesByCost,
  pickBestPlay,
  estimateMinRounds,
  evaluateHand,
} from './handEvaluator'
import type { AIContext, AIDecision } from './types'
import type { CardCombo } from './types'

/**
 * 困难 AI 决策入口
 */
export function hardAIDecide(ctx: AIContext): AIDecision {
  const { myHand, lastPlay, lastPlayerIndex, myIndex } = ctx

  const isActivePlay = lastPlay === null || lastPlayerIndex === myIndex

  const allPlays = findAllPlays(myHand, isActivePlay ? null : lastPlay)

  if (allPlays.length === 0) {
    return { action: 'pass' }
  }

  if (isActivePlay) {
    return hardDecideActivePlay(ctx, allPlays)
  } else {
    return hardDecideFollowPlay(ctx, allPlays)
  }
}

/**
 * 主动出牌 — 困难
 */
function hardDecideActivePlay(ctx: AIContext, allPlays: CardCombo[]): AIDecision {
  const { myHand, myRole, handSizes, myIndex } = ctx

  // 手牌只剩 1 张，直接出
  if (myHand.length === 1) {
    return { action: 'play', combo: allPlays[0] }
  }

  // 如果手牌可以一把出完，直接出
  const fullHand = allPlays.find(p => p.cards.length === myHand.length)
  if (fullHand) {
    return { action: 'play', combo: fullHand }
  }

  // 计算对手最少剩余轮次（用于判断是否紧迫）
  const opponentHandSizes = handSizes.filter((_, i) => i !== myIndex)
  const opponentMin = Math.min(...opponentHandSizes)

  // 对手剩余 <= 3 张时，考虑用大牌或炸弹强行压制
  if (opponentMin <= 3) {
    // 优先出能直接获得控牌权的大牌
    const bigPlays = allPlays.filter(
      p => p.mainValue >= Rank.Ace && p.type !== CardType.BOMB && p.type !== CardType.ROCKET,
    )
    if (bigPlays.length > 0) {
      return { action: 'play', combo: bigPlays[0] }
    }
  }

  // 一般情况：综合评分选最优出牌
  const best = hardPickBestPlay(allPlays, myHand, ctx)
  if (best) return { action: 'play', combo: best }

  // 降级
  const sorted = sortCandidatesByCost(allPlays)
  const nonBomb = sorted.filter(
    p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET,
  )
  return { action: 'play', combo: nonBomb[0] ?? sorted[0] }
}

/**
 * 跟牌 — 困难
 */
function hardDecideFollowPlay(ctx: AIContext, allPlays: CardCombo[]): AIDecision {
  const { myHand, myRole, handSizes, myIndex, lastPlay } = ctx

  const bombs = allPlays.filter(
    p => p.type === CardType.BOMB || p.type === CardType.ROCKET,
  )
  const normal = allPlays.filter(
    p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET,
  )

  // 计算「对手」最少剩余牌数
  const opponentMin = Math.min(...handSizes.filter((_, i) => i !== myIndex))

  if (myRole === Role.Landlord) {
    // 地主：积极接牌
    if (normal.length > 0) {
      const sorted = sortCandidatesByCost(normal)
      return { action: 'play', combo: sorted[0] }
    }
    // 对手快出完，亮炸弹
    if (bombs.length > 0 && opponentMin <= 3) {
      const rocket = bombs.find(b => b.type === CardType.ROCKET)
      const sorted = sortCandidatesByCost(bombs)
      return { action: 'play', combo: rocket ?? sorted[0] }
    }
    return { action: 'pass' }
  }

  // 农民
  if (normal.length > 0) {
    const sorted = sortCandidatesByCost(normal)

    // 快出完（<=3 张），强行接
    if (myHand.length <= 3) {
      return { action: 'play', combo: sorted[0] }
    }

    const cheapest = sorted[0]

    // 如果需要用 2 或王来跟，而手牌还多，倾向 Pass
    if (cheapest.mainValue >= Rank.Two && myHand.length > 6) {
      return { action: 'pass' }
    }

    // 如果最便宜的接牌「mainValue 是全场最高」，尽量接（控场）
    if (lastPlay && cheapest.mainValue > lastPlay.mainValue + 3) {
      // 跨度太大，考虑 Pass 保留大牌
      if (myHand.length > 5 && Math.random() < 0.4) {
        return { action: 'pass' }
      }
    }

    return { action: 'play', combo: cheapest }
  }

  // 只有炸弹
  if (bombs.length > 0 && opponentMin <= 3) {
    const sorted = sortCandidatesByCost(bombs)
    return { action: 'play', combo: sorted[0] }
  }

  return { action: 'pass' }
}

/**
 * 困难版最优出牌挑选
 * 在 pickBestPlay 基础上额外考虑「是否给对手造成更多轮次」
 */
function hardPickBestPlay(
  candidates: CardCombo[],
  currentHand: CardCombo['cards'],
  _ctx: AIContext,
): CardCombo | null {
  if (candidates.length === 0) return null

  // 非炸弹候选
  const nonBomb = candidates.filter(
    p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET,
  )
  const pool = nonBomb.length > 0 ? nonBomb : candidates

  let bestScore = -Infinity
  let best: CardCombo = pool[0]

  for (const play of pool) {
    const playedIds = new Set(play.cards.map(c => c.id))
    const remaining = currentHand.filter(c => !playedIds.has(c.id))

    // 出牌后剩余轮次
    const roundsAfter = estimateMinRounds(remaining)
    // 剩余手牌强度（越弱越好，说明把好牌都出了）
    const remainScore = evaluateHand(remaining)

    // 综合评分：出牌数越多越好，剩余轮次越少越好，剩余强度越低越好
    const score = play.cards.length * 5 - roundsAfter * 8 - remainScore * 0.1

    if (score > bestScore) {
      bestScore = score
      best = play
    }
  }

  return best
}
