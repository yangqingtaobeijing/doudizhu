/**
 * 斗地主核心引擎 — 牌型判断与出牌逻辑
 *
 * 包含：创建牌组、洗牌、排序、牌型识别、大小比较、合法出牌枚举
 * 所有函数为纯函数，不依赖任何 UI 框架
 */

import {
  Card,
  Suit,
  Rank,
  CardType,
  CardCombo,
} from './types'

// ============================================================
// 牌面显示映射
// ============================================================

const SUIT_SYMBOL: Record<Suit, string> = {
  [Suit.Spade]: '♠',
  [Suit.Heart]: '♥',
  [Suit.Diamond]: '♦',
  [Suit.Club]: '♣',
  [Suit.Joker]: '',
}

const RANK_DISPLAY: Record<Rank, string> = {
  [Rank.Three]: '3',
  [Rank.Four]: '4',
  [Rank.Five]: '5',
  [Rank.Six]: '6',
  [Rank.Seven]: '7',
  [Rank.Eight]: '8',
  [Rank.Nine]: '9',
  [Rank.Ten]: '10',
  [Rank.Jack]: 'J',
  [Rank.Queen]: 'Q',
  [Rank.King]: 'K',
  [Rank.Ace]: 'A',
  [Rank.Two]: '2',
  [Rank.JokerSmall]: '小王',
  [Rank.JokerBig]: '大王',
}

// ============================================================
// 创建牌组
// ============================================================

/**
 * 生成一副完整的54张扑克牌
 */
export function createDeck(): Card[] {
  const deck: Card[] = []
  let id = 0

  // 常规花色
  const suits: Suit[] = [Suit.Spade, Suit.Heart, Suit.Diamond, Suit.Club]
  // 常规点数 3~2（权值 3~15）
  const ranks: Rank[] = [
    Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
    Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen,
    Rank.King, Rank.Ace, Rank.Two,
  ]

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: id++,
        suit,
        rank,
        display: `${SUIT_SYMBOL[suit]}${RANK_DISPLAY[rank]}`,
      })
    }
  }

  // 小王
  deck.push({
    id: id++,
    suit: Suit.Joker,
    rank: Rank.JokerSmall,
    display: '小王',
  })

  // 大王
  deck.push({
    id: id++,
    suit: Suit.Joker,
    rank: Rank.JokerBig,
    display: '大王',
  })

  return deck
}

// ============================================================
// 洗牌
// ============================================================

/**
 * Fisher-Yates 洗牌算法，原地打乱牌组
 * 返回新数组，不修改原数组
 */
export function shuffle(deck: Card[]): Card[] {
  const result = [...deck]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ============================================================
// 排序
// ============================================================

/**
 * 按权值从小到大排序手牌
 * 权值相同时按花色排序（♠ > ♥ > ♦ > ♣）
 */
export function sortCards(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = {
    [Suit.Spade]: 4,
    [Suit.Heart]: 3,
    [Suit.Diamond]: 2,
    [Suit.Club]: 1,
    [Suit.Joker]: 5,
  }
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return suitOrder[a.suit] - suitOrder[b.suit]
  })
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 按点数统计每种牌出现的次数
 * 返回 Map<Rank, number>
 */
function countByRank(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>()
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1)
  }
  return counts
}

/**
 * 获取按点数分组的牌，便于后续取具体牌
 */
function groupByRank(cards: Card[]): Map<Rank, Card[]> {
  const groups = new Map<Rank, Card[]>()
  for (const card of cards) {
    if (!groups.has(card.rank)) {
      groups.set(card.rank, [])
    }
    groups.get(card.rank)!.push(card)
  }
  return groups
}

/**
 * 判断一组点数是否连续（不含2和王）
 * ranks 必须已排序
 */
function isConsecutive(ranks: Rank[]): boolean {
  if (ranks.length < 2) return true
  for (const r of ranks) {
    // 2（权值15）和王（16、17）不参与连续
    if (r >= Rank.Two) return false
  }
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] - ranks[i - 1] !== 1) return false
  }
  return true
}

// ============================================================
// 牌型识别 — 核心算法
// ============================================================

/**
 * 判断一组牌的牌型
 * 返回 CardCombo 或 null（非法牌型）
 *
 * 完整实现14种牌型的识别
 */
