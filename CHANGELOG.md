# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo. El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [2.4.0] - 2026-07-10

### Añadido
- **Simulador de Perfiles (Impersonación)**: Herramienta administrativa para emular de forma segura la sesión de otros usuarios y auditar la visibilidad de datos y accesos. Incluye un banner superior de advertencia en color ámbar mientras la simulación permanezca activa.
- **Detalle de Sujeto Pasivo**: Soporte interactivo para visualizar una ficha de datos completa de cada Sujeto Pasivo (fechas de vigencia, cargo, decreto de respaldo jurídico y asistentes técnicos) desde la tabla administrativa.
- **Campo Asistente Técnico**: Integración del campo de asistente técnico proveniente de los registros del Excel para complementar la información del Sujeto Pasivo.

### Cambiado
- **Simplificación del Menú de Navegación**: Rediseño del menú superior centrado en 4 pestañas de operaciones básicas (Dashboard, Solicitudes, Audiencias y Agenda) y reubicación de herramientas avanzadas en un acceso unificado (engranaje).
- **Fusión de Módulos de Administración**: Las pantallas de *Reportes* y *Sujetos Pasivos* se integraron como pestañas del panel de Configuración. El rol de *Auditor* ahora tiene una vista restringida que solo le permite interactuar con estas dos herramientas.
- **Ajustes de Interfaz**: Mejoras en el soporte y contraste del tema claro (Light-First) en toda la interfaz y simplificación visual del panel de sincronización.

### Corregido
- **Importador de Datos**: Corrección de un problema en la lectura de la columna de género de los sujetos activos desde la planilla de origen.

---

## [2.3.1] - 2026-07-09

### Cambiado
- **Mejoras del Encabezado**: Rediseño estético de la barra superior de la aplicación.
- **Selector de Inspector**: Optimización del panel de administración del sistema para segmentar la inspección de datos de forma más intuitiva.
- **Optimización de Sincronización**: Ajustes en el guardado de datos y liberación de archivos locales para evitar bloqueos del sistema operativo en Windows.

### Corregido
- **Consistencia en Subida de Datos**: Corrección de desfases de red mediante verificación del estado de guardado local antes del envío a la nube.
- **Prevención de Concurrencia**: Bloqueo del botón de sincronización durante procesos activos para evitar duplicación de tareas.
- **Limpieza de Archivos Temporales**: Remoción de transacciones residuales para prevenir la degradación de rendimiento.
- **Reintento de Sincronización Manual**: Botón en la cápsula de estado para restablecer de forma directa la sincronización en la nube ante problemas de conexión temporales.
- **Información de Errores de Red**: Visualización del detalle de errores directamente en el panel flotante de conexión.
- **Bloqueo Inteligente de Búsqueda**: El buscador de sujetos pasivos se pre-completa y bloquea automáticamente para los usuarios que cuentan con este rol, facilitando el uso de filtros secundarios.

---

## [2.3.0] - 2026-07-08

### Añadido
- **Filtro de Historial de Eventos**: Clasificación rápida de eventos por nivel de severidad e integración de paginación en el panel administrativo.

### Cambiado
- **Rediseño Visual**: Mejoras en los bordes y legibilidad del módulo de reportes y ajustes de contraste en las tablas del sistema.

### Eliminado
- **Leyenda Redundante**: Retiro de descripciones de logs explicativas en favor de una barra de filtros de navegación directa.

### Corregido
- **Navegación en Logs**: Solución a problemas visuales al aplicar filtros o navegar entre páginas de logs del sistema.

---

## [2.2.0] - 2026-07-07

### Añadido
- **Historial de Cambios Detallado**: Registro visual de registros agregados, modificados y eliminados en cada sincronización de datos.
- **Escudo de Salud del Sistema**: Indicador visual que comprueba la autenticidad e integridad de la base de datos local en tiempo real.
- **Segmentación de Plazos**: Filtro rápido en el Centro de Alertas por tipo de plazos legales.

