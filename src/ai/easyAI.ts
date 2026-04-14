/**
 * 简单 AI（easy）
 *
 * 策略：
 * - 主动出牌：随机选一手合法出牌（有偏好：优先出最小的单牌或对子）
 * - 跟牌：有能压过的就随机选一手，约 30% 概率 Pass（保留大牌）
 * - 几乎不会策略性使用炸弹
 */

import { findAllPlays } from '@/engine/cardUtils'
import { CardType } from '@/engine/types'
import { sortCandidatesByCost } from './handEvaluator'
import type { AIContext, AIDecision } from './types'
import type { CardCombo } from './types'

/**
 * 简单 AI 决策入口
 */
export function easyAIDecide(ctx: AIContext): AIDecision {
  const { myHand, lastPlay, lastPlayerIndex, myIndex } = ctx

  const isActivePlay = lastPlay === null || lastPlayerIndex === myIndex

  // 枚举所有合法出牌
  const allPlays = findAllPlays(myHand, isActivePlay ? null : lastPlay)

  if (allPlays.length === 0) {
    // 没有能出的牌，只能 Pass
    return { action: 'pass' }
  }

  if (isActivePlay) {
    // 主动出牌：按代价从低到高排序，取最小的
    const sorted = sortCandidatesByCost(allPlays)
    const best = pickEasyActivePlay(sorted)
    return { action: 'play', combo: best }
  } else {
    // 跟牌：有 30% 概率 Pass（如果不是必须接的情况）
    // 过滤掉炸弹（简单 AI 不轻易使用炸弹）
    const nonBomb = allPlays.filter(
      p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET,
    )

    if (nonBomb.length === 0) {
      // 只有炸弹能压，有 50% 概率用炸弹
      if (Math.random() < 0.5) {
        const bomb = allPlays.find(p => p.type === CardType.ROCKET)
          ?? allPlays.find(p => p.type === CardType.BOMB)!
        return { action: 'play', combo: bomb }
      }
      return { action: 'pass' }
    }

    // 有 30% 概率 Pass
    if (Math.random() < 0.3) {
      return { action: 'pass' }
    }

    // 随机取一手代价小的出牌
    const sorted = sortCandidatesByCost(nonBomb)
    // 在前 1/3 中随机选
    const topK = Math.max(1, Math.floor(sorted.length / 3))
    const pick = sorted[Math.floor(Math.random() * topK)]
    return { action: 'play', combo: pick }
  }
}

/**
 * 简单 AI 主动出牌选择：
 * 优先出最小的单牌，其次对子，避免拆炸弹/连牌
 */
function pickEasyActivePlay(sorted: CardCombo[]): CardCombo {
  // 优先选非炸弹的最小出牌
  const nonBomb = sorted.filter(
    p => p.type !== CardType.BOMB && p.type !== CardType.ROCKET,
  )
  if (nonBomb.length > 0) {
    return nonBomb[0]
  }
  return sorted[0]
}
