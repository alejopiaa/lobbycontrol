# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo. El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [2.7.0] - 2026-07-10

### Añadido
- **Simulador de Perfiles (Impersonación)**: Nueva herramienta para administradores que permite simular de manera 100% real la sesión de otro usuario (por ejemplo, de un Sujeto Pasivo). Cuenta con aislamiento seguro de sesión concurrente y validación rigurosa de rol en el backend (lógica de `effectiveUser`).
- **Banner Flotante de Simulación**: Barra superior de advertencia en color amarillo ámbar que indica cuándo está activo el simulador, mostrando el nombre y rol del perfil simulado con un botón directo para finalizar la simulación de inmediato.
- **Modal de Detalle de Sujeto Pasivo**: Se añadió soporte en la tabla del módulo de Sujetos Pasivos para abrir un modal informativo completo al interactuar con las filas, mostrando RUT, cargo, tipo, zona, vigencia de gestión, decretos de respaldo jurídico y un enlace directo a su perfil público del Portal Ley de Lobby.
- **Campo `asistente_tecnico` en SPH**: Integración de la columna `asistente_tecnico` en la base de datos y su visualización en el modal de detalles de Sujetos Pasivos.
- **Migración de Esquema Dinámica**: Comprobación automática del esquema en el arranque de la app y en el script de importación para inyectar mediante `ALTER TABLE` la columna `asistente_tecnico` si la base de datos local es sobrescrita por sincronizaciones de SharePoint.

### Cambiado
- **Rediseño y Simplificación del Menú de Navegación**: Se redujo el menú central a 4 opciones operativas principales: Dashboard, Solicitudes, Audiencias y Agenda.
- **Agenda Promovida**: Se removió el botón flotante circular de agenda y se promovió a pestaña principal en el menú central de operaciones.
- **Engranaje de Configuración**: Se integró un botón de engranaje en la esquina superior derecha del encabezado (visible solo para Administradores y Auditores) para acceder de forma unificada a las herramientas y vistas de control.
- **Fusión de Módulos**: Los módulos de *Reportes* y *Sujetos Pasivos* ahora forman parte de la vista de configuración como pestañas integradas. El rol de *Auditor* cuenta con una vista simplificada que solo le permite consultar estas dos pestañas.
- **Delegación de Eventos en Tabla**: Se implementó el patrón de delegación de eventos adjunto al elemento contenedor `#table-sujetos` para la apertura eficiente del modal de detalles de sujetos pasivos, optimizando el uso de memoria RAM y el recolector de basura (garbage collector).
- **Sobreescrituras CSS sin `!important`**: Se adaptaron las sobreescrituras de colores oscuros de Tailwind en `style.css` usando selectores basados en especificidad (`html .clase`) en lugar de directivas `!important`, para un mejor soporte de Light-First.
- **Simplificación de Sincronización**: Se removieron las referencias locales de archivo Excel de origen del panel visual de la pestaña de Sincronización.

### Corregido
- **Alineación del Avatar de Usuario**: Se corrigió el desalineamiento del texto del avatar en la cabecera restaurando las clases de flexbox.
- **Menú de Agenda**: Se resolvió un bug en `app.js` que comprimía visualmente el botón de Agenda en la cabecera.
- **Typo en Importación de PH**: Se corrigió el error de mapeo `"generoSuejtoActivo"` a `"generoSujetoActivo"` en el script de importación.

---

## [2.6.2] - 2026-07-09

### Añadido
- **Reintento de Sincronización Manual**: Se incorporó un botón de "Reintentar conexión" en la tarjeta de hover de la cápsula de estado flotante que aparece exclusivamente cuando hay fallos de sincronización con SharePoint, permitiendo reintentar la conexión de forma inmediata y manual.
- **Detalle de Error en Tarjeta**: En caso de fallas de red o autenticación, la tarjeta de hover del estado flotante ahora reemplaza el título de última actualización por "Detalle del Error" en color rojo y despliega el mensaje descriptivo del fallo.
- **Restricción de Búsqueda para Sujetos Pasivos**: En los módulos de Dashboard, Solicitudes y Audiencias, si el usuario tiene el rol de *Sujeto Pasivo*, su campo de búsqueda por nombre se pre-completa y se bloquea de forma interactiva (se deshabilita), liberando automáticamente el filtro de Cargo para facilitar su interacción.

### Cambiado
- **Estructura de Altura Estable en Modal de Agenda**: Se rediseñó el modal de detalles de la agenda de audiencias para tener una altura estable en pantallas grandes, manteniendo cabecera y pie de página fijos en el viewport y habilitando un scroll independiente de alto máximo limitado para el texto de la *Especificación de la materia*.
- **Navegación del Hover de Conexión**: Se resolvió el bug del "espacio vacío" en la cápsula de estado flotante al remover el margen inferior e incorporar un padding inferior transparente en el contenedor, permitiendo al usuario desplazar el puntero hacia la tarjeta de hover sin que esta desaparezca.

