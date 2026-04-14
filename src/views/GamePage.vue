<script setup lang="ts">
/**
 * 游戏桌页面 — 核心页面
 *
 * 布局：顶部两个AI，底部玩家手牌，中央出牌区
 * 交互：选牌、出牌、不出、角色选择弹窗、AI思考动画
 */
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { identifyCardType, findAllPlays, canBeat } from '@/engine/cardUtils'
import { GamePhase, Role } from '@/engine/types'
import type { Card, CardCombo } from '@/engine/types'
import PlayingCard from '@/components/PlayingCard.vue'

const router = useRouter()
const store = useGameStore()

// ============================================================
// 玩家选牌状态
// ============================================================

/** 已选中的牌 ID 集合 */
const selectedCardIds = ref<Set<number>>(new Set())
/** 提示信息 */
const hintMessage = ref('')
/** 提示索引（循环切换） */
const hintIndex = ref(0)
/** AI 是否正在思考 */
const aiThinking = ref(false)
/** 最近各玩家出牌记录（用于中央显示） */
const recentPlays = ref<(CardCombo | null | 'pass')[]>([null, null, null])

// ============================================================
// 计算属性
// ============================================================

/** 玩家手牌（从store获取，按点数排好序） */
const playerHand = computed(() => store.players[0].hand)

/** 当前选中的牌列表 */
const selectedCards = computed(() =>
  playerHand.value.filter(c => selectedCardIds.value.has(c.id)),
)

/** 选中的牌是否合法 */
const selectedCombo = computed<CardCombo | null>(() => {
  if (selectedCards.value.length === 0) return null
  return identifyCardType(selectedCards.value)
})

/** 出牌按钮是否可用 */
const canPlay = computed(() => {
  if (store.phase !== GamePhase.Playing) return false
  if (store.currentPlayerIndex !== 0) return false
  if (!selectedCombo.value) return false
  // 如果需要跟牌，检查是否能压过
  if (store.lastPlay && store.lastPlayerIndex !== 0) {
    return canBeat(selectedCombo.value, store.lastPlay)
  }
  return true
})

/** 不出按钮是否可用（被动跟牌时才能不出） */
const canPass = computed(() => {
  if (store.phase !== GamePhase.Playing) return false
  if (store.currentPlayerIndex !== 0) return false
  // 有上家出牌且不是自己
  return store.lastPlay !== null && store.lastPlayerIndex !== 0
})

/** 是否轮到玩家 */
const isPlayerTurn = computed(() =>
  store.phase === GamePhase.Playing && store.currentPlayerIndex === 0 && !aiThinking.value,
)

/** 获取玩家名和角色标签 */
function getPlayerLabel(index: number): string {
  const p = store.players[index]
  if (p.role === Role.Landlord) return '地主'
  if (p.role === Role.Farmer) return '农民'
  return ''
}

function getPlayerRoleClass(index: number): string {
  const p = store.players[index]
  if (p.role === Role.Landlord) return 'text-yellow-400'
  return 'text-green-400'
}

// ============================================================
// 交互方法
// ============================================================

/** 点击牌，切换选中 */
function toggleCard(card: Card) {
  if (!isPlayerTurn.value) return
  const newSet = new Set(selectedCardIds.value)
  if (newSet.has(card.id)) {
    newSet.delete(card.id)
  } else {
    newSet.add(card.id)
  }
  selectedCardIds.value = newSet
  hintMessage.value = ''
}

/** 出牌 */
function playCards() {
  if (!canPlay.value || selectedCards.value.length === 0) {
    hintMessage.value = '请选择合法的牌型'
    return
  }

  const success = store.playCards(0, selectedCards.value)
  if (success) {
    recentPlays.value[0] = selectedCombo.value
    selectedCardIds.value = new Set()
    hintMessage.value = ''
    hintIndex.value = 0

    // 检查游戏是否结束
    if (store.phase === GamePhase.Settlement) {
      setTimeout(() => router.push('/result'), 800)
      return
    }

    // 触发AI出牌
    nextTick(() => runAiTurn())
  } else {
    hintMessage.value = '出牌不合法，请重新选择'
  }
}