export function identifyCardType(cards: Card[]): CardCombo | null {
  if (!cards || cards.length === 0) return null

  const n = cards.length
  const counts = countByRank(cards)
  const uniqueRanks = Array.from(counts.keys()).sort((a, b) => a - b)

  // ---- 火箭：大小王 ----
  if (n === 2) {
    const hasSmallJoker = cards.some(c => c.rank === Rank.JokerSmall)
    const hasBigJoker = cards.some(c => c.rank === Rank.JokerBig)
    if (hasSmallJoker && hasBigJoker) {
      return {
        type: CardType.ROCKET,
        cards: [...cards],
        mainValue: Rank.JokerBig,
        length: 1,
      }
    }
  }

  // ---- 炸弹：4张同点数 ----
  if (n === 4 && uniqueRanks.length === 1 && counts.get(uniqueRanks[0])! === 4) {
    return {
      type: CardType.BOMB,
      cards: [...cards],
      mainValue: uniqueRanks[0],
      length: 1,
    }
  }

  // ---- 单牌 ----
  if (n === 1) {
    return {
      type: CardType.SINGLE,
      cards: [...cards],
      mainValue: cards[0].rank,
      length: 1,
    }
  }

  // ---- 对子 ----
  if (n === 2 && uniqueRanks.length === 1 && counts.get(uniqueRanks[0])! === 2) {
    return {
      type: CardType.PAIR,
      cards: [...cards],
      mainValue: uniqueRanks[0],
      length: 1,
    }
  }

  // ---- 三条 ----
  if (n === 3 && uniqueRanks.length === 1 && counts.get(uniqueRanks[0])! === 3) {
    return {
      type: CardType.TRIPLE,
      cards: [...cards],
      mainValue: uniqueRanks[0],
      length: 1,
    }
  }

  // ---- 三带一 ----
  if (n === 4 && uniqueRanks.length === 2) {
    const tripleRank = uniqueRanks.find(r => counts.get(r)! === 3)
    const singleRank = uniqueRanks.find(r => counts.get(r)! === 1)
    if (tripleRank !== undefined && singleRank !== undefined) {
      return {
        type: CardType.TRIPLE_WITH_SINGLE,
        cards: [...cards],
        mainValue: tripleRank,
        length: 1,
      }
    }
  }

  // ---- 三带二（三带一对） ----
  if (n === 5 && uniqueRanks.length === 2) {
    const tripleRank = uniqueRanks.find(r => counts.get(r)! === 3)
    const pairRank = uniqueRanks.find(r => counts.get(r)! === 2)
    if (tripleRank !== undefined && pairRank !== undefined) {
      return {
        type: CardType.TRIPLE_WITH_PAIR,
        cards: [...cards],
        mainValue: tripleRank,
        length: 1,
      }
    }
  }

  // ---- 顺子：5~12张连续单牌，不含2和王 ----
  if (n >= 5 && n <= 12) {
    const allSingle = Array.from(counts.values()).every(c => c === 1)
    if (allSingle && isConsecutive(uniqueRanks)) {
      return {
        type: CardType.STRAIGHT,
        cards: [...cards],
        mainValue: uniqueRanks[uniqueRanks.length - 1],
        length: uniqueRanks.length,
      }
    }
  }

  // ---- 连对：3~10组连续对子，不含2和王 ----
  {
    const allPairs = Array.from(counts.values()).every(c => c === 2)
    const pairCount = uniqueRanks.length
    if (allPairs && pairCount >= 3 && pairCount <= 10 && isConsecutive(uniqueRanks)) {
      return {
        type: CardType.STRAIGHT_PAIR,
        cards: [...cards],
        mainValue: uniqueRanks[uniqueRanks.length - 1],
        length: pairCount,
      }
    }
  }

  // ---- 飞机不带：2+组连续三条，不含2和王 ----
  {
    const allTriple = Array.from(counts.values()).every(c => c === 3)
    const tripleCount = uniqueRanks.length
    if (allTriple && tripleCount >= 2 && isConsecutive(uniqueRanks)) {
      return {
        type: CardType.PLANE,
        cards: [...cards],
        mainValue: uniqueRanks[uniqueRanks.length - 1],
        length: tripleCount,
      }
    }
  }

  // ---- 飞机带单 / 飞机带对 ----
  // 提取所有 count>=3 的部分，检查三条是否连续
  {
    const result = identifyPlane(cards, counts, uniqueRanks)
    if (result) return result
  }

  // ---- 四带二单 ----
  if (n === 6) {
    const fourRank = uniqueRanks.find(r => counts.get(r)! === 4)
    if (fourRank !== undefined) {
      // 剩余2张可以是任意牌（包括一对）
      return {
        type: CardType.FOUR_WITH_TWO_SINGLES,
        cards: [...cards],
        mainValue: fourRank,
        length: 1,
      }
    }
  }

  // ---- 四带二对 ----
  if (n === 8) {
    const fourRank = uniqueRanks.find(r => counts.get(r)! === 4)
    if (fourRank !== undefined) {
      // 检查剩余4张是否恰好是两对
      const remaining = uniqueRanks.filter(r => r !== fourRank)
      const allPairs = remaining.every(r => counts.get(r)! === 2)
      if (allPairs && remaining.length === 2) {
        return {
          type: CardType.FOUR_WITH_TWO_PAIRS,
          cards: [...cards],
          mainValue: fourRank,
          length: 1,
        }
      }
    }
  }

  return null // 不合法牌型
}

/**
 * 飞机牌型的识别（带单/带对）
 * 较复杂：需要枚举所有可能的连续三条组合
 */
