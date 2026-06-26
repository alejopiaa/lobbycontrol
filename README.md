# LobbyControl 📋

> **Versión Actual:** 1.0.0  
> **Ámbito:** Aplicación nativa de escritorio (Electron) desarrollada en el contexto del caso de la **Ilustre Municipalidad de Maipú** para la centralización, visualización, auditoría y análisis de audiencias públicas bajo la Ley de Lobby (Ley N° 20.730), operando bajo un entorno de comunicación aislado y seguro sin exposición de puertos locales.

LobbyControl es una solución diseñada para la **Ilustre Municipalidad de Maipú** que requiere procesar, auditar y explorar registros de audiencias de lobby de manera local. Permite cargar planillas de datos externas y sincronizarlas de forma segura con los repositorios corporativos de SharePoint de la municipalidad, consolidándolas en una base de datos SQLite local protegida para ofrecer una interfaz fluida con análisis estadísticos en tiempo real, alertas de cumplimiento, búsqueda avanzada y exportación de reportes semanales de auditoría.

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
    Crea un archivo `.env` en la raíz del proyecto y ajusta los valores requeridos para la integración corporativa con la municipalidad y SharePoint.

    Ejemplo de archivo `.env`:
    ```env
    # Puerto local del router virtual Express (No expuesto externamente en Electron)
    PORT=3000

    # Rutas locales por defecto para la base de datos e importación de planillas
    DATABASE_PATH=data/lobby.db
    EXCEL_PATH=data/lobby_data.xlsx

    # Configuración de SharePoint y Microsoft SSO (Ilustre Municipalidad de Maipú)
    SHAREPOINT_HOST=immaipu.sharepoint.com
    SHAREPOINT_SITE_URL=https://immaipu.sharepoint.com/sites/SECMU
    SHAREPOINT_FOLDER_PATH=/sites/SECMU/Lobby/LobbyControl
    SHAREPOINT_VERSION_URL=https://immaipu.sharepoint.com/sites/SECMU/_layouts/15/guestaccess.aspx?share=IQAEqx-udSnjR45ENm8jcNqPAd0QSIgfWRzK6-U9madcQbA&e=d4EjCH&download=1
    SHAREPOINT_DB_URL=https://immaipu.sharepoint.com/sites/SECMU/_layouts/15/guestaccess.aspx?share=IQAfzlIEO2_3Sog3WHRpNfmWATBo8wbHkWgrvo3J3ncFW4M&e=asp2UG&download=1
    ```

4.  **Inicializar la Base de Datos (Opcional):**
    Si deseas inicializar la base de datos SQLite importando datos de la planilla Excel local desde la terminal, ejecuta el script de ingesta.
    
    > [!IMPORTANT]
    > **Ruta de Base de Datos y Variable IS_ELECTRON**
    > * **Base de Datos Local de Desarrollo**: Si corres el script directamente con `node scripts/import_lobby.js`, los datos se guardarán en el archivo definido en `DATABASE_PATH` (`data/lobby.db` dentro del workspace).
    > * **Base de Datos de Producción/Electron**: Si deseas que la importación apunte al directorio persistente de usuario que utiliza la aplicación Electron (`AppData/Local/LobbyControl/data/lobby.db`), debes establecer la variable de entorno `IS_ELECTRON=true` al ejecutar el script en tu terminal.
    >   * *Windows PowerShell:* `$env:IS_ELECTRON="true"; node scripts/import_lobby.js`
    >   * *Bash:* `IS_ELECTRON=true node scripts/import_lobby.js`

    Para ejecutar la importación simple de desarrollo:
    ```bash
    node scripts/import_lobby.js
    ```

5.  **Iniciar la aplicación (Electron):**
    - **Entorno de Desarrollo:**
      ```bash
      npm run electron:dev
      ```
    - **Compilar Ejecutable de Producción:**
      ```bash
      npm run electron:build
      ```

    *Nota: Debido a la migración de arquitectura hacia IPC seguro, no se expone ningún servidor HTTP ni puertos TCP de escucha en `http://localhost:3000`. Toda comunicación ocurre internamente a través del protocolo exclusivo de la app `app://lobbycontrol` y los canales de mensajería nativos de Electron.*

---

## ⚙️ Scripts Disponibles en `package.json`

- `npm run electron:dev`: Inicia el cliente de Electron en entorno de desarrollo.
- `npm run electron:build`: Compila y empaqueta la aplicación como un ejecutable portable de producción para Windows.
- `npm run import-lobby`: Ejecuta el script de importación de la planilla Excel a SQLite.
- `npm run check-db`: Valida la integridad y realiza un diagnóstico rápido de los registros en la base de datos local SQLite.
- `npm run inspect-db`: Muestra un desglose analítico y descriptivo de las tablas en el terminal.