---

## [2.6.1] - 2026-07-09

### Cambiado
- **Rediseño del Encabezado**: Se mejoró el encabezado principal para integrar de forma más limpia la identidad y logotipo de la aplicación.
- **Selector del Inspector de Base de Datos**: Se rediseñó el inspector de administración dividiéndolo en dos selectores independientes (uno para la base de datos y otro para sus tablas), facilitando la navegación.
- **Flujo de Reemplazo de Base de Datos**: Se optimizó la secuencia de intercambio de archivos para evitar bloqueos del sistema operativo (Windows).
- **Última Actualización de Usuarios**: Se independizó el registro de la fecha de última actualización para la base de datos de usuarios.

### Corregido
- **Sincronización de Datos en Disco**: Se corrigió un desfase de datos forzando la escritura en disco antes de firmar y comprimir la base de datos para su subida.
- **Prevención de Concurrencia**: Se bloqueó la ejecución de sincronizaciones manuales simultáneas.
- **Limpieza de Archivos Temporales**: Se implementó la eliminación de archivos de transacciones residuales al reemplazar bases de datos para prevenir posible corrupción de datos.
- **Timeout en Subidas**: Se configuró un tiempo máximo de espera de 30 segundos en las subidas de red para evitar bloqueos indefinidos por problemas de conexión.
- **Registro de Logs**: Se añadieron eventos de auditoría detallados en el log del sistema para la sincronización de usuarios.
- **Limpieza Visual**: Se eliminó una etiqueta de última actualización duplicada en la interfaz.

---

## [2.6.0] - 2026-07-08

### Añadido
- **Filtros de Logs Segmentados**: Nueva barra interactiva con indicadores de color para clasificar rápidamente los logs del sistema por nivel de severidad y paginación de eventos en el panel de administración.

### Cambiado
- **Mejoras Visuales y de Contraste**: Suavizado de bordes y líneas divisorias en la bitácora de logs, mejoras en la legibilidad del módulo de reportes, y rediseño de selectores de estado.

### Eliminado
- **Leyenda de Logs Redundante**: Se retiró la leyenda explicativa de severidad para integrar la indicación de navegación directamente en la cabecera.

### Corregido
- **Navegación e Interacción de Logs**: Se corrigió el despliegue de detalles de logs al interactuar con registros filtrados o paginados, y se resolvió un problema visual al alternar filtros.

---

## [2.5.0] - 2026-07-07

### Añadido
- **Auditor de Cambios de Sincronización**: Comparador detallado que registra diferencias de filas agregadas, modificadas y eliminadas en la base de datos local, junto con un nuevo modal interactivo de auditoría con pestañas por categoría.
- **Escudo de Integridad de Datos**: Sistema de validación en tiempo real de la firma de la base de datos para detectar alteraciones, mostrando un indicador de salud del sistema.
- **Segmentación de Alertas**: Filtro por tipo de alertas en el Centro de Alertas para agilizar la clasificación de plazos legales.

### Cambiado
- **Feedback de Sincronización**: Apertura automática del modal de auditoría interactivo al completar una sincronización, reemplazando las notificaciones flotantes previas.
- **Optimización y Estandarización de Estilos**: Centralización de variables visuales de calendario para mejorar el soporte del tema oscuro, consolidación de selectores repetidos y compatibilidad de efectos translúcidos en diversos motores de renderizado.
- **Navegación en Administración**: Reordenamiento de las pestañas del panel administrativo, dejando el control de auditoría abierto por defecto.

### Corregido
- **Resolución de Errores de Carga**: Se corrigió un error que interrumpía la inicialización de iconos al cargar la bitácora de logs.

---

## [2.4.0] - 2026-07-03

### Añadido
- **Módulo de Agenda**: Nueva sección de calendario con soporte para vistas mensual, semanal y diaria, con código de colores para audiencias pasadas y futuras.
- **Detalle de Audiencias**: Modal informativo con datos completos de audiencias, cruzando folios en tiempo real para validar plazos legales y estado de publicación.
- **Alertas de Reuniones del Día**: Notificaciones预防 preventivas en el panel y en el centro de alertas para las reuniones agendadas en la fecha actual.

---

## [2.3.0] - 2026-07-03

### Añadido
- **Instalador Interactivo**: Soporte para un instalador asistido paso a paso para Windows, respetando la decisión del usuario de iniciar o no la aplicación al finalizar.
- **Identidad Corporativa**: Incorporación de icono personalizado en el instalador y accesos directos.

### Eliminado
- **Deuda Técnica y Funciones Obsoletas**: Remoción definitiva del soporte para contraseñas locales y de formularios/rutas del antiguo login local, consolidando la aplicación exclusivamente en torno a Single Sign-On (SSO).

### Corregido
- **Representación Visual en Dashboard**: Ajuste en el cálculo de porcentajes para evitar mostrar valores nulos en categorías de bajo peso pero con datos reales.

---