function identifyPlane(
  cards: Card[],
  counts: Map<Rank, number>,
  uniqueRanks: Rank[],
): CardCombo | null {
  // 找出所有 count >= 3 的点数
  const tripleRanks = uniqueRanks.filter(r => counts.get(r)! >= 3 && r < Rank.Two).sort((a, b) => a - b)
  if (tripleRanks.length < 2) return null

  const n = cards.length

  // 枚举所有可能的连续三条段（可能有多种拆法）
  for (let start = 0; start < tripleRanks.length; start++) {
    for (let end = start + 1; end < tripleRanks.length; end++) {
      // 检查 tripleRanks[start..end] 是否连续
      const segment = tripleRanks.slice(start, end + 1)
      let consecutive = true
      for (let i = 1; i < segment.length; i++) {
        if (segment[i] - segment[i - 1] !== 1) {
          consecutive = false
          break
        }
      }
      if (!consecutive) continue

      const planeLen = segment.length // 飞机组数
      const planeCardCount = planeLen * 3
      const extraCount = n - planeCardCount

      // 飞机带单：附带牌数 == 飞机组数
      if (extraCount === planeLen) {
        // 验证附带的单牌中不含炸弹（4张同点数）
        // 计算非飞机部分各点数数量
        const extraCounts = new Map<Rank, number>()
        for (const [rank, count] of counts) {
          if (segment.includes(rank)) {
            const extra = count - 3
            if (extra > 0) extraCounts.set(rank, extra)
          } else {
            extraCounts.set(rank, count)
          }
        }
        // 检查不含4张同点数（那会是炸弹）
        const hasBomb = Array.from(extraCounts.values()).some(c => c >= 4)
        if (!hasBomb) {
          return {
            type: CardType.PLANE_WITH_SINGLES,
            cards: [...cards],
            mainValue: segment[segment.length - 1],
            length: planeLen,
          }
        }
      }

      // 飞机带对：附带牌数 == 飞机组数 * 2，且全部是对子
      if (extraCount === planeLen * 2) {
        const extraCounts = new Map<Rank, number>()
        for (const [rank, count] of counts) {
          if (segment.includes(rank)) {
            const extra = count - 3
            if (extra > 0) extraCounts.set(rank, extra)
          } else {
            extraCounts.set(rank, count)
          }
        }
        // 所有附带牌必须是对子（每种2张）
        const allPairs = Array.from(extraCounts.values()).every(c => c === 2)
        const pairCount = extraCounts.size
        if (allPairs && pairCount === planeLen) {
          return {
            type: CardType.PLANE_WITH_PAIRS,
            cards: [...cards],
            mainValue: segment[segment.length - 1],
            length: planeLen,
          }
        }
      }
    }
  }

  return null
}

// ============================================================
// 牌型大小比较
// ============================================================

/**
 * 判断 current 能否打过 last
 *
 * 规则：
 * 1. 火箭最大，可以打任何牌
 * 2. 炸弹可以打除火箭外的任何牌；炸弹之间比点数
 * 3. 同类型、同张数/长度才能比较，比主体牌的点数
 */
export function canBeat(current: CardCombo, last: CardCombo): boolean {
  // 火箭最大
  if (current.type === CardType.ROCKET) return true
  // 火箭不可被非火箭打
  if (last.type === CardType.ROCKET) return false

  // 炸弹 vs 非炸弹
  if (current.type === CardType.BOMB && last.type !== CardType.BOMB) return true
  // 非炸弹 vs 炸弹
  if (current.type !== CardType.BOMB && last.type === CardType.BOMB) return false

  // 炸弹 vs 炸弹
  if (current.type === CardType.BOMB && last.type === CardType.BOMB) {
    return current.mainValue > last.mainValue
  }

  // 同类型比较
  if (current.type !== last.type) return false
  // 顺子类必须同长度
  if (current.length !== last.length) return false
  // 比主体牌点数
  return current.mainValue > last.mainValue
}

// ============================================================
// 枚举所有合法出牌（高效实现）
// ============================================================

/**
 * 从手牌中找出所有能打过 lastPlay 的合法出牌组合
 * 如果 lastPlay 为 null，则列举所有主动出牌
 *
 * 策略：按牌型类型分别枚举，避免暴力穷举子集
 */
export function findAllPlays(hand: Card[], lastPlay: CardCombo | null): CardCombo[] {
  const results: CardCombo[] = []
  const groups = groupByRank(hand)
  const counts = countByRank(hand)

  if (lastPlay === null) {
    // 主动出牌：枚举所有可能的合法牌型
    findSingles(groups, results)
    findPairs(groups, results)
    findTriples(groups, results)
    findTripleWithSingle(groups, counts, hand, results)
    findTripleWithPair(groups, counts, results)
    findStraights(groups, counts, results)
    findStraightPairs(groups, counts, results)
    findPlanes(groups, counts, results)
    findPlaneWithSingles(groups, counts, hand, results)
    findPlaneWithPairs(groups, counts, results)
    findFourWithTwoSingles(groups, counts, hand, results)
    findFourWithTwoPairs(groups, counts, results)
    findBombs(groups, results)
    findRockets(hand, results)
  } else {
    // 跟牌：只枚举能压过 lastPlay 的组合
    findBeatingPlays(hand, groups, counts, lastPlay, results)
  }

  return results
}

