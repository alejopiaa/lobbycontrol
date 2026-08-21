# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo. El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [2.9.0] - 2026-08-21

### Added
- **Sincronización Dinámica de Límites de Fechas**: Control bidireccional en tiempo real (`minDate` / `maxDate`) entre selectores de *Fecha Desde/Inicio* y *Fecha Hasta/Término* en Dashboard, Reportes y Sujetos Pasivos para impedir rangos invertidos.
- **Filtros Temporales en Sujetos Pasivos**: Filtrado condicionado por rango de fechas (Fecha Inicio / Fecha Término) con integración al componente de calendario Air Datepicker v3.
- **Separación de Fechas en Sujetos Pasivos**: Visualización independiente de las columnas *Fecha Inicio* y *Fecha Término* en el listado de Sujetos Pasivos.
- **Ocultamiento Dinámico de Fines de Semana en Agenda**: Las vistas de Mes y Semana colapsan automáticamente sábados y domingos si no contienen eventos, expandiéndose reactivamente a 7 columnas si existe alguna audiencia agendada.

### Changed
- **Rediseño Integral de la Agenda**: Interfaz construida con Tailwind CSS v4, modal pop-over de eventos del día, ordenamiento cronológico estricto y navegación fluida sin selectores nativos del sistema.
- **Homologación de Filtros en Sujetos Pasivos**: Integración de la tarjeta oficial de filtros del sistema de diseño en grilla de 4 columnas responsive con búsqueda general de texto editable y fluido.
- **Ordenamiento Inteligente de Sujetos Pasivos**: Priorización de registros con cargos vigentes/indefinidos primero (ordenados por fecha de incorporación) seguidos de los cargos con fecha de término definida.
- **Visualización de Cargo y Nombre**: Ampliación del ancho de columna para nombres y limpieza de sufijos duplicados en la descripción de cargos (`getCargoClean`).

### Removed
- **Limpieza de Código Residual**: Eliminación de más de 150 líneas de código muerto de máscaras por teclado obsoletas (`handleDateDisplayInput`, `handleDateDisplayKeydown`, etc.) y supresión de helpers globales huérfanos.

### Fixed
- **Tolerancia a Solicitudes sin Plazo Legal**: Solución al error `calculateDeadline is not defined` que provocaba la pantalla *"Error en Servidor Local"* cuando una solicitud importada no contenía fecha límite o fecha de ingreso.
- **Estado de Vigencia en Modal de Sujeto Pasivo**: Corrección en el cálculo de vigencia para cargos con término indefinido o continuo en la ficha de detalle.

## [2.8.0] - 2026-08-18

### Added
- **Exportación a Excel**: Generación y descarga directa de reportes consolidados en formato planilla Excel (`.xlsx`).
- **Reporte Ejecutivo en PDF**: Generación de informes ejecutivos con métricas consolidadas por estado, jerarquía institucional y fila de totales generales.
- **Filtro de Estado de Sujeto Pasivo**: Selector tri-estado (*Todos*, *Vigentes*, *No Vigentes*) disponible en todas las vistas, sincronizado en tiempo real con las métricas y gráficos.
- **Resumen y Detalle de Sincronización**: Modal informativo tras la importación de datos con métricas rápidas de cambios y visor detallado con buscador y comparación de campos modificados.
- **Ficha de Detalle de Audiencias y Solicitudes**: Modales interactivos para consultar el registro completo de solicitudes y audiencias sin salir de la aplicación.
- **Exportación de Gráficos**: Herramienta en los gráficos del Dashboard para exportar las visualizaciones en formatos de imagen y datos (SVG, PNG, CSV).

### Changed
- **Rediseño de la Agenda**: Reestructuración de las vistas de mes, semana y día para optimizar la visualización de reuniones en una sola pantalla con navegación fluida.
- **Animaciones y Transiciones de Interfaz**: Transiciones suaves en la navegación entre vistas, apertura de modales y notificaciones del sistema.

### Fixed
- **Búsqueda en Reportes**: Solución al fallo que impedía filtrar por texto parcial en el buscador de sujetos pasivos.
- **Recuperación Automática de Datos**: Reparación y validación automática de la base de datos local ante archivos dañados o corruptos al iniciar la aplicación.

## [2.7.0] - 2026-08-12

### Changed
- **Migración a ApexCharts**: Reemplazo de la biblioteca Chart.js por ApexCharts (v3) de forma local, mejorando la interactividad, tooltips y la adaptabilidad de los gráficos en el Dashboard al cambiar entre modo claro y oscuro.
- **Actualización de Selector de Fechas**: Integración local de Air Datepicker v3 en los campos de fecha para solucionar incompatibilidades en la navegación de meses y años.
- **Filtro Global de Vigencia**: Reubicación y unificación del checkbox de "Solo Sujeto Pasivos vigentes" al panel de filtros superior del Dashboard, aplicando el filtrado sobre todas las tarjetas de métricas y los gráficos en sincronía.
- **Animaciones en Tarjetas**: Configuración para que las animaciones de conteo numérico de las tarjetas del Dashboard se ejecuten solo en cambios mayores de estado (como alternar vigencia de sujetos pasivos) para evitar interrupciones visuales durante la edición de textos o fechas.

