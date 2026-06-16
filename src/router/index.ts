import { createRouter, createWebHashHistory } from 'vue-router'
import { useBeadStore } from '../stores/beadStore'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../pages/DesignPage.vue'),
    },
    {
      path: '/focus',
      component: () => import('../pages/FocusPage.vue'),
      beforeEnter: () => {
        const beadStore = useBeadStore()
        if (!beadStore.beadGrid) return '/'
        return true
      },
    },
  ],
})

export default router