// ============================================================
// 主动出牌 — 各牌型枚举
// ============================================================

/** 枚举所有单牌 */
function findSingles(groups: Map<Rank, Card[]>, results: CardCombo[]): void {
  for (const [rank, cards] of groups) {
    results.push({
      type: CardType.SINGLE,
      cards: [cards[0]],
      mainValue: rank,
      length: 1,
    })
  }
}

/** 枚举所有对子 */
function findPairs(groups: Map<Rank, Card[]>, results: CardCombo[]): void {
  for (const [rank, cards] of groups) {
    if (cards.length >= 2) {
      results.push({
        type: CardType.PAIR,
        cards: cards.slice(0, 2),
        mainValue: rank,
        length: 1,
      })
    }
  }
}

/** 枚举所有三条 */
function findTriples(groups: Map<Rank, Card[]>, results: CardCombo[]): void {
  for (const [rank, cards] of groups) {
    if (cards.length >= 3) {
      results.push({
        type: CardType.TRIPLE,
        cards: cards.slice(0, 3),
        mainValue: rank,
        length: 1,
      })
    }
  }
}

/** 枚举所有三带一 */
function findTripleWithSingle(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  hand: Card[],
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(groups.keys()).filter(r => (counts.get(r) ?? 0) >= 3)

  for (const tripleRank of tripleRanks) {
    const tripleCards = groups.get(tripleRank)!.slice(0, 3)
    // 可带的单牌：其他任意一张
    for (const [rank, cards] of groups) {
      if (rank === tripleRank) {
        // 如果该点数有第4张，也可以当单牌带
        if (cards.length >= 4) {
          results.push({
            type: CardType.TRIPLE_WITH_SINGLE,
            cards: [...tripleCards, cards[3]],
            mainValue: tripleRank,
            length: 1,
          })
        }
        continue
      }
      results.push({
        type: CardType.TRIPLE_WITH_SINGLE,
        cards: [...tripleCards, cards[0]],
        mainValue: tripleRank,
        length: 1,
      })
    }
  }
}

/** 枚举所有三带二 */
function findTripleWithPair(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(groups.keys()).filter(r => (counts.get(r) ?? 0) >= 3)
  const pairRanks = Array.from(groups.keys()).filter(r => (counts.get(r) ?? 0) >= 2)

  for (const tripleRank of tripleRanks) {
    const tripleCards = groups.get(tripleRank)!.slice(0, 3)
    for (const pairRank of pairRanks) {
      if (pairRank === tripleRank) continue
      results.push({
        type: CardType.TRIPLE_WITH_PAIR,
        cards: [...tripleCards, ...groups.get(pairRank)!.slice(0, 2)],
        mainValue: tripleRank,
        length: 1,
      })
    }
  }
}

