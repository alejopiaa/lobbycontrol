# LobbyControl 📋

> **Versión Actual:** 1.0.0  
> **Ámbito:** Plataforma web local e interactiva para la centralización, visualización, auditoría y análisis de audiencias públicas bajo la Ley de Lobby.

LobbyControl es una solución diseñada para organismos públicos e instituciones que requieren procesar, auditar y explorar registros de audiencias de lobby. Permite cargar planillas de datos externas, consolidarlas en una base de datos local ligera y segura, y ofrecer una interfaz intuitiva con análisis estadísticos en tiempo real, búsqueda avanzada y exportación de reportes.

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
- **Rate Limiting:** Protección en rutas críticas del API mediante `express-rate-limit` para mitigar ataques de fuerza bruta o abuso de endpoints.
- **Sanitización XSS:** Codificación de entidades HTML especiales antes de renderizar entradas dinámicas del usuario en el navegador.
- **SQLite optimizado con WAL:** Activación de _Write-Ahead Logging_ para habilitar lecturas y escrituras simultáneas y fluidas.

---

## 🛠️ Stack Tecnológico

- **Backend:** Node.js + Express.js.
- **Base de Datos:** SQLite (`sqlite3`) para almacenamiento persistente ligero, rápido y autoportante.
- **Frontend:** HTML5 semántico, CSS vainilla estructurado y Javascript (ES6+) interactivo.
- **Dependencias principales:**
  - `xlsx` (para la ingesta y manipulación de planillas Excel).
  - `dotenv` (gestión segura de variables de entorno).
  - `express-rate-limit` (seguridad a nivel de peticiones HTTP).

---

## 📂 Estructura del Proyecto

```text
├── public/                  # Archivos estáticos servidos al cliente
│   ├── css/                 # Estilos CSS de la interfaz
│   ├── js/                  # Lógica del frontend (módulos, vistas, helpers)
│   ├── vendor/              # Librerías estáticas de terceros (sin CDNs externos)
│   └── index.html           # Página web principal
├── src/                     # Código fuente del backend estructurado
│   ├── config/              # Inicialización y parámetros de base de datos
│   ├── middleware/          # Rate limits, autenticación y seguridad
│   └── utils/               # Helpers y utilidades generales del servidor
├── scripts/                 # Scripts auxiliares para el ciclo de desarrollo
│   ├── import_lobby.js      # Procesamiento de importaciones Excel a SQLite
│   ├── check_db.js          # Diagnóstico de integridad de base de datos
│   └── inspect.js           # Inspección de esquemas y estadísticas rápidas
├── server.js                # Archivo principal de inicialización de la app
├── package.json             # Manifiesto del proyecto y scripts npm
└── .gitignore               # Configuración de archivos excluidos de Git
```

---

## 📦 Instalación y Puesta en Marcha

### Requisitos

- Node.js (versión 18 o superior)
- Git

### Pasos

1.  **Clonar el repositorio:**

    ```bash
    git clone https://github.com/alejopiaa/lobbycontrol.git
    cd lobbycontrol
    ```

2.  **Instalar las dependencias de Node.js:**

    ```bash
    npm install
    ```

3.  **Configurar variables de entorno:**
    Crea un archivo `.env` en la raíz del proyecto y ajusta los valores necesarios:

    ```env
    PORT=3000
    DATABASE_PATH=data/lobby.db
    EXCEL_PATH=data/lobby_data.xlsx
    ```

4.  **Inicializar la Base de Datos:**
    Si cuentas con un archivo de Excel con registros iniciales en la ruta especificada, importa los datos ejecutando:

    ```bash
    npm run import-lobby
    ```

5.  **Iniciar la aplicación:**
    - **Entorno de Producción:**
      ```bash
      npm start
      ```
    - **Entorno de Desarrollo (con recarga automática):**
      ```bash
      npm run dev
      ```

    La aplicación estará disponible en `http://localhost:3000`.

---

## ⚙️ Scripts Disponibles en `package.json`

- `npm start`: Inicia el servidor de producción en el puerto configurado.
- `npm run dev`: Inicia el servidor en modo desarrollo utilizando la bandera `--watch-path` para reiniciar al detectar cambios.
- `npm run import-lobby`: Ejecuta el script de lectura de la planilla Excel e inserción de datos en SQLite.
- `npm run check-db`: Valida la estructura, tablas y realiza conteo de registros en la base de datos local.
- `npm run inspect-db`: Muestra un desglose descriptivo de la información en el terminal.
