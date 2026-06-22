# LobbyTracker 📋

> **Versión Actual:** 1.0.0  
> **Ámbito:** MVP de gestión local de audiencias bajo la Ley de Lobby para instituciones y organismos públicos.

LobbyTracker es una aplicación web local diseñada para centralizar, visualizar y auditar las audiencias registradas bajo la Ley de Lobby. Proporciona una interfaz ágil para administradores y auditores de organismos públicos, facilitando la importación de planillas de datos y la generación de reportes analíticos de manera genérica y adaptable.

---

## 🚀 Características Principales

1. **Dashboard Analítico e Interactivo**
   - Visualización gráfica de estadísticas clave (materias recurrentes, audiencias por período, sujetos pasivos más activos).
   - Integración con **Chart.js** para gráficos interactivos.

2. **Gestión e Importación de Datos (Excel / SQLite)**
   - Importador seguro que procesa archivos de datos en lote (`.xlsx`) y actualiza la base de datos local SQLite.
   - Control de concurrencia para evitar bloqueos en escrituras de base de datos durante sincronizaciones simultáneas.

3. **Generación de Reportes**
   - Módulo para filtrar, buscar y generar reportes específicos en formato PDF o Excel.
   - Registro persistente de reportes generados en el servidor para auditorías posteriores.

4. **Diseño e Infraestructura Local**
   - **Independiente de Internet:** Todos los recursos (Tailwind CSS compilado, Chart.js, Lucide Icons) se sirven de manera 100% local, ideal para despliegues seguros dentro de la red corporativa o institucional.
   - Base de datos optimizada en modo **WAL (Write-Ahead Logging)** de SQLite para garantizar lecturas rápidas y concurrentes.

5. **Control de Sesión por Inactividad**
   - Sistema de desconexión automática y limpieza de estado ante inactividad prolongada del usuario para resguardar la seguridad del terminal.

---

## 🛠️ Tecnologías Utilizadas

- **Servidor:** Node.js, Express
- **Base de Datos:** SQLite (`sqlite3` local)
- **Frontend:** Vanilla HTML5, CSS y Javascript
- **Librerías Clave:** `xlsx` (parsing de Excel), `express-rate-limit` (seguridad anti-abusos), `dotenv` (gestión de variables de entorno).

---

## 📦 Instalación y Configuración

### Requisitos Previos

- Node.js (v18 o superior)
- Git

### Pasos para iniciar el proyecto

1. **Instalar dependencias:**

   ```bash
   npm install
   ```

2. **Configurar el entorno:**
   Crea un archivo `.env` en la raíz del proyecto (basado en `.env.example` si existe, o con los siguientes valores estándar):

   ```env
   PORT=3000
   DATABASE_PATH=data/lobby.db
   EXCEL_PATH=data/lobby_data.xlsx
   ```

3. **Importar los datos iniciales:**
   Si dispones de una planilla de Excel inicial, colócala en la ruta especificada en `EXCEL_PATH` y ejecuta:

   ```bash
   npm run import-lobby
   ```

4. **Iniciar el servidor en modo desarrollo:**
   ```bash
   npm run dev
   ```
   El dashboard estará disponible en `http://localhost:3000`.