/** 不出 */
function passTurn() {
  if (!canPass.value) return

  const success = store.pass(0)
  if (success) {
    recentPlays.value[0] = 'pass'
    selectedCardIds.value = new Set()
    hintMessage.value = ''
    hintIndex.value = 0

    nextTick(() => runAiTurn())
  }
}

/** 提示功能：高亮一组可出的牌 */
function showHint() {
  if (!isPlayerTurn.value) return

  const plays = findAllPlays(playerHand.value, store.lastPlay && store.lastPlayerIndex !== 0 ? store.lastPlay : null)
  if (plays.length === 0) {
    hintMessage.value = '没有可出的牌，请选择不出'
    return
  }

  hintIndex.value = hintIndex.value % plays.length
  const hint = plays[hintIndex.value]
  selectedCardIds.value = new Set(hint.cards.map(c => c.id))
  hintMessage.value = ''
  hintIndex.value = (hintIndex.value + 1) % plays.length
}

// ============================================================
// AI 出牌逻辑
// ============================================================

/** 运行AI出牌回合 */
async function runAiTurn() {
  while (store.phase === GamePhase.Playing && store.currentPlayerIndex !== 0) {
    const aiIndex = store.currentPlayerIndex
    aiThinking.value = true

    // 模拟思考延迟
    await delay(800 + Math.random() * 800)

    if (store.phase !== GamePhase.Playing) break

    const aiHand = store.players[aiIndex].hand
    const lastPlay = store.lastPlay && store.lastPlayerIndex !== aiIndex ? store.lastPlay : null
    const plays = findAllPlays(aiHand, lastPlay)

    if (plays.length > 0) {
      // 简单AI策略：随机选一个合法出牌（实际AI模块可替换此逻辑）
      const chosen = selectAiPlay(plays, aiIndex)
      store.playCards(aiIndex, chosen.cards)
      recentPlays.value[aiIndex] = chosen
    } else {
      // 没有可出的牌，Pass
      store.pass(aiIndex)
      recentPlays.value[aiIndex] = 'pass'
    }

    aiThinking.value = false

    // 检查游戏结束（playCards 内部可能改变 phase）
    if ((store.phase as GamePhase) === GamePhase.Settlement) {
      await delay(600)
      router.push('/result')
      return
    }

    // 短暂延迟让玩家看清
    await delay(300)
  }
  aiThinking.value = false
}

