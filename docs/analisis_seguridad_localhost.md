# Análisis de Seguridad: Exposición del Servidor Local en Electron

Este documento detalla las implicaciones de seguridad, riesgos y técnicas de mitigación respecto a la exposición del puerto local (`localhost`) al ejecutar la aplicación LobbyControl dentro de Electron.

---

## 1. El Fenómeno: Exposición en Localhost

Al compilar la aplicación, Electron levanta un servidor de Express en segundo plano (`server.js`) en un puerto local (por ejemplo, `3000`). La interfaz de Electron carga este servidor dinámicamente (`http://localhost:3000`).

Dado que Express actúa como un servidor HTTP estándar, **cualquier navegador web dentro del mismo computador** puede ingresar a la URL y visualizar la interfaz con acceso a todos los datos y operaciones de administración.

---

## 2. Riesgos de Seguridad Latentes

### A. Acceso desde la Red Local (Intranet Municipal)
*   **Vulnerabilidad**: Por defecto en Node.js, si no se especifica explícitamente un host de enlace (ej. `app.listen(PORT)`), el servidor se asocia a `0.0.0.0` (todas las interfaces de red IPv4).
*   **Impacto**: Cualquier persona en la misma red física o intranet (como la red municipal de Maipú) que conozca la IP del computador del usuario podría escribir en su navegador `http://[IP_DEL_COMPUTADOR]:3000` y acceder por completo a la base de datos de audiencias locales.

### B. Acceso Multiusuario en la Misma Máquina
*   **Vulnerabilidad**: Si el equipo es compartido o se accede a él mediante sesiones simultáneas (como Terminal Services o escritorios virtuales), cualquier otro usuario conectado a la máquina puede ingresar a `http://localhost:3000` en su navegador.

---

## 3. Estrategias de Mitigación Recomendadas

### Medida 1: Restricción de Interfaz Loopback (127.0.0.1)
La acción más rápida y segura consiste en obligar al servidor a escuchar únicamente en la dirección de bucle local (`127.0.0.1`), impidiendo que reciba tráfico de la tarjeta de red física.

*   **Implementación conceptual**:
    *   Configurar `app.listen(PORT, '127.0.0.1', ...)` en el archivo de inicio del servidor.
*   **Efecto**: Cualquier petición externa proveniente de otro computador de la red será rechazada inmediatamente a nivel de sistema operativo.

### Medida 2: Autenticación por Tokens de Sesión Local
Evita el acceso no autorizado de navegadores locales de otros usuarios del mismo equipo.

*   **Implementación conceptual**:
    *   Electron genera una clave secreta aleatoria y única de un solo uso durante su inicio.
    *   Electron inyecta este Token en las cabeceras HTTP de todas sus solicitudes a Express.
    *   El servidor Express valida la existencia y coincidencia de este token. Si no coincide (como en un acceso manual desde Chrome), retorna un error `403 Forbidden`.

### Medida 3: Migración a una Arquitectura Electron Pura (Sin Servidor Local)
Para entornos de alta seguridad en producción, se debe prescindir de levantar puertos HTTP locales.

*   **Implementación conceptual**:
    *   La interfaz estática (HTML/CSS/JS) se empaqueta y carga usando el protocolo de archivos nativo de Electron (`file:///` o esquemas personalizados de Electron como `app://`).
    *   La comunicación con la base de datos SQLite y las APIs locales se realiza directamente mediante la API de comunicación entre procesos de Electron (**IPC - Inter-Process Communication**) en lugar de realizar llamadas de red locales.
