# Auditoría Técnica y Plan de Implementación de Producción - LobbyTracker

Análisis sistemático de arquitectura, seguridad y rendimiento para la transición del sistema LobbyTracker a un entorno de producción institucional en la Municipalidad de Maipú.

---

## 1. Matriz de Hallazgos y Severidad

A continuación se detallan los problemas y oportunidades identificados en el análisis del codebase:

| Id | Componente | Descripción del Hallazgo | Severidad | Impacto Técnico / Justificación |
| :--- | :--- | :--- | :--- | :--- |
| **01** | Frontend | **Stored/Passive XSS (Cross-Site Scripting)**: La renderización de datos dinámicos en [views.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/public/js/views.js) (como nombres de sujetos pasivos, materias o cargos) inyecta variables directamente en plantillas de cadenas (`${item.sujeto_pasivo}`) sin escapar caracteres HTML especiales. | **Crítico** | Si un archivo Excel importado contiene código HTML/JS malicioso, se ejecutará en la sesión del usuario del navegador de la municipalidad, pudiendo comprometer tokens o realizar acciones no autorizadas. |
| **02** | Base de datos | **Tabla faltante en el esquema inicial**: El endpoint `/api/reportes/registrar` en [server.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/server.js#L989-L1026) realiza consultas de escritura sobre la tabla `reportes_generados`, pero esta tabla no es creada en [database.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/database.js). | **Crítico** | Todo intento de registrar reportes del lado del servidor falla con un error de SQLite (tabla inexistente), obligando al cliente a depender de un fallback de generación aleatoria local. |
| **03** | Frontend | **Tailwind CSS cargado dinámicamente mediante CDN**: En [index.html](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/public/index.html#L12) se utiliza el script de desarrollo de Tailwind, el cual compila estilos al vuelo en el cliente. | **Crítico** | Bloquea la renderización inicial (FOUC), retrasa el Time to Interactive (TTI), consume ciclos de CPU innecesarios en el cliente y genera dependencia de redes externas en entornos de intranet municipal. |
| **04** | Seguridad / Infraestructura | **Dependencias externas sin versiones fijas ni firmas SRI**: El frontend carga librerías críticas (como Lucide Icons, html2pdf y Chart.js) desde CDNs abiertos y no controlados (como `@latest` en Lucide) sin atributos de integridad `integrity` (SRI). | **Crítico** | Riesgo alto ante ataques de cadena de suministro (Supply Chain Attacks) si los CDNs son vulnerados, y posible caída o cambio del API externo que rompería la aplicación sin aviso. |
| **05** | Backend | **Falta de control de concurrencia en la importación**: El endpoint `/api/admin/importar` ejecuta un proceso secundario mediante `child_process.fork` sin validar si existe otra importación activa. | **Advertencia** | Si múltiples administradores inician la sincronización del Excel al mismo tiempo, los procesos concurrentes chocarán intentando escribir en el archivo SQLite, resultando en excepciones de base de datos bloqueada (`SQLITE_BUSY`). |
| **06** | Backend / BD | **SQLite en Modo Journal por Defecto**: La base de datos opera bajo el modo journal estándar y no aprovecha el Write-Ahead Logging (WAL) para lecturas y escrituras concurrentes. | **Advertencia** | Durante importaciones masivas o generación pesada de reportes, el archivo de base de datos se bloquea de forma exclusiva, impidiendo consultas de lectura en el resto del dashboard de usuarios conectados. |
| **07** | Infraestructura | **Configuración Ineficiente de Caché de Estáticos**: El middleware de archivos estáticos en [server.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/server.js#L161-L165) desactiva la caché en el navegador (`no-store, no-cache`) para todos los recursos. | **Advertencia** | Los clientes deben re-descargar todos los archivos JS y CSS del frontend en cada navegación o recarga, aumentando el consumo de ancho de banda y degradando la latencia del usuario final en producción. |
| **08** | Frontend | **Hydration y Flash of Unstyled Content (FOUC) en Tema**: La inicialización del modo oscuro/claro se evalúa después del parseo de la cabecera en lugar de inyectar clases directamente de forma estática. | **Oportunidad de Mejora** | Causa un breve destello blanco en pantallas oscuras mientras carga y lee del localStorage del cliente. |

---

## 2. Plan de Mitigación y Refactorización Secuencial

A continuación se propone una estrategia paso a paso para resolver todos los hallazgos sin introducir regresiones funcionales:

### Fase 1: Seguridad y Robustez del Esquema (Críticos)

#### 1. Creación de la Tabla `reportes_generados`
- **Archivo a modificar**: [database.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/database.js)
- **Cambio**: Añadir la creación de la tabla `reportes_generados` en la fase de inicialización secuencial del esquema SQLite:
  ```sql
  CREATE TABLE IF NOT EXISTS reportes_generados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_reporte TEXT UNIQUE,
    fecha_generacion TEXT,
    sujeto_pasivo TEXT,
    cargo TEXT,
    filtros TEXT
  );
  ```

#### 2. Sanitización contra XSS en el Frontend
- **Archivo a modificar**: [helpers.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/public/js/helpers.js)
- **Cambio**: Crear un helper robusto de sanitización de texto (`escapeHtml`) para codificar entidades HTML de forma segura antes de renderizarlas en los text-nodes del DOM:
  ```javascript
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  ```
- **Archivos a modificar**: [views.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/public/js/views.js) y [app.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/public/js/app.js)
- **Cambio**: Revisar y envolver todas las interpolaciones de texto dinámico de usuarios (ej. `${item.sujeto_pasivo}`, `${item.cargo}`) con `escapeHtml(item.sujeto_pasivo)`.

---

### Fase 2: Optimización de Assets y Carga Crítica (Críticos)

#### 1. Compilación Estática de Tailwind CSS
- **Estrategia**: Reemplazar el CDN interactivo de Tailwind en producción. Dado que es un MVP de escala local/intranet, podemos compilar un archivo CSS estático y ligero empleando la CLI de Tailwind o inyectar una compilación limpia de producción local de Tailwind sin CDNs externos.
- **Archivo a modificar**: [index.html](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/public/index.html)
- **Cambio**: Eliminar `<script src="https://cdn.tailwindcss.com"></script>` y vincular el CSS final optimizado de Tailwind en la cabecera.

#### 2. Localización y Fijación de Dependencias Externas (SRI)
- **Estrategia**: Descargar los archivos estáticos de dependencias de terceros (como `lucide.min.js`, `chart.js` y `html2pdf.bundle.min.js`) al directorio local de la aplicación `public/vendor/` para que el servidor los entregue directamente, eliminando la dependencia de red externa de forma absoluta.
- **Archivo a modificar**: [index.html](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/public/index.html)
- **Cambio**: Apuntar las etiquetas de scripts de CDNs a las rutas municipales locales `/vendor/...`.

---

### Fase 3: Concurrencia y Robustez del Servidor (Advertencias)

#### 1. Activación de SQLite WAL (Write-Ahead Logging)
- **Archivo a modificar**: [database.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/database.js)
- **Cambio**: Ejecutar la directiva `PRAGMA journal_mode = WAL` al conectar a la base de datos para habilitar lecturas no bloqueantes de manera simultánea con las operaciones de escritura del proceso de importación.

#### 2. Control de Estado / Lock Mutex para Importación
- **Archivo a modificar**: [server.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/server.js)
- **Cambio**: Implementar un semáforo de estado en memoria (`let isImporting = false;`) para denegar peticiones concurrentes de sincronización con un código `409 Conflict`.

#### 3. Política de Caché Eficiente
- **Archivo a modificar**: [server.js](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maip%C3%BA/Documentos/Antigravity/Lobby/server.js)
- **Cambio**: Configurar cabeceras de caché de corta duración (`Cache-Control: public, max-age=3600`) para estáticos, y asegurar que las marcas de versión (`?v=1.0.14`) fuercen la recarga solo cuando ocurran despliegues reales.

---

## 3. Plan de Verificación Técnica

### Pruebas Automatizadas y de Carga
1. **Verificación de la Base de Datos**:
   - Ejecutar la inicialización del esquema y comprobar con `sqlite3 lobby.db ".tables"` que la tabla `reportes_generados` se crea con éxito.
   - Probar concurrencia con una herramienta de benchmarking (como `autocannon` o `ab`) enviando 100 peticiones de lectura simultáneas a `/api/stats` mientras se realiza una importación incremental.

2. **Verificación contra XSS**:
   - Inyectar registros de prueba a través de Excel con payloads como: `<img src=x onerror=alert('xss')>` o `"><script>alert(1)</script>`.
   - Comprobar que en la tabla del panel de administración y solicitudes los payloads se muestran sanitizados como texto y no se ejecuta el código JS.

3. **Verificación de Red y TTI**:
   - Usar la pestaña "Network" de Chrome DevTools en modo offline simulado para verificar que la aplicación puede cargar las dependencias (Lucide, Chart.js, Tailwind) de manera puramente local desde el servidor sin dependencias externas.

---

> [!IMPORTANT]
> **Aprobación del Usuario Requerida**
> Por favor revisa detenidamente este plan de auditoría y mitigación técnica. Si estás de acuerdo con la estrategia de mitigación de vulnerabilidades y la creación de la tabla faltante, por favor apruébala para proceder a la ejecución.
