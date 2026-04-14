/**
 * 路由配置
 * 三个页面：首页、游戏桌、结算页
 */
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('@/views/HomePage.vue'),
    },
    {
      path: '/game',
      name: 'Game',
      component: () => import('@/views/GamePage.vue'),
    },
    {
      path: '/result',
      name: 'Result',
      component: () => import('@/views/ResultPage.vue'),
    },
  ],
})

export default router