/** 枚举所有顺子（5~12张） */
function findStraights(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  results: CardCombo[],
): void {
  // 可用点数：3~A（权值3~14），不含2和王
  const availableRanks = Array.from(counts.keys())
    .filter(r => r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  // 枚举所有可能的连续区间
  for (let start = 0; start < availableRanks.length; start++) {
    for (let end = start + 4; end < availableRanks.length; end++) {
      // 检查 start..end 是否连续
      const len = end - start + 1
      if (len > 12) break

      let consecutive = true
      for (let i = start + 1; i <= end; i++) {
        if (availableRanks[i] - availableRanks[i - 1] !== 1) {
          consecutive = false
          break
        }
      }
      if (!consecutive) break // 一旦断了就不用继续扩展

      const straightCards: Card[] = []
      for (let i = start; i <= end; i++) {
        straightCards.push(groups.get(availableRanks[i])![0])
      }

      results.push({
        type: CardType.STRAIGHT,
        cards: straightCards,
        mainValue: availableRanks[end],
        length: len,
      })
    }
  }
}

/** 枚举所有连对（3~10组） */
function findStraightPairs(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  results: CardCombo[],
): void {
  // 可用：有 >= 2 张的、点数 3~A
  const pairRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 2 && r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  for (let start = 0; start < pairRanks.length; start++) {
    for (let end = start + 2; end < pairRanks.length; end++) {
      const len = end - start + 1
      if (len > 10) break

      let consecutive = true
      for (let i = start + 1; i <= end; i++) {
        if (pairRanks[i] - pairRanks[i - 1] !== 1) {
          consecutive = false
          break
        }
      }
      if (!consecutive) break

      const pairCards: Card[] = []
      for (let i = start; i <= end; i++) {
        pairCards.push(...groups.get(pairRanks[i])!.slice(0, 2))
      }

      results.push({
        type: CardType.STRAIGHT_PAIR,
        cards: pairCards,
        mainValue: pairRanks[end],
        length: len,
      })
    }
  }
}

/** 枚举所有飞机不带（2+组连续三条） */
function findPlanes(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 3 && r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  for (let start = 0; start < tripleRanks.length; start++) {
    for (let end = start + 1; end < tripleRanks.length; end++) {
      let consecutive = true
      for (let i = start + 1; i <= end; i++) {
        if (tripleRanks[i] - tripleRanks[i - 1] !== 1) {
          consecutive = false
          break
        }
      }
      if (!consecutive) break

      const planeCards: Card[] = []
      for (let i = start; i <= end; i++) {
        planeCards.push(...groups.get(tripleRanks[i])!.slice(0, 3))
      }

      const planeLen = end - start + 1
      results.push({
        type: CardType.PLANE,
        cards: planeCards,
        mainValue: tripleRanks[end],
        length: planeLen,
      })
    }
  }
}

/** 枚举所有飞机带单 */
function findPlaneWithSingles(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  hand: Card[],
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 3 && r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  // 枚举连续三条段
  for (let start = 0; start < tripleRanks.length; start++) {
    for (let end = start + 1; end < tripleRanks.length; end++) {
      let consecutive = true
      for (let i = start + 1; i <= end; i++) {
        if (tripleRanks[i] - tripleRanks[i - 1] !== 1) {
          consecutive = false
          break
        }
      }
      if (!consecutive) break

      const planeLen = end - start + 1
      const segment = tripleRanks.slice(start, end + 1)

      // 收集飞机主体牌
      const planeCards: Card[] = []
      for (const r of segment) {
        planeCards.push(...groups.get(r)!.slice(0, 3))
      }

      // 收集可选的单牌（去掉已用于飞机的牌）
      const usedIds = new Set(planeCards.map(c => c.id))
      const availSingles: Card[] = hand.filter(c => !usedIds.has(c.id))

      // 需要恰好 planeLen 张单牌，枚举组合太多，只生成几种代表性组合
      // 简化：取最小的 planeLen 张不同点数的牌
      if (availSingles.length >= planeLen) {
        // 按点数分组取各1张
        const singlesByRank = new Map<Rank, Card>()
        for (const c of availSingles) {
          if (!singlesByRank.has(c.rank)) {
            singlesByRank.set(c.rank, c)
          }
        }
        const singleCards = Array.from(singlesByRank.values()).slice(0, planeLen)
        if (singleCards.length === planeLen) {
          results.push({
            type: CardType.PLANE_WITH_SINGLES,
            cards: [...planeCards, ...singleCards],
            mainValue: segment[segment.length - 1],
            length: planeLen,
          })
        }
      }
    }
  }
}

/** 枚举所有飞机带对 */
function findPlaneWithPairs(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 3 && r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  for (let start = 0; start < tripleRanks.length; start++) {
    for (let end = start + 1; end < tripleRanks.length; end++) {
      let consecutive = true
      for (let i = start + 1; i <= end; i++) {
        if (tripleRanks[i] - tripleRanks[i - 1] !== 1) {
          consecutive = false
          break
        }
      }
      if (!consecutive) break

      const planeLen = end - start + 1
      const segment = tripleRanks.slice(start, end + 1)

      const planeCards: Card[] = []
      for (const r of segment) {
        planeCards.push(...groups.get(r)!.slice(0, 3))
      }

      // 找可用的对子（非飞机三条的点数）
      const availPairRanks = Array.from(counts.keys())
        .filter(r => !segment.includes(r) && (counts.get(r) ?? 0) >= 2)

      if (availPairRanks.length >= planeLen) {
        // 取最小的 planeLen 个对子
        const sortedPairRanks = availPairRanks.sort((a, b) => a - b).slice(0, planeLen)
        const pairCards: Card[] = []
        for (const r of sortedPairRanks) {
          pairCards.push(...groups.get(r)!.slice(0, 2))
        }
        results.push({
          type: CardType.PLANE_WITH_PAIRS,
          cards: [...planeCards, ...pairCards],
          mainValue: segment[segment.length - 1],
          length: planeLen,
        })
      }
    }
  }
}

/** 枚举所有四带二单 */
function findFourWithTwoSingles(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  hand: Card[],
  results: CardCombo[],
): void {
  const fourRanks = Array.from(counts.keys()).filter(r => (counts.get(r) ?? 0) >= 4)

  for (const fourRank of fourRanks) {
    const fourCards = groups.get(fourRank)!.slice(0, 4)
    const usedIds = new Set(fourCards.map(c => c.id))
    const avail = hand.filter(c => !usedIds.has(c.id))

    // 取2张不同点数的单牌（简化，取最小两张不同点数的）
    const byRank = new Map<Rank, Card>()
    for (const c of avail) {
      if (!byRank.has(c.rank)) byRank.set(c.rank, c)
    }
    const singles = Array.from(byRank.values()).slice(0, 2)
    if (singles.length === 2) {
      results.push({
        type: CardType.FOUR_WITH_TWO_SINGLES,
        cards: [...fourCards, ...singles],
        mainValue: fourRank,
        length: 1,
      })
    }
  }
}

/** 枚举所有四带二对 */
function findFourWithTwoPairs(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  results: CardCombo[],
): void {
  const fourRanks = Array.from(counts.keys()).filter(r => (counts.get(r) ?? 0) >= 4)
  const pairRanks = Array.from(counts.keys()).filter(r => (counts.get(r) ?? 0) >= 2)

  for (const fourRank of fourRanks) {
    const fourCards = groups.get(fourRank)!.slice(0, 4)
    const availPairs = pairRanks.filter(r => r !== fourRank)

    // 取2个不同的对子
    if (availPairs.length >= 2) {
      const sorted = availPairs.sort((a, b) => a - b)
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          results.push({
            type: CardType.FOUR_WITH_TWO_PAIRS,
            cards: [
              ...fourCards,
              ...groups.get(sorted[i])!.slice(0, 2),
              ...groups.get(sorted[j])!.slice(0, 2),
            ],
            mainValue: fourRank,
            length: 1,
          })
        }
      }
    }
  }
}

