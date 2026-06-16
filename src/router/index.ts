import { createRouter, createWebHashHistory } from 'vue-router'
import { useBeadStore } from '../stores/beadStore'
import DesignPage from '../pages/DesignPage.vue'
import FocusPage from '../pages/FocusPage.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: DesignPage },
    {
      path: '/focus',
      component: FocusPage,
      beforeEnter: () => {
        const beadStore = useBeadStore()
        if (!beadStore.beadGrid) return '/'
        return true
      },
    },
  ],
})

export default router
