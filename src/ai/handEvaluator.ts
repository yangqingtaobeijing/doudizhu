/**
 * 手牌评估器
 *
 * 为 AI 提供手牌强弱评估工具：
 * - 计算手牌价值分数
 * - 判断是否有炸弹/火箭
 * - 估算最少出完牌所需轮次
 * - 对候选出牌按「贡献度」排序
 */

import { CardCombo, CardType, Rank } from '@/engine/types'
import { findAllPlays } from '@/engine/cardUtils'
import type { Card } from '@/engine/types'

// ============================================================
// 常量：各牌型基础价值权重
// ============================================================

/** 各点数的单牌价值（用于计算手牌整体分） */
const RANK_VALUE: Partial<Record<Rank, number>> = {
  [Rank.Three]: 1,
  [Rank.Four]: 2,
  [Rank.Five]: 3,
  [Rank.Six]: 4,
  [Rank.Seven]: 5,
  [Rank.Eight]: 6,
  [Rank.Nine]: 7,
  [Rank.Ten]: 8,
  [Rank.Jack]: 9,
  [Rank.Queen]: 10,
  [Rank.King]: 11,
  [Rank.Ace]: 12,
  [Rank.Two]: 13,
  [Rank.JokerSmall]: 16,
  [Rank.JokerBig]: 20,
}

/**
 * 计算单张牌的点值（fallback 到 rank 本身）
 */
function rankValue(rank: Rank): number {
  return RANK_VALUE[rank] ?? rank
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 计算手牌整体强度分（越高越强）
 *
 * 算法：
 * - 炸弹 / 火箭 贡献大量分数
 * - 2 和王的价值高
 * - 连续牌组（顺子、连对、飞机）贡献额外分数
 */
export function evaluateHand(hand: Card[]): number {
  if (hand.length === 0) return 0

  let score = 0

  // 统计各点数数量
  const counts = new Map<Rank, number>()
  for (const c of hand) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1)
  }

  for (const [rank, cnt] of counts) {
    const val = rankValue(rank)
    if (cnt === 4) {
      // 炸弹
      score += val * 4 + 50
    } else if (cnt === 3) {
      score += val * 3 + 10
    } else if (cnt === 2) {
      score += val * 2 + 3
    } else {
      score += val
    }
  }

  // 火箭加成
  const hasSmall = hand.some(c => c.rank === Rank.JokerSmall)
  const hasBig = hand.some(c => c.rank === Rank.JokerBig)
  if (hasSmall && hasBig) score += 40

  return score
}

/**
 * 估算手牌出完最少需要的轮次
 *
 * 策略：贪心地取「能一次出最多牌」的出法，累计轮次
 */
export function estimateMinRounds(hand: Card[]): number {
  if (hand.length === 0) return 0

  const plays = findAllPlays(hand, null)
  if (plays.length === 0) return hand.length // 理论上不可能

  // 找单次出牌数最多的牌型
  const maxCards = Math.max(...plays.map(p => p.cards.length))
  // 粗略估算：总牌数 / 单次最多牌数
  return Math.ceil(hand.length / maxCards)
}

/**
 * 检查手牌中是否有火箭
 */
export function hasRocket(hand: Card[]): boolean {
  return (
    hand.some(c => c.rank === Rank.JokerSmall) &&
    hand.some(c => c.rank === Rank.JokerBig)
  )
}

/**
 * 检查手牌中是否有炸弹（4张同点数）
 */
export function hasBomb(hand: Card[]): boolean {
  const counts = new Map<Rank, number>()
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1)
  return Array.from(counts.values()).some(cnt => cnt >= 4)
}

/**
 * 对一组候选出牌按「出牌代价」从低到高排序
 *
 * 排序原则：
 * 1. 优先出「高价值牌数量少」的组合（少带走好牌）
 * 2. 相同牌型下，mainValue 越小越优先（保留大牌）
 * 3. 炸弹 / 火箭 排最后（最后手段）
 */
export function sortCandidatesByCost(plays: CardCombo[]): CardCombo[] {
  return [...plays].sort((a, b) => {
    // 火箭最后
    if (a.type === CardType.ROCKET) return 1
    if (b.type === CardType.ROCKET) return -1
    // 炸弹倒数第二
    if (a.type === CardType.BOMB && b.type !== CardType.BOMB) return 1
    if (b.type === CardType.BOMB && a.type !== CardType.BOMB) return -1

    // 同为炸弹，按 mainValue 从小到大
    if (a.type === CardType.BOMB && b.type === CardType.BOMB) {
      return a.mainValue - b.mainValue
    }

    // 其他：mainValue 小的代价低
    return a.mainValue - b.mainValue
  })
}

/**
 * 计算出一套牌之后，剩余手牌的「散乱程度」惩罚分
 * 散乱 = 剩余单牌越多惩罚越大
 */
export function computeDisruptionPenalty(remainingHand: Card[]): number {
  const counts = new Map<Rank, number>()
  for (const c of remainingHand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1)

  let singles = 0
  for (const cnt of counts.values()) {
    if (cnt === 1) singles++
  }
  return singles * 2
}

/**
 * 从候选出牌中挑选最佳一手（综合评分最高）
 *
 * 评分 = 能否大幅减少手牌轮次 - 散乱惩罚
 * 用于普通/困难 AI 的精选策略
 */
export function pickBestPlay(
  candidates: CardCombo[],
  currentHand: Card[],
): CardCombo | null {
  if (candidates.length === 0) return null

  let bestScore = -Infinity
  let best: CardCombo = candidates[0]

  for (const play of candidates) {
    // 模拟出牌后的剩余手牌
    const playedIds = new Set(play.cards.map(c => c.id))
    const remaining = currentHand.filter(c => !playedIds.has(c.id))

    const roundsAfter = estimateMinRounds(remaining)
    const penalty = computeDisruptionPenalty(remaining)
    // 分数：出的牌越多、剩余轮次越少越好，散乱惩罚扣分
    const score = play.cards.length * 3 - roundsAfter * 5 - penalty

    if (score > bestScore) {
      bestScore = score
      best = play
    }
  }

  return best
}
