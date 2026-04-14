<script setup lang="ts">
/**
 * 结算页面
 * 显示胜负结果、得分、倍数信息
 * 提供「再来一局」和「返回首页」按钮
 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { Role, GamePhase } from '@/engine/types'

const router = useRouter()
const store = useGameStore()

/** 玩家是否获胜 */
const playerWon = computed(() => {
  if (!store.winner) return false
  return store.players[0].role === store.winner
})

/** 获胜方文字 */
const winnerText = computed(() => {
  if (store.winner === Role.Landlord) return '地主胜利！'
  if (store.winner === Role.Farmer) return '农民胜利！'
  return ''
})

/** 获胜方emoji */
const winnerEmoji = computed(() => {
  if (store.winner === Role.Landlord) return '👑'
  return '🌾'
})

/** 计算本局得分详情 */
const scoreDetail = computed(() => {
  const baseScore = 100
  let multiplier = 1
  const details: string[] = []

  details.push(`底分：${baseScore}`)

  if (store.isSpring || store.isReverseSpring) {
    multiplier *= 2
    details.push(store.isSpring ? '春天 ×2' : '反春天 ×2')
  }

  for (let i = 0; i < store.bombCount; i++) {
    multiplier *= 2
    details.push(`炸弹/火箭 ×2`)
  }

  const landlordWin = store.winner === Role.Landlord
  const landlordDelta = landlordWin ? 200 * multiplier : -200 * multiplier
  const farmerDelta = landlordWin ? -100 * multiplier : 100 * multiplier

  const playerDelta = store.players[0].role === Role.Landlord ? landlordDelta : farmerDelta

  return {
    details,
    multiplier,
    playerDelta,
    totalScore: store.scores.player,
  }
})

/** 各玩家得分 */
const playerScores = computed(() => {
  const landlordWin = store.winner === Role.Landlord
  const m = scoreDetail.value.multiplier
  return store.players.map(p => {
    const isLandlord = p.role === Role.Landlord
    const delta = isLandlord
      ? (landlordWin ? 200 * m : -200 * m)
      : (landlordWin ? -100 * m : 100 * m)
    return {
      name: p.name,
      role: p.role,
      delta,
      handLeft: p.hand.length,
    }
  })
})

/** 再来一局 */
function playAgain() {
  store.initGame(store.difficulty)
  router.push('/game')
}

/** 返回首页 */
function goHome() {
  store.resetToIdle()
  router.push('/')
}

onMounted(() => {
  // 如果不在结算阶段，重定向
  if (store.phase !== GamePhase.Settlement) {
    router.replace('/')
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-[#073d22] via-[#0a5c36] to-[#084a2a] flex items-center justify-center px-4">
    <div class="max-w-md w-full">
      <!-- 结果卡片 -->
      <div class="bg-gradient-to-b from-green-800/80 to-green-900/80 rounded-2xl p-8 shadow-2xl border border-green-600/20 text-center">

        <!-- 胜负标题 -->
        <div class="mb-6">
          <div class="text-5xl mb-3">{{ winnerEmoji }}</div>
          <h1 class="text-3xl font-black"
              :class="playerWon ? 'text-yellow-300' : 'text-red-400'">
            {{ playerWon ? '恭喜获胜！' : '你输了...' }}
          </h1>
          <div class="text-green-300/60 text-sm mt-1">{{ winnerText }}</div>
        </div>

        <!-- 得分详情 -->
        <div class="bg-black/20 rounded-xl p-4 mb-6 space-y-2 text-left">
          <div v-for="detail in scoreDetail.details" :key="detail" class="flex justify-between text-sm text-green-300/70">
            <span>{{ detail }}</span>
          </div>
          <div class="border-t border-green-600/20 pt-2 flex justify-between font-bold">
            <span class="text-green-200">本局得分</span>
            <span :class="scoreDetail.playerDelta >= 0 ? 'text-yellow-300' : 'text-red-400'">
              {{ scoreDetail.playerDelta >= 0 ? '+' : '' }}{{ scoreDetail.playerDelta }}
            </span>
          </div>
        </div>

        <!-- 各玩家详情 -->
        <div class="space-y-2 mb-6">
          <div v-for="ps in playerScores" :key="ps.name"
               class="flex items-center justify-between bg-black/10 rounded-lg px-4 py-2 text-sm">
            <div class="flex items-center gap-2">
              <span>{{ ps.name }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded-full"
                    :class="ps.role === 'landlord' ? 'bg-yellow-600/30 text-yellow-300' : 'bg-green-600/30 text-green-300'">
                {{ ps.role === 'landlord' ? '地主' : '农民' }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-green-300/50 text-xs">剩{{ ps.handLeft }}张</span>
              <span class="font-bold" :class="ps.delta >= 0 ? 'text-yellow-300' : 'text-red-400'">
                {{ ps.delta >= 0 ? '+' : '' }}{{ ps.delta }}
              </span>
            </div>
          </div>
        </div>

        <!-- 累计积分 -->
        <div class="text-green-300/50 text-sm mb-6">
          累计积分：<span class="text-yellow-300 font-bold">{{ scoreDetail.totalScore }}</span>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-3 justify-center">
          <button
            @click="goHome"
            class="px-6 py-3 bg-green-700 text-green-100 rounded-xl hover:bg-green-600 active:scale-95 transition-all duration-200 font-medium"
          >
            返回首页
          </button>
          <button
            @click="playAgain"
            class="px-8 py-3 bg-gradient-to-b from-yellow-500 to-amber-600 text-gray-900 font-bold rounded-xl shadow-lg shadow-amber-700/30 hover:from-yellow-400 hover:to-amber-500 active:scale-95 transition-all duration-200"
          >
            再来一局
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
