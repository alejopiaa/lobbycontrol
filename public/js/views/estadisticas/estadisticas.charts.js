/**
 * estadisticas.charts.js - Gestión y ciclo de vida de gráficos ApexCharts de Estadísticas
 * LobbyControl - Arquitectura Modular ESM
 */
export class EstadisticasChartsManager {
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
          console.debug(`[EstadisticasCharts] Gráfico ${key} ya liberado:`, err);
        }
        this.instances[key] = null;
      }
    });
  }

  updateTheme(isDark = null) {
    if (typeof ApexCharts === 'undefined') return;
    const dark = isDark !== null ? isDark : document.documentElement.classList.contains('dark');
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-primary').trim() || (dark ? '#e2e0ed' : '#18112b');
    const gridColor = style.getPropertyValue('--border-ui').trim() || (dark ? '#221e33' : '#edeaf5');

    const baseThemeOpts = {
      theme: { mode: dark ? 'dark' : 'light' },
      chart: { foreColor: textColor },
      grid: { borderColor: gridColor },
      tooltip: { theme: dark ? 'dark' : 'light' }
    };

    Object.keys(this.instances).forEach(key => {
      const instance = this.instances[key];
      if (instance) {
        try {
          instance.updateOptions(baseThemeOpts, false, true);
        } catch (err) {
          console.debug(`[EstadisticasCharts] Error actualizando tema en ${key}:`, err);
        }
      }
    });
  }

  renderCharts(customStore = null, customFilters = null) {
    const containerDist = document.getElementById('chart-distribucion-estados');
    const containerEvol = document.getElementById('chart-evolucion-mensual');
    const containerCumpl = document.getElementById('chart-cumplimiento-plazos');
    const containerTop = document.getElementById('chart-top-autoridades');

    if (!containerDist || !containerEvol || !containerCumpl || !containerTop) return;

    this.destroyAll();

    if (typeof ApexCharts === 'undefined') {
      console.warn('ApexCharts no está cargado.');
      return;
    }

    // Detectar tema actual y leer variables CSS computadas (@theme Sincronización)
    const isDark = document.documentElement.classList.contains('dark');
    const style = getComputedStyle(document.documentElement);

    const colorBrand = style.getPropertyValue('--brand-600').trim() || '#7c3aed';
    const colorRose = isDark ? '#fda4af' : '#f43f5e';
    const colorSlate = isDark ? '#9a95b0' : '#9d8dbf';

    const textColor = isDark ? '#e2e0ed' : '#18112b';
    const gridColor = isDark ? '#221e33' : '#edeaf5';

    const store = customStore || (typeof window !== 'undefined' ? window.dataStore : {}) || {};
    const rawData = store.dashboardRawData || [];
    const filters = customFilters || (typeof window !== 'undefined' ? (window.estadisticasFilters || window.dashboardFilters) : {}) || {};
    const statsCalc = typeof window !== 'undefined' && typeof window.calculateDashboardStats === 'function'
      ? window.calculateDashboardStats
      : (data) => ({ totales: {}, estados: {} });
    const stats = statsCalc(rawData, filters);

    const cleanCargoFn = typeof window !== 'undefined' && typeof window.getCargoClean === 'function'
      ? window.getCargoClean
      : (c) => c || '';
    const normNameFn = typeof window !== 'undefined' && typeof window.normalizeName === 'function'
      ? window.normalizeName
      : (n) => n || '';

    const sujetoCache = (typeof window !== 'undefined' && window.activeSujetoIdsCache) || (typeof activeSujetoIdsCache !== 'undefined' ? activeSujetoIdsCache : null);

    // 1. Re-filtrar datos locales para cálculos temporales
    let filtered = rawData;
    if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
      if (sujetoCache && sujetoCache.size > 0) {
        filtered = filtered.filter(item => {
          const id = item.sujeto_pasivo_id;
          return id != null && (sujetoCache.has(Number(id)) || sujetoCache.has(String(id)));
        });
      }
    } else if (filters.vigencia === 'no_vigentes') {
      if (sujetoCache && sujetoCache.size > 0) {
        filtered = filtered.filter(item => {
          const id = item.sujeto_pasivo_id;
          return id == null || (!sujetoCache.has(Number(id)) && !sujetoCache.has(String(id)));
        });
      }
    }
    if (filters.anio && filters.anio !== 'TODOS') {
      filtered = filtered.filter(item => item.fecha_ingreso && item.fecha_ingreso.startsWith(filters.anio));
    }
    if (filters.fechaInicio) {
      filtered = filtered.filter(item => item.fecha_ingreso && item.fecha_ingreso.split(' ')[0] >= filters.fechaInicio);
    }
    if (filters.fechaTermino) {
      filtered = filtered.filter(item => item.fecha_ingreso && item.fecha_ingreso.split(' ')[0] <= filters.fechaTermino);
    }
    if (filters.nombre && filters.nombre.trim() !== '') {
      const val = filters.nombre.toLowerCase();
      filtered = filtered.filter(item => item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(val));
    }
    if (filters.cargo && filters.cargo.trim() !== '') {
      const val = filters.cargo.toLowerCase();
      filtered = filtered.filter(item => item.cargo && cleanCargoFn(item.cargo).toLowerCase().includes(val));
    }

    // GRÁFICO A: DISTRIBUCIÓN POR ESTADO (Donut)
    const distData = [
      stats.totales?.pendientes || 0,
      stats.estados?.aceptada?.count || 0,
      stats.estados?.rechazada?.count || 0,
      stats.estados?.suspendida?.count || 0,
      stats.estados?.cancelada?.count || 0,
      stats.estados?.encomendada?.count || 0
    ];

    const distOptions = {
      chart: {
        type: 'donut',
        height: 280,
        fontFamily: 'Inter, sans-serif',
        foreColor: textColor,
        toolbar: {
          show: true,
          tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false },
          export: {
            csv: { filename: 'distribucion_solicitudes_por_estado' },
            svg: { filename: 'distribucion_solicitudes_por_estado' },
            png: { filename: 'distribucion_solicitudes_por_estado' }
          }
        }
      },
      series: distData,
      labels: ['Ingresadas', 'Aceptadas', 'Rechazadas', 'Suspendidas', 'Canceladas', 'Encomendadas'],
      colors: ['#0284c7', '#2563eb', '#e11d48', '#7c3aed', '#64748b', '#d97706'],
      stroke: {
        show: true,
        width: 2,
        colors: [isDark ? '#0c0b14' : '#ffffff']
      },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            background: 'transparent',
            labels: {
              show: true,
              name: { show: true, fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600 },
              value: {
                show: true,
                fontSize: '16px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                color: isDark ? '#e2e0ed' : '#0c0b14',
                formatter: function(val) { return parseInt(val, 10).toLocaleString('es-CL'); }
              },
              total: {
                show: true,
                label: 'Total',
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                color: textColor,
                formatter: function(w) {
                  const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                  return sum.toLocaleString('es-CL');
                }
              }
            }
          }
        }
      },
      dataLabels: { enabled: false },
      legend: {
        position: 'right',
        fontSize: '11px',
        markers: { width: 8, height: 8, radius: 8 },
        itemMargin: { vertical: 4 }
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: {
          formatter: function(value) {
            const total = filtered.length;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${value.toLocaleString('es-CL')} (${percentage}%)`;
          }
        }
      }
    };

    this.instances.distribucion = new ApexCharts(containerDist, distOptions);
    this.instances.distribucion.render();

    // GRÁFICO B: EVOLUCIÓN MENSUAL INTERANUAL (Area/Line)
    const selectedYearStr = (filters.anio && filters.anio !== 'TODOS') ? filters.anio : new Date().getFullYear().toString();
    const selectedYear = parseInt(selectedYearStr, 10);
    const previousYear = selectedYear - 1;

    let dataForEvol = rawData;
    if (filters.vigencia === 'vigentes' || filters.soloVigentes === true) {
      if (sujetoCache && sujetoCache.size > 0) {
        dataForEvol = dataForEvol.filter(item => {
          const id = item.sujeto_pasivo_id;
          return id != null && (sujetoCache.has(Number(id)) || sujetoCache.has(String(id)));
        });
      }
    } else if (filters.vigencia === 'no_vigentes') {
      if (sujetoCache && sujetoCache.size > 0) {
        dataForEvol = dataForEvol.filter(item => {
          const id = item.sujeto_pasivo_id;
          return id == null || (!sujetoCache.has(Number(id)) && !sujetoCache.has(String(id)));
        });
      }
    }
    if (filters.nombre && filters.nombre.trim() !== '') {
      const val = filters.nombre.toLowerCase();
      dataForEvol = dataForEvol.filter(item => item.sujeto_pasivo && item.sujeto_pasivo.toLowerCase().includes(val));
    }
    if (filters.cargo && filters.cargo.trim() !== '') {
      const val = filters.cargo.toLowerCase();
      dataForEvol = dataForEvol.filter(item => item.cargo && cleanCargoFn(item.cargo).toLowerCase().includes(val));
    }

    const currentYearCounts = new Array(12).fill(0);
    const prevYearCounts = new Array(12).fill(0);

    dataForEvol.forEach(item => {
      if (item.fecha_ingreso) {
        const parts = item.fecha_ingreso.split(' ')[0].split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (m >= 0 && m < 12) {
            if (y === selectedYear) currentYearCounts[m]++;
            else if (y === previousYear) prevYearCounts[m]++;
          }
        }
      }
    });

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const evolOptions = {
      chart: {
        type: 'area',
        height: 280,
        fontFamily: 'Inter, sans-serif',
        foreColor: textColor,
        toolbar: {
          show: true,
          tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false },
          export: {
            csv: { filename: 'evolucion_mensual_interanual' },
            svg: { filename: 'evolucion_mensual_interanual' },
            png: { filename: 'evolucion_mensual_interanual' }
          }
        }
      },
      series: [
        { name: `Año ${selectedYear}`, data: currentYearCounts },
        { name: `Año ${previousYear}`, data: prevYearCounts }
      ],
      colors: [colorBrand, colorSlate],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 95, 100]
        }
      },
      stroke: { curve: 'smooth', width: [3, 2], dashArray: [0, 4] },
      xaxis: {
        categories: months,
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          formatter: function(val) { return Math.floor(val); }
        }
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } }
      },
      dataLabels: { enabled: false },
      tooltip: { theme: isDark ? 'dark' : 'light' },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px' }
    };

    this.instances.evolucion = new ApexCharts(containerEvol, evolOptions);
    this.instances.evolucion.render();

    // GRÁFICO C: CUMPLIMIENTO DE PLAZOS MENSUAL (Stacked Bar)
    const rdpCounts = new Array(12).fill(0);
    const rfpCounts = new Array(12).fill(0);
    const fdpCounts = new Array(12).fill(0);

    filtered.forEach(item => {
      if (item.fecha_ingreso) {
        const parts = item.fecha_ingreso.split(' ')[0].split('-');
        if (parts.length === 3) {
          const m = parseInt(parts[1], 10) - 1;
          if (m >= 0 && m < 12) {
            const estadoPlazo = item.estado_plazo || '';
            if (estadoPlazo.includes('RDP') || estadoPlazo === 'Respondida') {
              rdpCounts[m]++;
            } else if (estadoPlazo.includes('RFP')) {
              rfpCounts[m]++;
            } else if (estadoPlazo.includes('FDP')) {
              fdpCounts[m]++;
            }
          }
        }
      }
    });

    const cumplOptions = {
      chart: {
        type: 'bar',
        height: 280,
        stacked: true,
        fontFamily: 'Inter, sans-serif',
        foreColor: textColor,
        toolbar: {
          show: true,
          tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false },
          export: {
            csv: { filename: 'cumplimiento_plazos_mensual' },
            svg: { filename: 'cumplimiento_plazos_mensual' },
            png: { filename: 'cumplimiento_plazos_mensual' }
          }
        }
      },
      series: [
        { name: 'En Plazo (RDP)', data: rdpCounts },
        { name: 'Fuera de Plazo (RFP)', data: rfpCounts },
        { name: 'Vencidas sin Responder (FDP)', data: fdpCounts }
      ],
      colors: ['#059669', '#d97706', colorRose],
      plotOptions: {
        bar: {
          borderRadius: 4,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'last',
          columnWidth: '45%'
        }
      },
      xaxis: {
        categories: months,
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          formatter: function(val) { return Math.floor(val); }
        }
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } }
      },
      dataLabels: { enabled: false },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px' },
      tooltip: { theme: isDark ? 'dark' : 'light' }
    };

    this.instances.cumplimiento = new ApexCharts(containerCumpl, cumplOptions);
    this.instances.cumplimiento.render();

    // GRÁFICO D: TOP 5 SUJETOS PASIVOS (Horizontal Bar)
    const sujetoCounts = {};
    filtered.forEach(item => {
      const nombre = item.sujeto_pasivo;
      if (nombre && nombre.trim() !== '') {
        const norm = normNameFn(nombre);
        sujetoCounts[norm] = (sujetoCounts[norm] || 0) + 1;
      }
    });

    const sortedSujetos = Object.keys(sujetoCounts)
      .map(k => ({ nombre: k, count: sujetoCounts[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .reverse();

    const topLabels = sortedSujetos.map(s => s.nombre);
    const topData = sortedSujetos.map(s => s.count);

    const topOptions = {
      chart: {
        type: 'bar',
        height: 280,
        fontFamily: 'Inter, sans-serif',
        foreColor: textColor,
        toolbar: {
          show: true,
          tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false },
          export: {
            csv: { filename: 'top_5_autoridades' },
            svg: { filename: 'top_5_autoridades' },
            png: { filename: 'top_5_autoridades' }
          }
        }
      },
      series: [{
        name: 'Solicitudes Recibidas',
        data: topData.length > 0 ? topData : [0]
      }],
      colors: [colorBrand],
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '35%',
          borderRadius: 4,
          borderRadiusApplication: 'end'
        }
      },
      xaxis: {
        categories: topLabels.length > 0 ? topLabels : ['Sin registros'],
        labels: {
          formatter: function(val) { return Math.floor(val); }
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 4,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: false } }
      },
      dataLabels: { enabled: false },
      tooltip: { theme: isDark ? 'dark' : 'light' }
    };

    this.instances.topAutoridades = new ApexCharts(containerTop, topOptions);
    this.instances.topAutoridades.render();
  }
}

export const estadisticasCharts = new EstadisticasChartsManager();

if (typeof window !== 'undefined') {
  window.estadisticasCharts = estadisticasCharts;
  window.initEstadisticasCharts = () => estadisticasCharts.renderCharts();
}