### Cambiado
- **Panel Informativo de Sincronización**: Despliegue automático de la bitácora comparativa al finalizar la sincronización en lugar de alertas genéricas.
- **Estandarización de Estilos**: Centralización de variables de diseño de calendario para asegurar compatibilidad total del tema oscuro.

### Corregido
- **Iconografía en Logs**: Solución al fallo de carga de iconos en la bitácora administrativa de logs del sistema.

---

## [2.1.0] - 2026-07-03

### Añadido
- **Módulo de Agenda**: Calendario integrado con vistas mensual, semanal y diaria, con codificación de colores para reuniones pendientes y pasadas.
- **Detalle de Audiencias**: Consulta interactiva de datos cruzados de audiencias para verificar el cumplimiento automático de plazos de ley.
- **Recordatorios del Día**: Notificaciones del Centro de Alertas para audiencias agendadas en la fecha actual.
- **Instalador de Windows**: Lanzamiento de instalador interactivo asistido con accesos directos e iconografía personalizada.

### Eliminado
- **Contraseñas Locales**: Retiro definitivo del inicio de sesión con claves tradicionales para centralizar la autenticación a través del servicio Single Sign-On (SSO) institucional.

### Corregido
- **Métricas del Dashboard**: Solución a problemas de visualización de decimales y porcentajes pequeños en los gráficos.

---

## [2.0.0] - 2026-06-26

### Añadido
- **Migración a Escritorio**: Transición de la arquitectura web local a una aplicación nativa instalable en escritorio (Electron).
- **Seguridad de Comunicación**: Conectividad directa entre cliente y servidor sin apertura de puertos de red vulnerables.
- **División de Almacenamiento**: Separación de las bases de datos en archivos independientes para mejorar el rendimiento del lobby, la seguridad de los usuarios y la portabilidad de configuraciones.
- **Bitácora Unificada**: Módulo administrativo de registro de actividad.
- **Reportes Optimizados**: Plantilla especializada para la impresión física o digital de informes.
- **Asignación de Administrador Inicial**: Registro automatizado del primer usuario del sistema con rol de administrador en bases de datos vacías.

### Cambiado
- **Seguridad en la Nube**: Flujo directo de sincronización de usuarios hacia SharePoint para evitar pérdida de datos.

### Corregido
- **Bloqueos de Archivos**: Liberación segura de conexiones concurrentes en sistemas operativos Windows.
- **Inicio de Sesión**: Solución a bucles de redirección de inicio de sesión para departamentos municipales específicos.
- **Rutas de Datos**: Reubicación de archivos de base de datos fuera de directorios del sistema protegidos por Windows en producción.

### Eliminado
- **Historial Físico de Reportes**: Remoción de archivos temporales de reportes antiguos en disco en favor del procesamiento en memoria del cliente.
- **Servicio Web Local**: Retiro de servidor local innecesario para utilizar mensajería directa en la aplicación de escritorio.

---

## [1.1.0] - 2026-06-26

### Añadido
- **Sincronización Bidireccional**: Motor de sincronización de datos con resolución de conflictos para soporte offline y online.
- **Conexión Directa con SharePoint**: Autenticación integrada a través de cuentas de correo institucionales.
- **Optimización de Cargas**: Ingesta masiva optimizada para soportar planillas de datos de origen muy extensas.
- **Modo Desconectado**: Habilitación del sistema para realizar búsquedas locales e interacciones básicas sin acceso a Internet.

---

## [1.0.0] - 2026-06-22

### Añadido
- **Lanzamiento Inicial**: Publicación de la primera versión de la plataforma de control local para la gestión de audiencias de la Ley de Lobby.
- **Almacenamiento y Carga**: Estructuras de datos iniciales y scripts para importación y validación de datos.

### Corregido
- **Diseño del Dashboard**: Ajuste de tablas para evitar desalineación visual ante contenidos extensos.
- **Normalización de Fechas**: Conversión automática a formatos estables del portal gubernamental.
- **Control de Duplicados**: Prevención de registros idénticos durante la carga masiva.
- **Importador de Planillas**: Omisión automática de celdas nulas y registros vacíos.
