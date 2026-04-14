<script setup lang="ts">
/**
 * 扑克牌组件
 * 显示单张扑克牌，支持正面/背面、选中状态
 * 红色花色(♥♦)红字，黑色花色(♠♣)黑字，大小王特殊显示
 */
import { computed } from 'vue'
import { Suit, Rank } from '@/engine/types'
import type { Card } from '@/engine/types'

const props = withDefaults(defineProps<{
  /** 牌数据，背面模式下可不传 */
  card?: Card
  /** 是否显示背面 */
  faceDown?: boolean
  /** 是否选中（上移效果） */
  selected?: boolean
  /** 是否可点击 */
  clickable?: boolean
  /** 缩放大小：sm / md / lg */
  size?: 'sm' | 'md' | 'lg'
}>(), {
  faceDown: false,
  selected: false,
  clickable: false,
  size: 'md',
})

const emit = defineEmits<{
  (e: 'click', card: Card): void
}>()

/** 花色符号映射 */
const SUIT_SYMBOL: Record<string, string> = {
  [Suit.Spade]: '♠',
  [Suit.Heart]: '♥',
  [Suit.Diamond]: '♦',
  [Suit.Club]: '♣',
}

/** 点数显示映射 */
const RANK_DISPLAY: Record<number, string> = {
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
}

/** 是否红色花色 */
const isRed = computed(() => {
  if (!props.card) return false
  return (
    props.card.suit === Suit.Heart ||
    props.card.suit === Suit.Diamond ||
    props.card.rank === Rank.JokerBig
  )
})

/** 是否王牌 */
const isJoker = computed(() => {
  if (!props.card) return false
  return props.card.suit === Suit.Joker
})

/** 花色符号 */
const suitSymbol = computed(() => {
  if (!props.card || isJoker.value) return ''
  return SUIT_SYMBOL[props.card.suit] || ''
})

/** 点数文字 */
const rankText = computed(() => {
  if (!props.card) return ''
  if (props.card.rank === Rank.JokerBig) return '大'
  if (props.card.rank === Rank.JokerSmall) return '小'
  return RANK_DISPLAY[props.card.rank] || ''
})

/** 王牌标签 */
const jokerLabel = computed(() => {
  if (!props.card) return ''
  if (props.card.rank === Rank.JokerBig) return '王'
  if (props.card.rank === Rank.JokerSmall) return '王'
  return ''
})

/** 尺寸类 — 整体放大 */
const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-12 h-17 text-xs'
    case 'lg': return 'w-24 h-34 text-xl'
    default: return 'w-18 h-26 text-base'
  }
})

function handleClick() {
  if (props.clickable && props.card) {
    emit('click', props.card)
  }
}
</script>

<template>
  <div
    class="playing-card inline-flex flex-col items-center justify-start rounded-lg border border-gray-300 shadow-md transition-all duration-150 select-none flex-shrink-0"
    :class="[
      sizeClasses,
      faceDown ? 'bg-gradient-to-br from-blue-700 to-blue-900 border-blue-600' : 'bg-white',
      selected ? 'ring-2 ring-yellow-400 shadow-yellow-400/40 shadow-lg z-50' : 'z-10',
      clickable ? 'cursor-pointer hover:-translate-y-1 active:scale-95' : '',
    ]"
    @click="handleClick"
  >
    <!-- 牌背面 -->
    <template v-if="faceDown">
      <div class="flex-1 flex items-center justify-center">
        <div class="w-3/4 h-3/4 rounded border border-blue-400/30 bg-blue-800/50 flex items-center justify-center">
          <span class="text-blue-300/50 font-bold" :class="size === 'sm' ? 'text-xs' : 'text-base'">🂠</span>
        </div>
      </div>
    </template>

    <!-- 牌正面 -->
    <template v-else-if="card">
      <!-- 王牌特殊显示 -->
      <template v-if="isJoker">
        <div class="flex-1 flex flex-col items-center justify-center leading-tight"
             :class="isRed ? 'text-red-600' : 'text-gray-800'">
          <span class="font-bold" :class="size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-base'">
            {{ rankText }}
          </span>
          <span class="font-bold" :class="size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-base'">
            {{ jokerLabel }}
          </span>
        </div>
      </template>

      <!-- 常规牌 -->
      <template v-else>
        <div class="flex flex-col items-start w-full px-1 pt-0.5 leading-tight"
             :class="isRed ? 'text-red-600' : 'text-gray-900'">
          <span class="font-bold" :class="size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-lg' : 'text-sm'">
            {{ rankText }}
          </span>
          <span :class="size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-lg' : 'text-xs'">
            {{ suitSymbol }}
          </span>
        </div>
        <!-- 中间花色 -->
        <div class="flex-1 flex items-center justify-center"
             :class="isRed ? 'text-red-600' : 'text-gray-900'">
          <span :class="size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-xl'">
            {{ suitSymbol }}
          </span>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.playing-card {
  aspect-ratio: auto;
  position: relative;
}
/* sm 尺寸 */
.w-12 { width: 3rem; }
.h-17 { height: 4.25rem; }
/* md 尺寸（放大后） */
.w-18 { width: 4.5rem; }
.h-26 { height: 6.5rem; }
/* lg 尺寸（放大后） */
.w-24 { width: 6rem; }
.h-34 { height: 8.5rem; }
</style>
