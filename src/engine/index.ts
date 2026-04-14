/**
 * 引擎模块统一导出
 *
 * 外部代码从 '@/engine' 导入类型和工具函数，
 * 无需关心内部文件结构。
 */

// 所有类型
export {
  Suit,
  Rank,
  CardType,
  Role,
  GamePhase,
} from './types'

export type {
  Card,
  CardCombo,
  Player,
  PlayRecord,
  GameState,
  Difficulty,
} from './types'

// 核心工具函数
export {
  createDeck,
  shuffle,
  sortCards,
  identifyCardType,
  canBeat,
  findAllPlays,
} from './cardUtils'
