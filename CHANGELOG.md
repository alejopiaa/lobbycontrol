# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo. El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

## [3.0.0] - 2026-08-31

### Added
- **Nueva Arquitectura Modular**: Reorganización integral de la aplicación en módulos y vistas independientes para una navegación más rápida, fluida y con mayor estabilidad entre pantallas.

### Fixed
- **Secuencia del Correlativo de Reportes**: Solución al fallo que reiniciaba el contador de folios en 1 al exportar múltiples reportes de manera continua.
- **Bloqueo en Generación Masiva de PDF**: Solución al error en la cola de exportación que congelaba la generación de reportes ejecutivos en el primer funcionario.
- **Selección de Estados en Reportes**: Solución al fallo en las etiquetas y casillas de verificación que impedía filtrar solicitudes por estado.
- **Botones de Exportación**: Solución al error en los eventos de clic que bloqueaba la descarga de reportes en formato PDF y Excel.
- **Detección de Pendientes de Publicación**: Solución al fallo de sincronización que omitía el catálogo de publicadas al calcular los pendientes en reportes.

## [2.10.0] - 2026-08-27

### Added
- **Módulo de Asistencia Técnica**: Ventana flotante independiente para registrar y gestionar tickets de atención y orientación, con bitácora histórica, directorio y motor de unificación de contactos duplicados, control de acceso por roles y exportación de fichas a PDF y EML.

### Fixed
- **Normalización del Sistema de Estilos y Contraste**: Estandarización completa de la interfaz con tokens semánticos nativos en Tailwind CSS v4, eliminación de dependencias externas (`Preline UI`) y corrección de contraste en tablas, menús y gráficos en modo claro y oscuro.
- **Modernización de Diálogos de Confirmación**: Sustitución de diálogos nativos del navegador (`confirm`) por modales asíncronos (`openConfirmModal`) integrados al sistema de diseño.

## [2.9.1] - 2026-08-26

### Fixed
- **Visualización de Logotipo en Reportes PDF**: Solución a la carga asíncrona y desborde visual del logotipo institucional al exportar documentos PDF.
- **Nombre y Metadatos al Exportar Reportes**: Asignación correcta de títulos y nombres de archivo en el cuadro de guardado y visores de PDF.
- **Importación de Fechas en Formato Texto**: Compatibilidad automática con fechas ingresadas en diversos formatos de texto al importar planillas Excel.
- **Estabilidad ante Registros Incompletos**: Prevención de excepciones en la interfaz al consultar registros sin cargo o sin cálculo de plazo definido.

## [2.9.0] - 2026-08-21

### Added
- **Sincronización Dinámica de Límites de Fechas**: Validación bidireccional en tiempo real (`minDate` / `maxDate`) entre selectores de fechas para impedir rangos invertidos.
- **Filtros Temporales en Sujetos Pasivos**: Filtrado por rango de fechas integrado con Air Datepicker v3.
- **Separación de Fechas en Tablas**: Columnas independientes para fecha de inicio y fecha de término en el listado de Sujetos Pasivos.
- **Ocultamiento Dinámico de Fines de Semana en Agenda**: Colapso automático de sábados y domingos sin eventos, expandiéndose reactivamente si existen registros agendados.

### Changed
- **Rediseño Integral de la Agenda**: Interfaz actualizada en Tailwind CSS v4, modal pop-over para eventos diarios, ordenamiento cronológico y navegación fluida.
- **Homologación de Filtros en Sujetos Pasivos**: Integración de panel de filtros responsive con búsqueda predictiva de texto.
- **Ordenamiento Inteligente de Sujetos Pasivos**: Priorización de registros con vigencia activa seguidos de cargos con término definido.
- **Visualización de Columnas y Nombres**: Ampliación de columnas y saneamiento de descripciones redundantes de cargos.

### Removed
- **Limpieza de Código Residual**: Eliminación de manejadores de eventos obsoletos por teclado y helpers globales huérfanos.

### Fixed
- **Manejo Defensivo en Cálculo de Plazos**: Prevención de excepciones cuando un registro importado carece de fecha de ingreso o plazo asociado.
- **Estado de Vigencia en Modal de Detalle**: Corrección del cálculo de vigencia para cargos con término continuo o indefinido.

## [2.8.0] - 2026-08-18

