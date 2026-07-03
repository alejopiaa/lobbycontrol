# Plan de Implementación: Instalador de Un Clic (NSIS) — Validado ✅

## Resultado de la Validación Técnica

He verificado la factibilidad real contra tu proyecto actual y la documentación oficial de `electron-builder`. **La Opción 1 (NSIS One-Click) es 100% viable y requiere cambios mínimos.**

### Hallazgos de la Validación

| Punto de Verificación | Estado | Detalle |
|---|---|---|
| `electron-builder` instalado | ✅ | Versión `26.15.3` — soporta NSIS nativamente |
| Soporte NSIS en tu versión | ✅ | NSIS es el target por defecto en electron-builder; `dir` era solo un atajo de desarrollo |
| `perMachine: false` evita UAC | ✅ | Confirmado por documentación oficial y StackOverflow: instalar en `%LOCALAPPDATA%` no requiere elevación de permisos |
| `oneClick: true` funciona sin interacción | ✅ | El usuario hace doble clic y la app se instala sola en ~5-10 segundos |
| Ícono de aplicación (`icon.ico`) | ⚠️ | **No existe** `public/icon.ico`. El instalador funcionará, pero mostrará el ícono genérico de Electron. Se necesita crear un `.ico` de 256×256px. |
| Script de build actual | ⚠️ | Usa `--dir` (carpeta portable). Necesita un nuevo script para generar el `.exe` instalador |

---

## Cambios Propuestos

### [MODIFY] [package.json](file:///c:/Users/abarrazaj/OneDrive%20-%20Ilustre%20Municipalidad%20de%20Maipú/Documentos/Antigravity/Lobby/package.json)

Se modificarán **dos secciones**:

#### 1. Scripts — Añadir comando para generar el instalador
```diff
 "scripts": {
     "electron:dev": "electron .",
     "electron:build": "electron-builder --dir",
+    "electron:installer": "electron-builder",
     "postinstall": "electron-builder install-app-deps"
 }
```

> [!NOTE]
> Se conserva `electron:build` (carpeta portable para desarrollo rápido) y se añade `electron:installer` (genera el `.exe` instalador para distribución).

#### 2. Build config — Cambiar target de `dir` a `nsis` y configurar las opciones
```diff
 "build": {
     "appId": "com.lobbycontrol.app",
     "productName": "LobbyControl",
     "directories": {
       "output": "dist"
     },
     "win": {
       "target": [
-        "dir"
+        {
+          "target": "nsis",
+          "arch": ["x64"]
+        }
       ],
       "icon": "public/icon.ico"
     },
+    "nsis": {
+      "oneClick": true,
+      "perMachine": false,
+      "allowElevation": false,
+      "createDesktopShortcut": true,
+      "createStartMenuShortcut": true,
+      "shortcutName": "LobbyControl",
+      "runAfterFinish": true,
+      "deleteAppDataOnUninstall": false
+    },
     "asar": true
 }
```

#### Explicación de cada directiva:

| Directiva | Valor | Por qué |
|---|---|---|
| `oneClick` | `true` | Sin asistentes ni preguntas. Doble clic = instalado. |
| `perMachine` | `false` | **Clave.** Instala en `%LOCALAPPDATA%\Programs\lobbycontrol`, que es la carpeta personal del usuario. Windows NO pide contraseña de admin para escribir ahí. |
| `allowElevation` | `false` | Prohíbe explícitamente que el instalador intente pedir elevación de privilegios. |
| `createDesktopShortcut` | `true` | Crea automáticamente el ícono en el Escritorio del usuario. |
| `createStartMenuShortcut` | `true` | Crea acceso en el Menú Inicio de Windows. |
| `runAfterFinish` | `true` | La aplicación se abre sola al terminar de instalar. |
| `deleteAppDataOnUninstall` | `false` | Si el usuario desinstala, conserva la base de datos y configuración por seguridad. |

---

## Paso a Paso de Ejecución

### Paso 1: Modificar `package.json`
Aplicaré los cambios descritos arriba en la sección `"scripts"` y `"build"`.

### Paso 2: Generar el ícono (Opcional pero recomendado)
Si quieres que el instalador y el acceso directo tengan un ícono propio en vez del genérico de Electron, necesitamos crear un archivo `public/icon.ico` de 256×256 píxeles.

> [!IMPORTANT]
> Si no tienes un `.ico` listo, puedo generar uno a partir del logo `logo_secum.png` que ya existe en tu proyecto. ¿Quieres que lo haga?

### Paso 3: Compilar el instalador
```bash
npm run electron:installer
```
Esto generará el archivo ejecutable del instalador en:
```
dist/LobbyControl Setup 1.0.0.exe
```

### Paso 4: Prueba de instalación (Checklist)

| # | Verificación | Resultado Esperado |
|---|---|---|
| 1 | Ejecutar `LobbyControl Setup 1.0.0.exe` | La instalación arranca inmediatamente sin pedir contraseña de admin |
| 2 | Verificar que no aparece pantalla de UAC | No debe aparecer ninguna ventana de Windows pidiendo "¿Desea permitir que esta aplicación haga cambios...?" |
| 3 | La app se abre sola al terminar | LobbyControl debería arrancar automáticamente en ~5-10 segundos |
| 4 | Ícono en el Escritorio | Debe existir un acceso directo "LobbyControl" en el Escritorio |
| 5 | Ícono en Menú Inicio | Debe existir una entrada "LobbyControl" en el Menú Inicio |
| 6 | Ruta de instalación | Verificar que los archivos están en `%LOCALAPPDATA%\Programs\lobbycontrol` |
| 7 | Desinstalador | Verificar que aparece en "Agregar o quitar programas" de Windows y que el desinstalador también funciona sin admin |

---

## Preguntas Abiertas

> [!IMPORTANT]
> **¿Quieres que genere un ícono `.ico` para la aplicación?** Actualmente no existe `public/icon.ico` y el instalador usará el ícono genérico de Electron (el diamante azul). Puedo generar uno basado en tu logo `logo_secum.png` o puedes proporcionarme uno propio.
