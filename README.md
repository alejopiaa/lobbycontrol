# LobbyControl 📋

> **Versión Actual:** 1.0.0  
> **Ámbito:** Aplicación nativa de escritorio (Electron) desarrollada en el contexto y con datos de la **Ilustre Municipalidad de Maipú** para la centralización, visualización, auditoría y análisis de audiencias públicas bajo la Ley de Lobby (Ley N° 20.730), operando bajo un entorno de comunicación aislado y seguro sin exposición de puertos locales.

LobbyControl es una solución construida en base a los datos y requerimientos específicos del caso de la **Ilustre Municipalidad de Maipú**. Está diseñada para procesar, auditar y explorar registros locales de audiencias de lobby. 

> [!NOTE]
> **Contexto de Desarrollo y Portabilidad**
> Esta aplicación no ha sido desarrollada por, para, ni en la Municipalidad de Maipú. Ha sido desarrollada utilizando sus datos y estructura en el contexto específico de su caso de uso particular (el cual depende de su integración con Microsoft SharePoint). Por lo tanto, esta arquitectura y su lógica de sincronización están acopladas a dicho entorno corporativo y podrían requerir adaptaciones significativas para ser utilizadas en otros servicios públicos que utilicen plataformas de almacenamiento o autenticación distintas.

Permite procesar planillas de datos externas y sincronizarlas con los repositorios corporativos de SharePoint definidos para el caso de Maipú, consolidando los registros en una base de datos SQLite local para ofrecer un panel analítico en tiempo real, alertas de cumplimiento, búsqueda avanzada y exportación de reportes semanales de auditoría.

---

## 🚀 Características Principales y Funcionalidades

### 1. Panel de Control Estadístico (Dashboard)

- **Métricas Clave (KPIs):** Visualización instantánea del total de audiencias procesadas, cantidad de sujetos pasivos (autoridades/funcionarios), lobbistas/gestores únicos registrados y cantidad de materias abordadas.
- **Gráficos Interactivos:** Gráficos dinámicos desarrollados con **Chart.js** que muestran:
  - Distribución y tendencia temporal de las audiencias.
  - Ranking de materias o temáticas más recurrentes.
  - Sujetos pasivos con mayor cantidad de audiencias sostenidas.
- **Temas Visuales:** Soporte para cambio dinámico entre Modo Claro (Light Mode) y Modo Oscuro (Dark Mode).

### 2. Búsqueda Avanzada y Filtros Dinámicos

- Búsqueda por texto libre sobre materias, nombres de sujetos pasivos, contrapartes (lobbistas/gestores de interés) o cargos.
- Filtros combinados por rango de fechas, instituciones u oficinas de destino.
- Paginación y carga optimizada de resultados para manejar grandes volúmenes de registros sin ralentizar la interfaz.

### 3. Sistema de Reportes y Auditoría

- **Exportación a PDF:** Conversión dinámica de vistas de datos y búsquedas filtradas a reportes listos para imprimir o guardar mediante `html2pdf.js`.
- **Registro de Auditoría:** Historial persistente en el servidor de todos los reportes generados (`reportes_generados` en base de datos) para control interno de qué información ha sido consultada y exportada.

### 4. Gestión y Sincronización de Datos (Módulo de Administración)

- **Importación Masiva:** Procesamiento automatizado de hojas de cálculo (`.xlsx` o `.csv`) para actualizar la base de datos de audiencias en segundos.
- **Control de Concurrencia:** Semáforo lógico (mutex) en memoria que impide la ejecución simultánea de múltiples importaciones, evitando conflictos de base de datos (`SQLITE_BUSY`).
- **Ejecución en Segundo Plano:** El proceso de importación masiva se delega a un subproceso (`child_process.fork`), asegurando que la interfaz web siga respondiendo sin interrupciones a los demás usuarios.

### 5. Seguridad y Rendimiento

- **Cierre de Sesión por Inactividad:** Sistema de control de inactividad del cliente que avisa mediante un contador de advertencia y redirige automáticamente al login al expirar el tiempo establecido.
- **Sanitización XSS:** Codificación de entidades HTML especiales antes de renderizar entradas dinámicas del usuario en el navegador.
- **SQLite optimizado con WAL:** Activación de _Write-Ahead Logging_ para habilitar lecturas y escrituras simultáneas y fluidas.

---

## 🛠️ Stack Tecnológico

- **Entorno de Ejecución:** Electron (Procesos Principal y de Renderizado completamente aislados).
- **Backend:** Node.js + Express (operando exclusivamente en memoria como enrutador virtual via IPC nativo, sin levantar servidores HTTP).
- **Base de Datos:** SQLite (`sqlite3`) para almacenamiento persistente ligero, rápido y autoportante.
- **Frontend:** HTML5 semántico, CSS vainilla estructurado y Javascript (ES6+) interactivo.
- **Dependencias principales:**
  - `xlsx` (para la ingesta y manipulación de planillas Excel).
  - `dotenv` (gestión segura de variables de entorno).

---

## 📂 Estructura del Proyecto

```text
├── public/                  # Archivos estáticos de la interfaz (cargados via app://)
│   ├── css/                 # Estilos CSS de la interfaz
│   ├── js/                  # Lógica del frontend (módulos, vistas, helpers, interceptor IPC)
│   ├── vendor/              # Librerías estáticas de terceros (sin CDNs externos)
│   └── index.html           # Página web principal
├── src/                     # Código fuente del backend estructurado
│   ├── config/              # Inicialización y parámetros de base de datos y SSO
│   ├── ipc/                 # Manejadores de comunicación interprocesos (IPC) y seguridad
│   ├── middleware/          # Autenticación y utilidades del enrutador virtual
│   └── utils/               # Helpers y utilidades generales
├── scripts/                 # Scripts auxiliares para el ciclo de desarrollo
│   ├── import_lobby.js      # Procesamiento de importaciones Excel a SQLite
│   ├── check_db.js          # Diagnóstico de integridad de base de datos
│   └── inspect.js           # Inspección de esquemas y estadísticas rápidas
├── main.js                  # Proceso principal de Electron (configuración de ventana y protocolo)
├── preload.js               # Puente de precarga seguro (Context Bridge)
├── server.js                # Enrutador Express virtual en memoria (sin puerto TCP)
├── package.json             # Manifiesto del proyecto y scripts npm
└── .gitignore               # Configuración de archivos excluidos de Git
```

---

## ⚙️ Scripts Disponibles en `package.json`

- `npm run electron:dev`: Inicia el cliente de Electron en entorno de desarrollo.
- `npm run electron:build`: Compila y empaqueta la aplicación como un ejecutable portable de producción para Windows.
- `npm run import-lobby`: Ejecuta el script de importación de la planilla Excel a SQLite.
- `npm run check-db`: Valida la integridad y realiza un diagnóstico rápido de los registros en la base de datos local SQLite.
- `npm run inspect-db`: Muestra un desglose analítico y descriptivo de las tablas en el terminal.