/** 枚举所有炸弹 */
function findBombs(groups: Map<Rank, Card[]>, results: CardCombo[]): void {
  for (const [rank, cards] of groups) {
    if (cards.length === 4) {
      results.push({
        type: CardType.BOMB,
        cards: [...cards],
        mainValue: rank,
        length: 1,
      })
    }
  }
}

/** 检查是否有火箭 */
function findRockets(hand: Card[], results: CardCombo[]): void {
  const smallJoker = hand.find(c => c.rank === Rank.JokerSmall)
  const bigJoker = hand.find(c => c.rank === Rank.JokerBig)
  if (smallJoker && bigJoker) {
    results.push({
      type: CardType.ROCKET,
      cards: [smallJoker, bigJoker],
      mainValue: Rank.JokerBig,
      length: 1,
    })
  }
}

// ============================================================
// 跟牌 — 枚举能压过对方的组合
// ============================================================

/**
 * 枚举所有能压过 lastPlay 的出牌组合
 */
function findBeatingPlays(
  hand: Card[],
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  lastPlay: CardCombo,
  results: CardCombo[],
): void {
  const minValue = lastPlay.mainValue

  switch (lastPlay.type) {
    case CardType.SINGLE:
      // 找所有比 lastPlay 大的单牌
      for (const [rank, cards] of groups) {
        if (rank > minValue) {
          results.push({
            type: CardType.SINGLE,
            cards: [cards[0]],
            mainValue: rank,
            length: 1,
          })
        }
      }
      break

    case CardType.PAIR:
      for (const [rank, cards] of groups) {
        if (rank > minValue && cards.length >= 2) {
          results.push({
            type: CardType.PAIR,
            cards: cards.slice(0, 2),
            mainValue: rank,
            length: 1,
          })
        }
      }
      break

    case CardType.TRIPLE:
      for (const [rank, cards] of groups) {
        if (rank > minValue && cards.length >= 3) {
          results.push({
            type: CardType.TRIPLE,
            cards: cards.slice(0, 3),
            mainValue: rank,
            length: 1,
          })
        }
      }
      break

    case CardType.TRIPLE_WITH_SINGLE:
      findBeatingTripleWithSingle(groups, counts, hand, minValue, results)
      break

    case CardType.TRIPLE_WITH_PAIR:
      findBeatingTripleWithPair(groups, counts, minValue, results)
      break

    case CardType.STRAIGHT:
      findBeatingStraights(groups, counts, minValue, lastPlay.length, results)
      break

    case CardType.STRAIGHT_PAIR:
      findBeatingStraightPairs(groups, counts, minValue, lastPlay.length, results)
      break

    case CardType.PLANE:
      findBeatingPlanes(groups, counts, minValue, lastPlay.length, results)
      break

    case CardType.PLANE_WITH_SINGLES:
      findBeatingPlaneWithSingles(groups, counts, hand, minValue, lastPlay.length, results)
      break

    case CardType.PLANE_WITH_PAIRS:
      findBeatingPlaneWithPairs(groups, counts, minValue, lastPlay.length, results)
      break

    case CardType.FOUR_WITH_TWO_SINGLES:
      findBeatingFourWithTwoSingles(groups, counts, hand, minValue, results)
      break

    case CardType.FOUR_WITH_TWO_PAIRS:
      findBeatingFourWithTwoPairs(groups, counts, minValue, results)
      break

    case CardType.BOMB:
      // 只能用更大的炸弹或火箭
      for (const [rank, cards] of groups) {
        if (cards.length === 4 && rank > minValue) {
          results.push({
            type: CardType.BOMB,
            cards: [...cards],
            mainValue: rank,
            length: 1,
          })
        }
      }
      // 火箭
      findRockets(hand, results)
      return // 炸弹不能被更小的炸弹打，也不用再加普通炸弹

    case CardType.ROCKET:
      // 火箭无敌，没有能打过的
      return
  }

  // 非炸弹/火箭牌型，还可以用炸弹和火箭压
  // （BOMB 和 ROCKET case 已经 return，走到这里一定是其他牌型）
  findBombs(groups, results)
  findRockets(hand, results)
}