### Added
- **Exportación a Excel**: Generación y descarga directa de datos tabulares consolidados en formato `.xlsx`.
- **Reporte Ejecutivo en PDF**: Generación de informes ejecutivos con métricas agrupadas por estado, jerarquía y totales generales.
- **Filtro Global de Vigencia**: Selector tri-estado (*Todos*, *Vigentes*, *No Vigentes*) sincronizado en tiempo real con tarjetas y gráficos.
- **Detalle de Sincronización**: Modal con métricas de cambios y comparador de campos modificados tras la importación.
- **Fichas de Detalle Interactivas**: Modales para consultar la información completa de solicitudes y audiencias.
- **Exportación de Gráficos**: Descarga de visualizaciones del Dashboard en formatos SVG, PNG y CSV.

### Changed
- **Optimización de Vistas de Agenda**: Reestructuración de vistas mensual, semanal y diaria para navegación fluida.
- **Transiciones de Interfaz**: Animaciones suaves en cambios de vista, apertura de modales y notificaciones.

### Fixed
- **Búsqueda en Reportes**: Solución al filtrado por texto parcial en el buscador de registros.
- **Recuperación Automática de Base de Datos**: Validación y reparación automática del archivo SQLite local ante cierres inesperados.

## [2.7.0] - 2026-08-12

### Changed
- **Migración a ApexCharts**: Reemplazo de biblioteca gráfica por ApexCharts v3 local, mejorando interactividad, tooltips y soporte de modo oscuro.
- **Actualización de Selector de Fechas**: Integración local de Air Datepicker v3 para solucionar incompatibilidades en navegación temporal.
- **Sincronización de Filtros en Dashboard**: Vinculación de filtros superiores con recálculo dinámico de métricas y series gráficas.
- **Optimización de Renderizado en Tarjetas**: Animación de conteo numérico restringida a cambios mayores de datos para evitar parpadeos.

### Removed
- **Remoción de Dependencias en Desuso**: Eliminación de la biblioteca gráfica anterior (Chart.js).

### Fixed
- **Independencia de Filtros en Reportes**: Corrección del selector de fechas para operar de forma desacoplada de filtros secundarios.

## [2.6.0] - 2026-08-11

### Added
- **Cancelación de Exportación Masiva**: Opción de cancelar procesos de generación masiva de PDFs en ejecución.

### Changed
- **Optimización del Importador**: Reducción en los tiempos de procesamiento y lectura de planillas de respaldo.

### Removed
- **Métrica de Archivo Local**: Supresión del chequeo de planilla física en el panel de salud tras la migración a almacenamiento estructurado en base de datos local.

### Fixed
- **Persistencia de Auditorías**: Sincronización automática de cambios locales tras registrar, editar o eliminar registros de control.
- **Filtros Dinámicos en Tablas**: Vinculación de checkboxes de estado con actualización reactiva de filas en pantalla.
- **Autocompletado de Búsquedas**: Corrección del buscador administrativo al filtrar registros.
- **Encabezados Duplicados**: Corrección del repintado de cabeceras de tablas durante búsquedas consecutivas.
- **Z-Index en Agenda**: Corrección en la superposición de menús desplegables sobre el calendario.
- **Visualización de Hora**: Inclusión del componente horario (HH:MM) en fichas de detalle de audiencias.

## [2.5.0] - 2026-07-10

### Added
- **Simulador de Perfiles (Impersonación)**: Herramienta administrativa para auditar vistas y permisos emulando roles de usuario, con banner de estado activo.
- **Ficha de Sujeto Pasivo**: Visor de datos completos con vigencia, cargos asociados y asistentes técnicos.

### Changed
- **Simplificación del Menú de Navegación**: Menú superior optimizado en 4 vistas operativas y reubicación de herramientas avanzadas en panel de configuración.
- **Consolidación de Administración**: Integración de vistas administrativas en pestañas con control de acceso por roles.
- **Soporte de Temas**: Mejoras de contraste en modo claro (*Light-First*) y refinamiento del panel de sincronización.

### Fixed
- **Normalización de Columnas en Ingesta**: Corrección en la lectura de atributos de solicitantes desde archivos de origen.

## [2.4.0] - 2026-07-09

### Added
- **Reintento de Sincronización Manual**: Control directo para restablecer sincronización remota ante pérdidas de conexión.
- **Detalle de Errores de Conectividad**: Despliegue de diagnóstico de red en la cápsula de estado.
- **Pre-llenado de Filtros por Rol**: Bloqueo predictivo de filtros según el perfil del usuario autenticado.

### Changed
- **Barra Superior**: Rediseño visual del header y cápsula de sincronización.
- **Liberación de Conexiones en Windows**: Manejo seguro de descriptores de archivo para evitar bloqueos del sistema operativo.

### Removed
- **Limpieza de Archivos Temporales**: Purgado de transacciones temporales para prevenir sobreconsumo de almacenamiento.

