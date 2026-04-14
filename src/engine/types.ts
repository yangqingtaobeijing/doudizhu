/**
 * 斗地主核心数据类型定义
 * 按 PRD 规范严格定义所有牌型、角色、游戏状态
 */

/** 花色 */
export enum Suit {
  Spade = 'spade',       // ♠ 黑桃
  Heart = 'heart',       // ♥ 红心
  Diamond = 'diamond',   // ♦ 方块
  Club = 'club',         // ♣ 梅花
  Joker = 'joker',       // 王牌（大小王）
}

/** 牌面点数（权值，用于比较大小） */
export enum Rank {
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
  Two = 15,
  JokerSmall = 16,    // 小王
  JokerBig = 17,      // 大王
}

/** 单张牌 */
export interface Card {
  id: number            // 唯一标识 0~53
  suit: Suit            // 花色
  rank: Rank            // 点数（权值 3~17）
  display: string       // 显示文字，如 "♠3", "大王"
}

/** 牌型枚举 — 14种合法牌型 */
export enum CardType {
  SINGLE = 'single',                       // 单牌
  PAIR = 'pair',                           // 对子
  TRIPLE = 'triple',                       // 三条
  TRIPLE_WITH_SINGLE = 'triple_with_single', // 三带一
  TRIPLE_WITH_PAIR = 'triple_with_pair',   // 三带二
  STRAIGHT = 'straight',                   // 顺子（5~12张连续单牌）
  STRAIGHT_PAIR = 'straight_pair',         // 连对（3~10组连续对子）
  PLANE = 'plane',                         // 飞机不带（2+组连续三条）
  PLANE_WITH_SINGLES = 'plane_with_singles', // 飞机带单
  PLANE_WITH_PAIRS = 'plane_with_pairs',   // 飞机带对
  FOUR_WITH_TWO_SINGLES = 'four_with_two_singles', // 四带二单
  FOUR_WITH_TWO_PAIRS = 'four_with_two_pairs',     // 四带二对
  BOMB = 'bomb',                           // 炸弹（4张同点数）
  ROCKET = 'rocket',                       // 火箭（大小王）
}

/** 牌型识别结果 */
export interface CardCombo {
  type: CardType        // 牌型类型
  cards: Card[]         // 组成该牌型的所有牌
  mainValue: Rank       // 主体牌的点数（用于比较大小）
  length: number        // 对于顺子类，表示连续数量；其他牌型为1
}

/** 玩家角色 */
export enum Role {
  Landlord = 'landlord',   // 地主
  Farmer = 'farmer',       // 农民
}

/** AI 难度 */
export type Difficulty = 'easy' | 'normal' | 'hard'

/** 玩家 */
export interface Player {
  id: number              // 0=玩家, 1=AI左, 2=AI右
  name: string            // 昵称
  role: Role | null       // 角色，选择前为null
  hand: Card[]            // 当前手牌
  isAI: boolean           // 是否为AI
}

/** 游戏阶段 */
export enum GamePhase {
  Idle = 'idle',                   // 首页待机
  Dealing = 'dealing',             // 发牌阶段
  RoleSelect = 'role_select',     // 角色选择
  Playing = 'playing',             // 出牌阶段
  Settlement = 'settlement',       // 结算阶段
}

/** 出牌记录 */
export interface PlayRecord {
  playerIndex: number       // 出牌玩家索引
  combo: CardCombo | null   // null 表示 Pass
  timestamp: number         // 时间戳
}

/** 游戏状态 */
export interface GameState {
  phase: GamePhase                     // 当前阶段
  players: [Player, Player, Player]    // 固定三人
  currentPlayerIndex: number           // 当前出牌玩家 0/1/2
  deck: Card[]                         // 完整牌组（用于初始化）
  landlordCards: Card[]                // 底牌（3张）
  lastPlay: CardCombo | null           // 场上最后一次有效出牌
  lastPlayerIndex: number | null       // 最后出牌的玩家索引
  passCount: number                    // 连续 Pass 次数（=2 时重置出牌权）
  scores: {
    player: number                     // 玩家累计积分
    ai1: number                        // AI1 累计积分
    ai2: number                        // AI2 累计积分
  }
  bombCount: number                    // 本局出现的炸弹/火箭数（用于翻倍）
  turnHistory: PlayRecord[]            // 完整出牌历史
  difficulty: Difficulty               // AI 难度
  winner: Role | null                  // 获胜方
  isSpring: boolean                    // 是否春天
  isReverseSpring: boolean             // 是否反春天
}
