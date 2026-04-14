<script setup lang="ts">
/**
 * 首页
 * 游戏标题、AI难度选择、开始游戏按钮
 * 深绿色牌桌风格，中式大气
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import type { Difficulty } from '@/engine/types'

const router = useRouter()
const store = useGameStore()

const selectedDifficulty = ref<Difficulty>('normal')

const difficulties: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'easy', label: '简单', desc: '新手入门' },
  { value: 'normal', label: '普通', desc: '经典对局' },
  { value: 'hard', label: '困难', desc: '高手挑战' },
]

/** 开始游戏 */
function startGame() {
  store.initGame(selectedDifficulty.value)
  router.push('/game')
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-[#0a4a2e] via-[#0a5c36] to-[#073d22] flex flex-col items-center justify-center px-4">
    <!-- 装饰线 -->
    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-600/60 to-transparent"></div>

    <!-- 主内容 -->
    <div class="text-center space-y-10">
      <!-- Logo/标题 -->
      <div class="space-y-3">
        <div class="text-6xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-500 to-amber-700 drop-shadow-lg tracking-widest">
          斗地主
        </div>
        <div class="text-sm sm:text-base text-yellow-200/60 tracking-[0.3em]">
          经典单机 · 三人对局
        </div>
      </div>

      <!-- 难度选择 -->
      <div class="space-y-3">
        <div class="text-sm text-green-200/70 tracking-wide">选择难度</div>
        <div class="flex gap-3 justify-center">
          <button
            v-for="diff in difficulties"
            :key="diff.value"
            @click="selectedDifficulty = diff.value"
            class="relative px-6 py-3 rounded-xl border-2 transition-all duration-200 min-w-[100px]"
            :class="selectedDifficulty === diff.value
              ? 'bg-yellow-600/30 border-yellow-500 text-yellow-200 shadow-lg shadow-yellow-600/20'
              : 'bg-green-800/40 border-green-600/40 text-green-300/70 hover:border-green-400/60 hover:text-green-200'"
          >
            <div class="font-bold text-lg">{{ diff.label }}</div>
            <div class="text-xs mt-0.5 opacity-70">{{ diff.desc }}</div>
          </button>
        </div>
      </div>

      <!-- 开始游戏 -->
      <button
        @click="startGame"
        class="group relative px-12 py-4 bg-gradient-to-b from-yellow-500 to-amber-600 text-gray-900 font-bold text-xl rounded-2xl shadow-lg shadow-amber-700/40 hover:from-yellow-400 hover:to-amber-500 hover:shadow-xl hover:shadow-amber-600/50 active:scale-95 transition-all duration-200 tracking-wider"
      >
        开始游戏
        <div class="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </button>

      <!-- 累计积分 -->
      <div class="text-green-300/50 text-sm space-x-6">
        <span>玩家积分：<span class="text-yellow-300/70 font-mono">{{ store.scores.player }}</span></span>
      </div>
    </div>

    <!-- 底部装饰 -->
    <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-600/60 to-transparent"></div>
  </div>
</template>