### Fixed
- **Consistencia en Envío de Datos**: Verificación de escritura en disco local previa a la transferencia remota.
- **Bloqueo por Concurrencia**: Deshabilitación de botones durante procesos de red activos para evitar peticiones duplicadas.

## [2.3.0] - 2026-07-08

### Added
- **Historial de Eventos Paginado**: Clasificación de logs por severidad y navegación paginada.

### Changed
- **Contraste en Tablas**: Mejoras en la definición de bordes y legibilidad de celdas.

### Removed
- **Leyendas Redundantes**: Reemplazo de bloques de texto explicativos por controles directos de filtrado.

### Fixed
- **Paginación en Logs**: Solución a desajustes visuales al cambiar de página en la bitácora del sistema.

## [2.2.0] - 2026-07-07

### Added
- **Historial de Cambios Comparativo**: Registro visual de filas agregadas, modificadas y eliminadas por sincronización.
- **Monitor de Integridad de Datos**: Indicador en tiempo real del estado de la base de datos local y fuentes de datos.
- **Filtros por Tipo de Plazo**: Clasificación de plazos legales en el Centro de Alertas.

### Changed
- **Notificación de Sincronización**: Despliegue de resumen estructurado al completar la importación.
- **Estandarización de Variables**: Centralización de estilos de calendario para soporte multiplataforma.

### Fixed
- **Carga de Iconos en Logs**: Corrección en la inicialización de iconos en el visor de bitácora.

## [2.1.0] - 2026-07-03

### Added
- **Módulo de Agenda**: Calendario interactivo con vistas mensual, semanal y diaria.
- **Control de Plazos en Audiencias**: Cálculo dinámico del cumplimiento de plazos legales.
- **Recordatorios del Día**: Notificaciones para audiencias programadas en la fecha en curso.
- **Instalador de Escritorio**: Empaquetado instalable para Windows con accesos directos e iconografía.

### Removed
- **Autenticación Clásica**: Retiro del formulario de credenciales locales en favor de Single Sign-On (SSO) institucional.

### Fixed
- **Precisión Numérica en Dashboard**: Corrección en el redondeo de porcentajes y métricas decimales.

## [2.0.0] - 2026-06-26

### Added
- **Migración a Aplicación de Escritorio**: Transición de la arquitectura web hacia aplicación nativa con Electron.
- **Canal de Comunicación Seguro**: Comunicación IPC aislada sin exposición de puertos HTTP locales.
- **Aislamiento de Bases de Datos**: Separación de almacenamiento en esquemas locales dedicados.
- **Bitácora de Sistema**: Registro local de eventos y auditoría de acciones.
- **Plantilla de Impresión de Reportes**: Formato optimizado para impresión en hoja A4 y exportación PDF.

### Changed
- **Sincronización en Memoria**: Procesamiento de reportes directamente en memoria del cliente sin escritura en disco temporal.

### Removed
- **Servidor Web Local**: Eliminación del servidor HTTP embebido en favor de mensajería IPC directa.

### Fixed
- **Manejo de Archivos en Windows**: Liberación de conexiones SQLite para evitar bloqueos por procesos concurrentes.
- **Inicio de Sesión SSO**: Solución a bucles de redirección durante el inicio de sesión.
- **Rutas de Almacenamiento**: Reubicación de archivos de base de datos fuera de rutas protegidas del sistema operativo.

## [1.1.0] - 2026-06-24

### Added
- **Motor de Sincronización Bidireccional**: Resolución de conflictos y soporte de operación offline/online.
- **Conectividad con Almacenamiento Remoto**: Autenticación integrada para sincronización de datos.
- **Optimización de Carga Masiva**: Soporte para importación de grandes volúmenes de registros.

## [1.0.0] - 2026-06-22

### Added
- **Lanzamiento Inicial**: Plataforma para la gestión, seguimiento y control de audiencias y solicitudes bajo la Ley de Lobby.
- **Estructura de Datos y Validaciones**: Modelos de almacenamiento, importador de datos y normalización de registros.
- **Dashboard de Métricas**: Indicadores de cumplimiento y visualización de estados.

[Unreleased]: https://github.com/alejopiaa/lobbycontrol/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.10.0...v3.0.0
[2.10.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.9.1...v2.10.0
[2.9.1]: https://github.com/alejopiaa/lobbycontrol/compare/v2.9.0...v2.9.1
[2.9.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/alejopiaa/lobbycontrol/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/alejopiaa/lobbycontrol/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/alejopiaa/lobbycontrol/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/alejopiaa/lobbycontrol/releases/tag/v1.0.0