### Removed
- **Remoción de Dependencias en Desuso**: Eliminación del archivo de biblioteca local obsoleto correspondiente a Chart.js.

### Fixed
- **Habilitación de Selector de Fechas en Reportes**: Solución al bloqueo que impedía usar el calendario de Reportes de forma independiente sin configurar previamente filtros secundarios.

## [2.6.0] - 2026-08-11

### Added
- **Cancelación en exportación masiva**: Botón de cancelación en el modal de exportación masiva de PDFs para detener el proceso de generación en cualquier momento.

### Changed
- **Optimización del Importador de Excel**: Reducción drástica en el tiempo de carga de planillas Excel secundarias de respaldo (de más de 5 minutos a menos de 2 segundos).

### Removed
- **Métrica de Archivo Excel**: Remoción de la verificación del archivo físico Excel local en el panel de salud del sistema, ya que la base de datos local definitiva reside en SQLite y se sincroniza directamente con SharePoint, reduciendo la dependencia del archivo de planilla original.

### Fixed
- **Persistencia de auditorías**: Sincronización automática de cambios a SharePoint tras registrar, editar o eliminar auditorías semanales, evitando pérdidas de cambios locales al reiniciar la aplicación.
- **Filtro dinámico de vigencia en reportes**: Vinculación del checkbox "Solo vigentes" de reportes con la tabla en pantalla para filtrar dinámicamente los registros mostrados.
- **Búsqueda de sujetos en reportes**: Solución al fallo que impedía ingresar o autocompletar nombres de sujetos pasivos para filtrar reportes desde el panel de administración.
- **Duplicado de cabeceras**: Solución al error visual que provocaba que los encabezados del panel de administración se duplicaran repetidamente al realizar búsquedas.
- **Superposición en controles de agenda**: Ajuste visual para evitar que el menú desplegable del buscador de agenda se dibuje detrás del calendario.
- **Hora en detalle de audiencias**: Incorporación del componente de hora (HH:MM) al lado de la fecha agendada en la ficha detallada de audiencias.

## [2.5.0] - 2026-07-10

### Added
- **Simulador de Perfiles (Impersonación)**: Herramienta administrativa para emular de forma segura la sesión de otros usuarios y auditar la visibilidad de datos y accesos. Incluye un banner superior de advertencia en color ámbar mientras la simulación permanezca activa.
- **Detalle de Sujeto Pasivo**: Soporte interactivo para visualizar una ficha de datos completa de cada Sujeto Pasivo (fechas de vigencia, cargo, decreto de respaldo jurídico y asistentes técnicos) desde la tabla administrativa.
- **Campo Asistente Técnico**: Integración del campo de asistente técnico proveniente de los registros del Excel para complementar la información del Sujeto Pasivo.

### Changed
- **Simplificación del Menú de Navegación**: Rediseño del menú superior centrado en 4 pestañas de operaciones básicas (Dashboard, Solicitudes, Audiencias y Agenda) y reubicación de herramientas avanzadas en un acceso unificado (engranaje).
- **Fusión de Módulos de Administración**: Las pantallas de *Reportes* y *Sujetos Pasivos* se integraron como pestañas del panel de Configuración. El rol de *Auditor* ahora tiene una vista restringida que solo le permite interactuar con estas dos herramientas.
- **Ajustes de Interfaz**: Mejoras en el soporte y contraste del tema claro (Light-First) en toda la interfaz y simplificación visual del panel de sincronización.

### Fixed
- **Importador de Datos**: Corrección de un problema en la lectura de la columna de género de los sujetos activos desde la planilla de origen.

## [2.4.0] - 2026-07-09

### Added
- **Reintento de Sincronización Manual**: Botón en la cápsula de estado para restablecer de forma directa la sincronización en la nube ante problemas de conexión temporales.
- **Información de Errores de Red**: Visualización del detalle de errores directamente en el panel flotante de conexión.
- **Bloqueo Inteligente de Búsqueda**: El buscador de sujetos pasivos se pre-completa y bloquea automáticamente para los usuarios con rol de Sujeto Pasivo, facilitando el uso de filtros secundarios.

### Changed
- **Mejoras del Encabezado**: Rediseño estético de la barra superior de la aplicación.
- **Selector de Inspector**: Optimización del panel de administración del sistema para segmentar la inspección de datos de forma más intuitiva.
- **Optimización de Sincronización**: Ajustes en el guardado de datos y liberación de archivos locales para evitar bloqueos del sistema operativo en Windows.

### Removed
- **Limpieza de Archivos Temporales**: Remoción de transacciones residuales para prevenir la degradación de rendimiento.

### Fixed
- **Consistencia en Subida de Datos**: Corrección de desfases de red mediante verificación del estado de guardado local antes del envío a la nube.
- **Prevención de Concurrencia**: Bloqueo del botón de sincronización durante procesos activos para evitar duplicación de tareas.

## [2.3.0] - 2026-07-08

