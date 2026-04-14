/**
 * 游戏状态管理 — Pinia Store
 *
 * 管理完整的游戏状态机：
 * IDLE → DEALING → ROLE_SELECT → PLAYING → SETTLEMENT
 *
 * 包含：初始化、角色选择、出牌、跳过、胜负判定、计分
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  Card,
  CardCombo,
  CardType,
  Player,
  Role,
  GamePhase,
  PlayRecord,
  Difficulty,
} from '@/engine/types'
import {
  createDeck,
  shuffle,
  sortCards,
  identifyCardType,
  canBeat,
  findAllPlays,
} from '@/engine/cardUtils'

export const useGameStore = defineStore('game', () => {
  // ============================================================
  // 状态
  // ============================================================

  const phase = ref<GamePhase>(GamePhase.Idle)
  const players = ref<[Player, Player, Player]>([
    { id: 0, name: '玩家', role: null, hand: [], isAI: false },
    { id: 1, name: 'AI-左', role: null, hand: [], isAI: true },
    { id: 2, name: 'AI-右', role: null, hand: [], isAI: true },
  ])
  const currentPlayerIndex = ref<number>(0)
  const landlordCards = ref<Card[]>([])       // 底牌
  const lastPlay = ref<CardCombo | null>(null) // 场上最后一次有效出牌
  const lastPlayerIndex = ref<number | null>(null)
  const passCount = ref<number>(0)
  const bombCount = ref<number>(0)
  const turnHistory = ref<PlayRecord[]>([])
  const difficulty = ref<Difficulty>('normal')
  const winner = ref<Role | null>(null)
  const isSpring = ref<boolean>(false)
  const isReverseSpring = ref<boolean>(false)

  // 累计积分（跨局保存）
  const scores = ref({
    player: 0,
    ai1: 0,
    ai2: 0,
  })

  // ============================================================
  // 计算属性
  // ============================================================

  /** 当前出牌玩家 */
  const currentPlayer = computed(() => players.value[currentPlayerIndex.value])

  /** 地主玩家索引 */
  const landlordIndex = computed(() =>
    players.value.findIndex(p => p.role === Role.Landlord),
  )

  /** 当前玩家是否需要跟牌（有上家出牌且不是自己的牌） */
  const isFollowing = computed(() =>
    lastPlay.value !== null && lastPlayerIndex.value !== currentPlayerIndex.value,
  )

  // ============================================================
  // 初始化游戏
  // ============================================================

  /**
   * 初始化游戏：创建牌组、洗牌、发牌
   * 每人17张，3张底牌
   */
  function initGame(diff: Difficulty = 'normal'): void {
    // 重置所有状态
    difficulty.value = diff
    winner.value = null
    isSpring.value = false
    isReverseSpring.value = false
    bombCount.value = 0
    passCount.value = 0
    lastPlay.value = null
    lastPlayerIndex.value = null
    turnHistory.value = []
    currentPlayerIndex.value = 0

    // 创建并洗牌
    const deck = shuffle(createDeck())

    // 发牌：每人17张
    players.value[0] = {
      id: 0,
      name: '玩家',
      role: null,
      hand: sortCards(deck.slice(0, 17)),
      isAI: false,
    }
    players.value[1] = {
      id: 1,
      name: 'AI-左',
      role: null,
      hand: sortCards(deck.slice(17, 34)),
      isAI: true,
    }
    players.value[2] = {
      id: 2,
      name: 'AI-右',
      role: null,
      hand: sortCards(deck.slice(34, 51)),
      isAI: true,
    }

    // 3张底牌
    landlordCards.value = deck.slice(51, 54)

    // 进入发牌阶段
    phase.value = GamePhase.Dealing

    // 简化：直接跳到角色选择（后续可加发牌动画）
    setTimeout(() => {
      phase.value = GamePhase.RoleSelect
    }, 100)
  }

  // ============================================================
  // 角色选择
  // ============================================================

  /**
   * 玩家选择角色
   * @param role 'landlord' 或 'farmer'
   */
  function selectRole(role: Role): void {
    if (phase.value !== GamePhase.RoleSelect) return

    if (role === Role.Landlord) {
      // 玩家当地主，获得底牌
      players.value[0].role = Role.Landlord
      players.value[0].hand = sortCards([...players.value[0].hand, ...landlordCards.value])
      players.value[1].role = Role.Farmer
      players.value[2].role = Role.Farmer
      // 地主先出牌
      currentPlayerIndex.value = 0
    } else {
      // 玩家当农民，随机一个AI当地主
      players.value[0].role = Role.Farmer
      const landlordAI = Math.random() < 0.5 ? 1 : 2
      const farmerAI = landlordAI === 1 ? 2 : 1

      players.value[landlordAI].role = Role.Landlord
      players.value[landlordAI].hand = sortCards([
        ...players.value[landlordAI].hand,
        ...landlordCards.value,
      ])
      players.value[farmerAI].role = Role.Farmer
      // 地主先出牌
      currentPlayerIndex.value = landlordAI
    }

    // 进入出牌阶段
    phase.value = GamePhase.Playing
    // 重置出牌状态
    lastPlay.value = null
    lastPlayerIndex.value = null
    passCount.value = 0
  }

  // ============================================================
  // 出牌
  // ============================================================

  /**
   * 出牌
   * @param playerIndex 出牌玩家索引
   * @param cards 出的牌
   * @returns 是否出牌成功
   */
  function playCards(playerIndex: number, cards: Card[]): boolean {
    if (phase.value !== GamePhase.Playing) return false
    if (playerIndex !== currentPlayerIndex.value) return false

    const player = players.value[playerIndex]

    // 识别牌型
    const combo = identifyCardType(cards)
    if (!combo) return false // 不合法牌型

    // 如果需要跟牌，检查能否压过
    if (lastPlay.value && lastPlayerIndex.value !== playerIndex) {
      if (!canBeat(combo, lastPlay.value)) return false
    }

    // 从手牌中移除出的牌
    const playedIds = new Set(cards.map(c => c.id))
    player.hand = player.hand.filter(c => !playedIds.has(c.id))

    // 更新场上状态
    lastPlay.value = combo
    lastPlayerIndex.value = playerIndex
    passCount.value = 0

    // 记录炸弹/火箭
    if (combo.type === CardType.BOMB || combo.type === CardType.ROCKET) {
      bombCount.value++
    }

    // 记录出牌历史
    turnHistory.value.push({
      playerIndex,
      combo,
      timestamp: Date.now(),
    })

    // 检查胜负
    if (checkWin()) return true

    // 下一个玩家
    nextPlayer()
    return true
  }

  // ============================================================
  // 跳过（Pass）
  // ============================================================

  /**
   * 当前玩家选择不出牌
   */
  function pass(playerIndex: number): boolean {
    if (phase.value !== GamePhase.Playing) return false
    if (playerIndex !== currentPlayerIndex.value) return false
    // 主动出牌时不能 Pass（必须出牌）
    if (!lastPlay.value || lastPlayerIndex.value === playerIndex) return false

    passCount.value++

    // 记录 Pass
    turnHistory.value.push({
      playerIndex,
      combo: null,
      timestamp: Date.now(),
    })

    // 两家都 Pass，重置出牌权
    if (passCount.value >= 2) {
      lastPlay.value = null
      lastPlayerIndex.value = null
      passCount.value = 0
    }

    nextPlayer()
    return true
  }

  // ============================================================
  // 胜负判定
  // ============================================================

  /**
   * 检查是否有人出完牌
   */
  function checkWin(): boolean {
    for (const player of players.value) {
      if (player.hand.length === 0) {
        // 该玩家出完牌
        if (player.role === Role.Landlord) {
          winner.value = Role.Landlord

          // 检查春天：两个农民一张都没出过
          const farmers = players.value.filter(p => p.role === Role.Farmer)
          const farmersNeverPlayed = farmers.every(f => {
            const originalCount = f.id === landlordIndex.value ? 20 : 17
            return f.hand.length === 17 // 农民始终是17张
          })
          isSpring.value = farmersNeverPlayed
        } else {
          winner.value = Role.Farmer

          // 检查反春天：地主一张都没出过（仍有20张手牌）
          const landlord = players.value.find(p => p.role === Role.Landlord)
          if (landlord && landlord.hand.length === 20) {
            isReverseSpring.value = true
          }
        }

        calculateScore()
        phase.value = GamePhase.Settlement
        return true
      }
    }
    return false
  }

  // ============================================================
  // 计分
  // ============================================================

  /**
   * 计算本局得分
   *
   * 基础分：100
   * 地主赢：+200（各农民 -100）
   * 农民赢：各农民 +100（地主 -200）
   * 春天/反春天：×2
   * 每个炸弹/火箭：总分 ×2
   */
  function calculateScore(): {
    playerScore: number
    ai1Score: number
    ai2Score: number
    multiplier: number
  } {
    const baseScore = 100
    let multiplier = 1

    // 春天/反春天翻倍
    if (isSpring.value || isReverseSpring.value) {
      multiplier *= 2
    }

    // 炸弹/火箭翻倍
    for (let i = 0; i < bombCount.value; i++) {
      multiplier *= 2
    }

    // 地主赢：地主 +200*multiplier，各农民 -100*multiplier
    // 农民赢：各农民 +100*multiplier，地主 -200*multiplier
    const landlordWin = winner.value === Role.Landlord
    const landlordDelta = landlordWin ? 200 * multiplier : -200 * multiplier
    const farmerDelta = landlordWin ? -100 * multiplier : 100 * multiplier

    const result = { playerScore: 0, ai1Score: 0, ai2Score: 0, multiplier }

    for (const player of players.value) {
      const delta = player.role === Role.Landlord ? landlordDelta : farmerDelta
      if (player.id === 0) {
        scores.value.player += delta
        result.playerScore = delta
      } else if (player.id === 1) {
        scores.value.ai1 += delta
        result.ai1Score = delta
      } else {
        scores.value.ai2 += delta
        result.ai2Score = delta
      }
    }

    // 持久化到 localStorage
    try {
      localStorage.setItem('doudizhu_scores', JSON.stringify(scores.value))
    } catch {
      // 静默处理存储错误
    }

    return result
  }

  // ============================================================
  // 轮转
  // ============================================================

  /**
   * 轮转到下一个玩家（逆时针：0→1→2→0）
   */
  function nextPlayer(): void {
    currentPlayerIndex.value = (currentPlayerIndex.value + 1) % 3
  }

  // ============================================================
  // 初始化累计积分
  // ============================================================

  function loadScores(): void {
    try {
      const saved = localStorage.getItem('doudizhu_scores')
      if (saved) {
        scores.value = JSON.parse(saved)
      }
    } catch {
      // 使用默认值
    }
  }

  /**
   * 重置到首页
   */
  function resetToIdle(): void {
    phase.value = GamePhase.Idle
  }

  // 初始化时加载积分
  loadScores()

  return {
    // 状态
    phase,
    players,
    currentPlayerIndex,
    landlordCards,
    lastPlay,
    lastPlayerIndex,
    passCount,
    bombCount,
    turnHistory,
    difficulty,
    winner,
    isSpring,
    isReverseSpring,
    scores,

    // 计算属性
    currentPlayer,
    landlordIndex,
    isFollowing,

    // 方法
    initGame,
    selectRole,
    playCards,
    pass,
    checkWin,
    calculateScore,
    nextPlayer,
    resetToIdle,
  }
})