## [2.2.2] - 2026-07-02

### Añadido
- **Arquitectura de Bases de Datos Separadas**: Separación del almacenamiento en archivos independientes para datos de lobby, usuarios autorizados y configuración local.
- **Módulo de Logs Unificado**: Centralización del registro de eventos del sistema.
- **Plantilla de Impresión**: Nueva plantilla para impresión local de reportes.

### Cambiado
- **Seguridad de Autenticación**: Mapeo de la base de datos de usuarios exclusiva para autorización SSO y subida síncrona inmediata de cambios de usuarios a la plataforma en la nube para prevenir pérdida de datos.

### Corregido
- **Manejo de Bloqueo de Archivos en Windows**: Rediseño del proceso de inicio de sesión para liberar de manera segura los archivos y evitar bloqueos en el sistema operativo.

### Eliminado
- **Contraseñas Locales**: Eliminación de toda la lógica heredada de contraseñas locales.
- **Historial de Reportes**: Eliminación del almacenamiento histórico de reportes para procesar la generación de documentos en caliente del lado del cliente.
- **Servidor HTTP Local**: Remoción definitiva del servidor web local para consolidar la comunicación interna a través de los canales de comunicación de la plataforma de escritorio.

---

## [2.2.1] - 2026-06-26

### Seguridad
- **Control de Autoregistro**: Reversión de la lógica de registro automático para mitigar riesgos de elevación de privilegios no autorizados.

---

## [2.2.0] - 2026-06-26

### Añadido
- **Asignación de Administrador Inicial**: Registro automático del primer usuario autenticado como administrador del sistema si la base de datos está vacía.

---

## [2.1.1] - 2026-06-26

### Corregido
- **Redirección de Inicio de Sesión**: Solución a un bucle infinito en el inicio de sesión para usuarios de departamentos específicos en la plataforma en la nube.
- **Rutas de Datos en Producción y Desarrollo**: Ajuste para evitar la creación de archivos de base de datos en directorios protegidos del sistema en producción y configuración de carpetas locales en desarrollo.
- **Empaquetado**: Corrección en los archivos cargados durante el empaquetado para incluir todos los scripts necesarios.

---

## [2.1.0] - 2026-06-26

### Añadido
- **Soporte de Conexiones de Respaldo**: URLs corporativas integradas en el código para asegurar la portabilidad de las conexiones a la nube.
- **Configuración de Almacenamiento**: Lógica dinámica para ubicar los archivos de datos según el entorno (producción o desarrollo).
- **Documentación del Sistema**: Actualización completa del manual de la aplicación.

### Cambiado
- **Identidad de la Aplicación**: Cambio de nombre comercial del sistema e identidades visuales asociadas.
- **Limpieza del Repositorio**: Remoción de archivos temporales y código obsoleto.

---

## [2.0.0] - 2026-06-26

### Añadido
- **Migración a Aplicación de Escritorio**: Transición de la aplicación web local a una arquitectura nativa de escritorio (Electron).
- **Seguridad Interna**: Comunicación privada entre componentes sin abrir puertos de red expuestos, y puente seguro para exponer APIs controladas al cliente.

---

## [1.4.0] - 2026-06-26

### Añadido
- **Motor de Sincronización**: Lógica de sincronización bidireccional y control de versiones para soporte offline/online.

---

## [1.3.0] - 2026-06-26

### Añadido
- **Conexión a SharePoint**: Integración de credenciales y autenticación directa con la plataforma en la nube municipal.

---

## [1.2.0] - 2026-06-26

### Añadido
- **Optimización de Importación**: Mejoras en el importador de datos para procesar volúmenes masivos de registros.

---

## [1.1.0] - 2026-06-26

### Añadido
- **Soporte Sin Conexión**: Rediseño del cliente para incorporar alertas de red, reintentos de conexión y búsqueda local de audiencias en modo offline.

---

## [1.0.3] - 2026-06-25

### Corregido
- **Búsqueda Offline**: Solución a fallas de filtros en las vistas de búsqueda local.
- **Visualización del Dashboard**: Corrección en tablas con registros muy extensos para evitar problemas de diseño.

---

## [1.0.2] - 2026-06-24

### Corregido
- **Formateo de Fechas**: Normalización de formatos de fecha inconsistentes de la Ley de Lobby.
- **Duplicación de Datos**: Corrección de inserciones duplicadas durante el proceso de importación.

---

## [1.0.1] - 2026-06-23

### Corregido
- **Importación de Planillas**: Limpieza de registros vacíos y celdas nulas en la importación desde archivos Excel.
- **Compatibilidad**: Ajuste de dependencias para el soporte de archivos de hojas de cálculo.

---

## [1.0.0] - 2026-06-22

### Añadido
- **Lanzamiento Inicial**: Versión inicial de la plataforma de gestión local de audiencias bajo la Ley de Lobby.
- **Almacenamiento y Carga**: Estructuras de datos iniciales y scripts para importación y validación de datos.