/** 跟牌：三带一 */
function findBeatingTripleWithSingle(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  hand: Card[],
  minValue: Rank,
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 3 && r > minValue)
    .sort((a, b) => a - b)

  for (const tripleRank of tripleRanks) {
    const tripleCards = groups.get(tripleRank)!.slice(0, 3)
    // 找一张单牌
    for (const [rank, cards] of groups) {
      if (rank === tripleRank) {
        if (cards.length >= 4) {
          results.push({
            type: CardType.TRIPLE_WITH_SINGLE,
            cards: [...tripleCards, cards[3]],
            mainValue: tripleRank,
            length: 1,
          })
        }
        continue
      }
      results.push({
        type: CardType.TRIPLE_WITH_SINGLE,
        cards: [...tripleCards, cards[0]],
        mainValue: tripleRank,
        length: 1,
      })
      break // 只需一种带法即可（取最小的单牌）
    }
  }
}

/** 跟牌：三带二 */
function findBeatingTripleWithPair(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  minValue: Rank,
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 3 && r > minValue)
    .sort((a, b) => a - b)

  for (const tripleRank of tripleRanks) {
    const tripleCards = groups.get(tripleRank)!.slice(0, 3)
    // 找一个对子
    for (const [rank, cards] of groups) {
      if (rank !== tripleRank && cards.length >= 2) {
        results.push({
          type: CardType.TRIPLE_WITH_PAIR,
          cards: [...tripleCards, ...cards.slice(0, 2)],
          mainValue: tripleRank,
          length: 1,
        })
        break // 取最小的对子
      }
    }
  }
}