/** AI选牌策略（简化版，按难度选择） */
function selectAiPlay(plays: CardCombo[], _aiIndex: number): CardCombo {
  const diff = store.difficulty
  if (diff === 'easy') {
    // 简单：随机出最小的
    plays.sort((a, b) => a.mainValue - b.mainValue)
    return plays[0]
  } else if (diff === 'hard') {
    // 困难：出中间偏大的牌
    plays.sort((a, b) => a.mainValue - b.mainValue)
    const idx = Math.min(plays.length - 1, Math.floor(plays.length * 0.6))
    return plays[idx]
  } else {
    // 普通：出最小的
    plays.sort((a, b) => a.mainValue - b.mainValue)
    const idx = Math.min(plays.length - 1, Math.floor(plays.length * 0.3))
    return plays[idx]
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================
// 退出游戏
// ============================================================

function confirmQuit() {
  if (window.confirm('确定要退出当前游戏吗？')) {
    store.resetToIdle()
    router.replace('/')
  }
}

// ============================================================
// 角色选择
// ============================================================

function selectLandlord() {
  store.selectRole(Role.Landlord)
  recentPlays.value = [null, null, null]
  // 如果地主是AI先出牌
  nextTick(() => {
    if (store.currentPlayerIndex !== 0) {
      runAiTurn()
    }
  })
}

function selectFarmer() {
  store.selectRole(Role.Farmer)
  recentPlays.value = [null, null, null]
  // 地主是AI，触发AI出牌
  nextTick(() => {
    if (store.currentPlayerIndex !== 0) {
      runAiTurn()
    }
  })
}

// ============================================================
// 监听新一轮重置出牌区
// ============================================================

watch(
  () => store.lastPlay,
  (newVal) => {
    if (newVal === null) {
      // 新一轮开始，清空出牌区
      recentPlays.value = [null, null, null]
    }
  },
)

// ============================================================
// 页面初始化
// ============================================================

onMounted(() => {
  // 如果不在正确的游戏阶段，重定向到首页
  if (store.phase === GamePhase.Idle) {
    router.replace('/')
  }
})

/** 计算扑克牌重叠偏移 */
function cardOffset(index: number, total: number): string {
  // 牌之间重叠，每张偏移 30px，居中
  const cardWidth = 48 // 3rem
  const overlap = Math.min(30, (600 / Math.max(total, 1)))
  const totalWidth = cardWidth + (total - 1) * overlap
  const startX = -totalWidth / 2
  const x = startX + index * overlap
  return `translateX(${x}px)`
}
</script>

<template>
  <div class="h-screen w-screen bg-gradient-to-b from-[#073d22] via-[#0a5c36] to-[#084a2a] overflow-hidden relative select-none flex flex-col">

    <!-- 顶部状态栏 -->
    <div class="relative px-4 py-2 bg-black/20 text-sm shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-green-300/70 text-xs sm:text-sm">
            难度：<span class="text-yellow-300">{{ store.difficulty === 'easy' ? '简单' : store.difficulty === 'normal' ? '普通' : '困难' }}</span>
          </span>
          <span class="text-green-300/70 text-xs sm:text-sm">
            阶段：<span class="text-yellow-300">
              {{ store.phase === 'role_select' ? '角色选择' : store.phase === 'playing' ? '出牌中' : store.phase === 'dealing' ? '发牌中' : '' }}
            </span>
          </span>
          <!-- 底牌区 -->
          <div class="flex items-center gap-1">
            <span class="text-green-300/60 text-xs mr-1">底牌：</span>
            <PlayingCard
              v-for="card in store.landlordCards"
              :key="card.id"
              :card="card"
              :face-down="store.phase === 'role_select' || store.phase === 'dealing'"
              size="sm"
            />
          </div>
        </div>

        <!-- 退出按钮：独立在右侧，不挤压 -->
        <button
          @click="confirmQuit"
          class="ml-3 px-3 py-1.5 rounded text-xs font-medium bg-red-800/60 text-red-200 hover:bg-red-700/80 active:scale-95 transition-all shrink-0"
        >
          退出
        </button>
      </div>
    </div>

    <!-- 主游戏区域 -->
    <div class="flex-1 flex flex-col relative min-h-0">

      <!-- 上方AI区域 -->
      <div class="flex justify-between px-2 sm:px-8 pt-3 shrink-0 gap-4 sm:gap-8">
        <!-- AI 左 (player index 1) -->
        <div class="flex flex-col items-center gap-1 flex-1">
          <div class="flex items-center gap-1.5">
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-700 border-2 border-green-500 flex items-center justify-center text-base sm:text-lg">
              🤖
            </div>
            <div class="text-left">
              <div class="text-white text-xs sm:text-sm font-medium">AI-左</div>
              <div v-if="store.players[1].role" class="text-xs font-bold" :class="getPlayerRoleClass(1)">
                {{ store.players[1].role === 'landlord' ? '👑 地主' : '🌾 农民' }}
              </div>
            </div>
          </div>
          <!-- AI手牌：手机上只显示3张小牌 + 数量 -->
          <div class="flex mt-1">
            <PlayingCard
              v-for="i in Math.min(store.players[1].hand.length, 3)"
              :key="i"
              face-down
              size="sm"
              class="-ml-3 first:ml-0"
            />
            <span class="text-green-300/70 text-xs ml-1.5 self-center font-medium">
              ×{{ store.players[1].hand.length }}
            </span>
          </div>
          <!-- AI1 出牌展示 / 思考动画 -->
          <div class="min-h-[60px] flex items-center justify-center">
            <div v-if="aiThinking && store.currentPlayerIndex === 1" class="thinking-dots text-yellow-300 text-sm">
              思考中<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
            </div>
            <template v-else-if="recentPlays[1]">
              <div v-if="recentPlays[1] === 'pass'" class="text-white/60 text-sm bg-black/20 px-3 py-1 rounded-full">
                不出
              </div>
              <div v-else class="flex gap-0.5">
                <PlayingCard
                  v-for="card in (recentPlays[1] as CardCombo).cards"
                  :key="card.id"
                  :card="card"
                  size="sm"
                />
              </div>
            </template>
          </div>
        </div>

        <!-- AI 右 (player index 2) -->
        <div class="flex flex-col items-center gap-1 flex-1">
          <div class="flex items-center gap-1.5">
            <div class="text-right">
              <div class="text-white text-xs sm:text-sm font-medium">AI-右</div>
              <div v-if="store.players[2].role" class="text-xs font-bold" :class="getPlayerRoleClass(2)">
                {{ store.players[2].role === 'landlord' ? '👑 地主' : '🌾 农民' }}
              </div>
            </div>
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-700 border-2 border-green-500 flex items-center justify-center text-base sm:text-lg">
              🤖
            </div>
          </div>
          <!-- AI手牌：手机上只显示3张小牌 + 数量 -->
          <div class="flex mt-1">
            <PlayingCard
              v-for="i in Math.min(store.players[2].hand.length, 3)"
              :key="i"
              face-down
              size="sm"
              class="-ml-3 first:ml-0"
            />
            <span class="text-green-300/70 text-xs ml-1.5 self-center font-medium">
              ×{{ store.players[2].hand.length }}
            </span>
          </div>
          <!-- AI2 出牌展示 / 思考动画 -->
          <div class="min-h-[60px] flex items-center justify-center">
            <div v-if="aiThinking && store.currentPlayerIndex === 2" class="thinking-dots text-yellow-300 text-sm">
              思考中<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
            </div>
            <template v-else-if="recentPlays[2]">
              <div v-if="recentPlays[2] === 'pass'" class="text-white/60 text-sm bg-black/20 px-3 py-1 rounded-full">
                不出
              </div>
              <div v-else class="flex gap-0.5">
                <PlayingCard
                  v-for="card in (recentPlays[2] as CardCombo).cards"
                  :key="card.id"
                  :card="card"
                  size="sm"
                />
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 中央出牌区 -->
      <div class="flex-1 flex items-center justify-center min-h-[80px]">
        <div class="text-center">
          <!-- 玩家最近出牌 -->
          <template v-if="recentPlays[0]">
            <div v-if="recentPlays[0] === 'pass'" class="text-white/60 text-sm bg-black/20 px-4 py-2 rounded-full">
              不出
            </div>
            <div v-else class="flex gap-0.5 justify-center">
              <PlayingCard
                v-for="card in (recentPlays[0] as CardCombo).cards"
                :key="card.id"
                :card="card"
                size="sm"
              />
            </div>
          </template>
          <!-- 轮次提示 -->
          <div v-if="isPlayerTurn" class="text-yellow-300 text-sm mt-2 animate-pulse">
            轮到你出牌
          </div>
        </div>
      </div>

      <!-- 玩家区域 -->
      <div class="shrink-0 pb-3">
        <!-- 玩家信息 -->
        <div class="flex items-center justify-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-full bg-yellow-600 border-2 border-yellow-400 flex items-center justify-center text-sm">
            😀
          </div>
          <span class="text-white text-sm font-medium">{{ store.players[0].name }}</span>
          <span v-if="store.players[0].role" class="text-xs font-bold px-2 py-0.5 rounded-full"
                :class="store.players[0].role === 'landlord' ? 'bg-yellow-600/30 text-yellow-300' : 'bg-green-600/30 text-green-300'">
            {{ store.players[0].role === 'landlord' ? '👑 地主' : '🌾 农民' }}
          </span>
        </div>

        <!-- 提示消息 -->
        <div v-if="hintMessage" class="text-center text-red-400 text-xs mb-1 animate-pulse">
          {{ hintMessage }}
        </div>

        <!-- 玩家手牌 -->
        <div class="player-hand-scroll px-4">
          <div class="flex items-end justify-center" style="min-height: 8.5rem; padding-top: 1.5rem;">
            <div
              v-for="(card, index) in playerHand"
              :key="card.id"
              class="transition-all duration-150"
              :style="{
                marginLeft: index === 0 ? '0' : '-24px',
                marginBottom: selectedCardIds.has(card.id) ? '1.5rem' : '0',
              }"
            >
              <PlayingCard
                :card="card"
                :selected="selectedCardIds.has(card.id)"
                :clickable="isPlayerTurn"
                size="md"
                @click="toggleCard(card)"
              />
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-center gap-3 mt-3 px-4">
          <button
            @click="showHint"
            :disabled="!isPlayerTurn"
            class="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            :class="isPlayerTurn
              ? 'bg-green-700 text-green-100 hover:bg-green-600 active:scale-95'
              : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'"
          >
            提示
          </button>
          <button
            @click="passTurn"
            :disabled="!canPass"
            class="px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            :class="canPass
              ? 'bg-gray-600 text-gray-100 hover:bg-gray-500 active:scale-95'
              : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'"
          >
            不出
          </button>
          <button
            @click="playCards"
            :disabled="!canPlay"
            class="px-8 py-2 rounded-lg text-sm font-bold transition-all duration-200"
            :class="canPlay
              ? 'bg-gradient-to-b from-yellow-500 to-amber-600 text-gray-900 hover:from-yellow-400 hover:to-amber-500 active:scale-95 shadow-lg shadow-amber-700/30'
              : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'"
          >
            出牌
          </button>
        </div>
      </div>
    </div>

    <!-- ============== 角色选择弹窗 ============== -->
    <Teleport to="body">
      <div v-if="store.phase === 'role_select'" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="bg-gradient-to-b from-green-800 to-green-900 rounded-2xl p-8 shadow-2xl border border-green-600/30 max-w-md w-full mx-4">
          <h2 class="text-center text-2xl font-bold text-yellow-300 mb-6">请选择你的身份</h2>

          <div class="grid grid-cols-2 gap-4">
            <!-- 地主 -->
            <button
              @click="selectLandlord"
              class="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-yellow-600/40 bg-yellow-900/20 hover:bg-yellow-800/30 hover:border-yellow-500 hover:scale-105 transition-all duration-200"
            >
              <span class="text-4xl">👑</span>
              <span class="text-yellow-300 font-bold text-lg">地主</span>
              <span class="text-yellow-200/60 text-xs text-center">获得底牌<br>一人应战</span>
            </button>

            <!-- 农民 -->
            <button
              @click="selectFarmer"
              class="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-green-600/40 bg-green-900/20 hover:bg-green-800/30 hover:border-green-500 hover:scale-105 transition-all duration-200"
            >
              <span class="text-4xl">🌾</span>
              <span class="text-green-300 font-bold text-lg">农民</span>
              <span class="text-green-200/60 text-xs text-center">与AI组队<br>合作抗敌</span>
            </button>
          </div>

          <!-- 当前手牌预览 -->
          <div class="mt-6 pt-4 border-t border-green-600/20">
            <div class="text-green-300/60 text-xs text-center mb-2">你的手牌预览</div>
            <div class="flex justify-center overflow-x-auto">
              <div class="flex">
                <div
                  v-for="(card, index) in playerHand"
                  :key="card.id"
                  :style="{ marginLeft: index === 0 ? '0' : '-14px' }"
                >
                  <PlayingCard :card="card" size="sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* AI 思考动画 */
.thinking-dots .dot {
  animation: dotBlink 1.4s infinite;
  opacity: 0;
}
.thinking-dots .dot:nth-child(1) { animation-delay: 0s; }
.thinking-dots .dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots .dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes dotBlink {
  0%, 20% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}

/* 玩家手牌区域：横向可滚动，选中牌上移不被裁 */
.player-hand-scroll {
  overflow-x: auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  justify-content: center;
}
</style>