### Added
- **Filtro de Historial de Eventos**: Clasificación rápida de eventos por nivel de severidad e integración de paginación en el panel administrativo.

### Changed
- **Rediseño Visual**: Mejoras en los bordes y legibilidad del módulo de reportes y ajustes de contraste en las tablas del sistema.

### Removed
- **Leyenda Redundante**: Retiro de descripciones de logs explicativas en favor de una barra de filtros de navegación directa.

### Fixed
- **Navegación en Logs**: Solución a problemas visuales al aplicar filtros o navegar entre páginas de logs del sistema.

## [2.2.0] - 2026-07-07

### Added
- **Historial de Cambios Detallado**: Registro visual de registros agregados, modificados y eliminados en cada sincronización de datos.
- **Escudo de Salud del Sistema**: Indicador visual que comprueba la autenticidad e integridad de la base de datos local y el estado del archivo físico Excel origen en tiempo real.
- **Segmentación de Plazos**: Filtro rápido en el Centro de Alertas por tipo de plazos legales.

### Changed
- **Panel Informativo de Sincronización**: Despliegue automático de la bitácora comparativa al finalizar la sincronización en lugar de alertas genéricas.
- **Estandarización de Estilos**: Centralización de variables de diseño de calendario para asegurar compatibilidad total del tema oscuro.

### Fixed
- **Iconografía en Logs**: Solución al fallo de carga de iconos en la bitácora administrativa de logs del sistema.

## [2.1.0] - 2026-07-03

### Added
- **Módulo de Agenda**: Calendario integrado con vistas mensual, semanal y diaria, con codificación de colores para reuniones pendientes y pasadas.
- **Detalle de Audiencias**: Consulta interactiva de datos cruzados de audiencias para verificar el cumplimiento automático de plazos de ley.
- **Recordatorios del Día**: Notificaciones del Centro de Alertas para audiencias agendadas en la fecha actual.
- **Instalador de Windows**: Lanzamiento de instalador interactivo asistido con accesos directos e iconografía personalizada.

### Removed
- **Contraseñas Locales**: Retiro definitivo del inicio de sesión con claves tradicionales para centralizar la autenticación a través del servicio Single Sign-On (SSO) institucional.

### Fixed
- **Métricas del Dashboard**: Solución a problemas de visualización de decimales y porcentajes pequeños en los gráficos.

## [2.0.0] - 2026-06-26

### Added
- **Migración a Escritorio**: Transición de la arquitectura web local a una aplicación nativa instalable en escritorio (Electron).
- **Seguridad de Comunicación**: Conectividad directa entre cliente y servidor sin apertura de puertos de red vulnerables.
- **División de Almacenamiento**: Separación de las bases de datos en archivos independientes para mejorar el rendimiento del lobby, la seguridad de los usuarios y la portabilidad de configuraciones.
- **Bitácora Unificada**: Módulo administrativo de registro de actividad.
- **Reportes Optimizados**: Plantilla especializada para la impresión física o digital de informes.
- **Asignación de Administrador Inicial**: Registro automatizado del primer usuario del sistema con rol de administrador en bases de datos vacías.

### Changed
- **Seguridad en la Nube**: Flujo directo de sincronización de usuarios hacia SharePoint para evitar pérdida de datos.
- **Optimización del Procesamiento de Reportes**: Eliminación de la generación de archivos temporales en disco (utilizada en la v1.0.0) en favor del procesamiento directo en memoria del cliente Electron.

### Removed
- **Servicio Web Local**: Retiro de servidor local innecesario para utilizar mensajería directa en la aplicación de escritorio.

### Fixed
- **Bloqueos de Archivos**: Liberación segura de conexiones concurrentes en sistemas operativos Windows.
- **Inicio de Sesión**: Solución a bucles de redirección de inicio de sesión para departamentos municipales específicos.
- **Rutas de Datos**: Reubicación de archivos de base de datos fuera de directorios del sistema protegidos por Windows en producción.

## [1.1.0] - 2026-06-24

### Added
- **Sincronización Bidireccional**: Motor de sincronización de datos con resolución de conflictos para soporte offline y online.
- **Conexión Directa con SharePoint**: Autenticación integrada a través de cuentas de correo institucionales.
- **Optimización de Cargas**: Ingesta masiva optimizada para soportar planillas de datos de origen muy extensas.
- **Modo Desconectado**: Habilitación del sistema para realizar búsquedas locales e interacciones básicas sin acceso a Internet.

## [1.0.0] - 2026-06-22

### Added
- **Lanzamiento Inicial**: Publicación de la primera versión de la plataforma de control local para la gestión de audiencias de la Ley de Lobby.
- **Almacenamiento y Carga**: Estructuras de datos iniciales y scripts para importación y validación de datos.

### Fixed
- **Diseño del Dashboard**: Ajuste de tablas para evitar desalineación visual ante contenidos extensos.
- **Normalización de Fechas**: Conversión automática a formatos estables del portal gubernamental.
- **Control de Duplicados**: Prevención de registros idénticos durante la carga masiva.
- **Importador de Planillas**: Omisión automática de celdas nulas y registros vacíos.