/** 跟牌：顺子（同长度） */
function findBeatingStraights(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  minValue: Rank,
  targetLen: number,
  results: CardCombo[],
): void {
  const availableRanks = Array.from(counts.keys())
    .filter(r => r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  for (let start = 0; start < availableRanks.length; start++) {
    const end = start + targetLen - 1
    if (end >= availableRanks.length) break
    if (availableRanks[end] <= minValue) continue

    let consecutive = true
    for (let i = start + 1; i <= end; i++) {
      if (availableRanks[i] - availableRanks[i - 1] !== 1) {
        consecutive = false
        break
      }
    }
    if (!consecutive) continue

    const straightCards: Card[] = []
    for (let i = start; i <= end; i++) {
      straightCards.push(groups.get(availableRanks[i])![0])
    }

    results.push({
      type: CardType.STRAIGHT,
      cards: straightCards,
      mainValue: availableRanks[end],
      length: targetLen,
    })
  }
}

/** 跟牌：连对（同长度） */
function findBeatingStraightPairs(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  minValue: Rank,
  targetLen: number,
  results: CardCombo[],
): void {
  const pairRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 2 && r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  for (let start = 0; start < pairRanks.length; start++) {
    const end = start + targetLen - 1
    if (end >= pairRanks.length) break
    if (pairRanks[end] <= minValue) continue

    let consecutive = true
    for (let i = start + 1; i <= end; i++) {
      if (pairRanks[i] - pairRanks[i - 1] !== 1) {
        consecutive = false
        break
      }
    }
    if (!consecutive) continue

    const cards: Card[] = []
    for (let i = start; i <= end; i++) {
      cards.push(...groups.get(pairRanks[i])!.slice(0, 2))
    }

    results.push({
      type: CardType.STRAIGHT_PAIR,
      cards,
      mainValue: pairRanks[end],
      length: targetLen,
    })
  }
}

/** 跟牌：飞机不带（同组数） */
function findBeatingPlanes(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  minValue: Rank,
  targetLen: number,
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 3 && r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  for (let start = 0; start < tripleRanks.length; start++) {
    const end = start + targetLen - 1
    if (end >= tripleRanks.length) break
    if (tripleRanks[end] <= minValue) continue

    let consecutive = true
    for (let i = start + 1; i <= end; i++) {
      if (tripleRanks[i] - tripleRanks[i - 1] !== 1) {
        consecutive = false
        break
      }
    }
    if (!consecutive) continue

    const cards: Card[] = []
    for (let i = start; i <= end; i++) {
      cards.push(...groups.get(tripleRanks[i])!.slice(0, 3))
    }

    results.push({
      type: CardType.PLANE,
      cards,
      mainValue: tripleRanks[end],
      length: targetLen,
    })
  }
}

/** 跟牌：飞机带单 */
function findBeatingPlaneWithSingles(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  hand: Card[],
  minValue: Rank,
  targetLen: number,
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 3 && r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  for (let start = 0; start < tripleRanks.length; start++) {
    const end = start + targetLen - 1
    if (end >= tripleRanks.length) break
    if (tripleRanks[end] <= minValue) continue

    let consecutive = true
    for (let i = start + 1; i <= end; i++) {
      if (tripleRanks[i] - tripleRanks[i - 1] !== 1) {
        consecutive = false
        break
      }
    }
    if (!consecutive) continue

    const segment = tripleRanks.slice(start, end + 1)
    const planeCards: Card[] = []
    for (const r of segment) {
      planeCards.push(...groups.get(r)!.slice(0, 3))
    }

    const usedIds = new Set(planeCards.map(c => c.id))
    const avail = hand.filter(c => !usedIds.has(c.id))

    const singlesByRank = new Map<Rank, Card>()
    for (const c of avail) {
      if (!singlesByRank.has(c.rank)) singlesByRank.set(c.rank, c)
    }
    const singles = Array.from(singlesByRank.values()).slice(0, targetLen)
    if (singles.length === targetLen) {
      results.push({
        type: CardType.PLANE_WITH_SINGLES,
        cards: [...planeCards, ...singles],
        mainValue: segment[segment.length - 1],
        length: targetLen,
      })
    }
  }
}

/** 跟牌：飞机带对 */
function findBeatingPlaneWithPairs(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  minValue: Rank,
  targetLen: number,
  results: CardCombo[],
): void {
  const tripleRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 3 && r >= Rank.Three && r <= Rank.Ace)
    .sort((a, b) => a - b)

  for (let start = 0; start < tripleRanks.length; start++) {
    const end = start + targetLen - 1
    if (end >= tripleRanks.length) break
    if (tripleRanks[end] <= minValue) continue

    let consecutive = true
    for (let i = start + 1; i <= end; i++) {
      if (tripleRanks[i] - tripleRanks[i - 1] !== 1) {
        consecutive = false
        break
      }
    }
    if (!consecutive) continue

    const segment = tripleRanks.slice(start, end + 1)
    const planeCards: Card[] = []
    for (const r of segment) {
      planeCards.push(...groups.get(r)!.slice(0, 3))
    }

    const availPairRanks = Array.from(counts.keys())
      .filter(r => !segment.includes(r) && (counts.get(r) ?? 0) >= 2)
      .sort((a, b) => a - b)

    if (availPairRanks.length >= targetLen) {
      const pairCards: Card[] = []
      for (const r of availPairRanks.slice(0, targetLen)) {
        pairCards.push(...groups.get(r)!.slice(0, 2))
      }
      results.push({
        type: CardType.PLANE_WITH_PAIRS,
        cards: [...planeCards, ...pairCards],
        mainValue: segment[segment.length - 1],
        length: targetLen,
      })
    }
  }
}

/** 跟牌：四带二单 */
function findBeatingFourWithTwoSingles(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  hand: Card[],
  minValue: Rank,
  results: CardCombo[],
): void {
  const fourRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 4 && r > minValue)
    .sort((a, b) => a - b)

  for (const fourRank of fourRanks) {
    const fourCards = groups.get(fourRank)!.slice(0, 4)
    const usedIds = new Set(fourCards.map(c => c.id))
    const avail = hand.filter(c => !usedIds.has(c.id))

    const byRank = new Map<Rank, Card>()
    for (const c of avail) {
      if (!byRank.has(c.rank)) byRank.set(c.rank, c)
    }
    const singles = Array.from(byRank.values()).slice(0, 2)
    if (singles.length === 2) {
      results.push({
        type: CardType.FOUR_WITH_TWO_SINGLES,
        cards: [...fourCards, ...singles],
        mainValue: fourRank,
        length: 1,
      })
    }
  }
}

/** 跟牌：四带二对 */
function findBeatingFourWithTwoPairs(
  groups: Map<Rank, Card[]>,
  counts: Map<Rank, number>,
  minValue: Rank,
  results: CardCombo[],
): void {
  const fourRanks = Array.from(counts.keys())
    .filter(r => (counts.get(r) ?? 0) >= 4 && r > minValue)
    .sort((a, b) => a - b)

  for (const fourRank of fourRanks) {
    const fourCards = groups.get(fourRank)!.slice(0, 4)
    const availPairRanks = Array.from(counts.keys())
      .filter(r => r !== fourRank && (counts.get(r) ?? 0) >= 2)
      .sort((a, b) => a - b)

    if (availPairRanks.length >= 2) {
      const pairCards: Card[] = []
      for (const r of availPairRanks.slice(0, 2)) {
        pairCards.push(...groups.get(r)!.slice(0, 2))
      }
      results.push({
        type: CardType.FOUR_WITH_TWO_PAIRS,
        cards: [...fourCards, ...pairCards],
        mainValue: fourRank,
        length: 1,
      })
    }
  }
}
