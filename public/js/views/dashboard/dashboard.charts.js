/**
 * DashboardCharts - Gestión y ciclo de vida de gráficos ApexCharts
 */
export class DashboardChartsManager {
  constructor() {
    this.instances = {
      distribucion: null,
      evolucion: null,
      cumplimiento: null,
      topAutoridades: null
    };
  }

  destroyAll() {
    Object.keys(this.instances).forEach(key => {
      if (this.instances[key]) {
        try {
          this.instances[key].destroy();
        } catch (err) {
          console.debug(`[DashboardCharts] Gráfico ${key} ya liberado:`, err);
        }
        this.instances[key] = null;
      }
    });
  }
}

export const dashboardCharts = new DashboardChartsManager();
