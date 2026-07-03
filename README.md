# LobbyControl

LobbyControl es una solución de software interno diseñada y desarrollada exclusivamente para dar soporte a un contexto institucional y de infraestructura específico. 

## Contexto de Desarrollo e Integración Interna

Este sistema ha sido construido a medida para resolver las necesidades particulares de gestión, visualización y auditoría de audiencias públicas reguladas por la Ley de Lobby (Ley N° 20.730). Su arquitectura de comunicación segura (basada en el puente IPC nativo de Electron) y su motor de sincronización de bases de datos se encuentran acoplados a servicios y repositorios específicos de este entorno interno.

---

## Nota Técnica sobre Portabilidad y Adaptabilidad

Si bien el proyecto está configurado para operar en un entorno cerrado y específico:
*   **Arquitectura Base**: La estructura del proyecto y su separación en procesos aislados de Electron (puente seguro de `contextBridge` y preload scripts) sirve como un modelo de referencia robusto para aplicaciones de escritorio que requieren alta seguridad y comunicación local.
*   **Adaptación de APIs**: La lógica de negocio y las consultas de sincronización de base de datos pueden ser modificadas o adaptadas para interactuar con otras APIs de almacenamiento en la nube, bases de datos remotas u otros sistemas de autenticación empresarial y directorios externos.
