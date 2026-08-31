/**
 * DashboardView - Vista modular de métricas principales y KPIs
 */
import { LobbyService } from '../../services/lobby.service.js';
import { appStore } from '../../core/store.js';
import { dashboardCharts } from './dashboard.charts.js';

export const DashboardView = {
  async mount(container, params = {}) {
    if (typeof window.renderDashboard === 'function') {
      window.renderDashboard(container);
    }
  },

  unmount() {
    dashboardCharts.destroyAll();
  }
};
