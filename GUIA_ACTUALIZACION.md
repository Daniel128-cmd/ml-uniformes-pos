# Guía Técnica de Actualización — ML Uniformes POS
>
> Última actualización: 22/02/2026

---

## 🏗️ Arquitectura Actual

```
ML-PEDIDOS/
├── index.html          ← POS (Punto de Venta) — frontend estático
├── admin.html          ← Centro de Gestión de Pedidos — frontend
├── app.js              ← Lógica del POS (cart, validaciones, submit)
├── admin.js            ← Lógica del panel admin (tablas, abonos, PDFs)
├── data.js             ← Catálogo de productos y colegios
├── styles.css          ← Estilos globales (vinotinto + beige)
├── firebase.json       ← Hosting config (Firebase)
├── firestore.rules     ← Reglas de seguridad Firestore
└── backend/
    ├── app.py          ← Servidor HTTP Python (puerto 8000)
    ├── pdf_generator.py← Generador de PDFs con ReportLab
    └── *.db            ← Base de datos SQLite
```

| Capa | Tecnología | Dónde corre |
|------|-----------|-------------|
| Frontend | HTML / CSS / Vanilla JS | Firebase Hosting (nube) |
| Backend API | Python 3 + HTTP server | Local / VPS propio |
| Base de datos | SQLite | Mismo servidor que backend |
| PDFs | ReportLab (Python) | Backend |

---

## 🔄 Cómo Actualizar el Código Sin Romper Datos

### Regla de Oro: Siempre subir la versión de caché

Cada vez que modificas `app.js`, `admin.js`, `data.js` o `styles.css`, **incrementa el número de versión** en el HTML:

```html
<!-- En index.html -->
<link rel="stylesheet" href="styles.css?v=17" />   <!-- antes: v=16 -->
<script src="data.js?v=17"></script>
<script src="app.js?v=17"></script>

<!-- En admin.html -->
<script src="admin.js?v=17"></script>
```

> ⚠️ Si no cambias el número, los navegadores de mamás/papás pueden usar la versión vieja guardada en caché y experimentar errores.

---

### Actualizar el Frontend (HTML/CSS/JS)

```powershell
# 1. Hacer cambios en los archivos
# 2. Subir la versión de caché en los HTML
# 3. Desplegar a Firebase Hosting:
firebase deploy --only hosting
# Listo. El cambio está en producción en ~30 segundos.
```

---

### Actualizar el Backend (Python / Base de datos)

```powershell
# 1. Hacer cambios en backend/app.py o pdf_generator.py
# 2. Reiniciar el servidor Python:
Stop-Process -Name "python" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
cd backend
venv\Scripts\python.exe app.py
```

> 🛡️ La base de datos SQLite (`*.db`) NUNCA se toca manualmente. Todos los cambios van por los endpoints de la API.

---

### Agregar un Nuevo Colegio

Editar `data.js` — buscar la constante `INSTITUTIONS` y agregar el nuevo objeto:

```javascript
{ id: 9, name: "Nuevo Colegio ABC", icon: "N", color: "#234567" }
```

Luego subir versión de caché y hacer `firebase deploy`.

---

### Agregar un Nuevo Producto / Prenda

Editar `data.js` — buscar `PRODUCTS` y agregar al array correspondiente:

```javascript
{
  id: 99, name: "Nueva Prenda", category: "Uniformes",
  sizes: [
    { label: "T6", range: "2-6", unitPrice: 45000 },
    { label: "T8", range: "6-8", unitPrice: 48000 }
  ]
}
```

---

## 🚀 Despliegue a Firebase Hosting

### Primera vez

```powershell
# Instalar Firebase CLI (solo una vez)
npm install -g firebase-tools

# Login con la cuenta de Google
firebase login

# Verificar que el proyecto esté correcto
firebase projects:list

# Desplegar
cd "c:\Users\Dani\Desktop\ML PEDIDOS\ML-PEDIDOS"
firebase deploy --only hosting
```

### Actualizaciones posteriores

```powershell
cd "c:\Users\Dani\Desktop\ML PEDIDOS\ML-PEDIDOS"
firebase deploy --only hosting
```

> 💡 La URL de producción será algo como: `https://ml-uniformes-pos.web.app`

---

## ⚠️ Cambiar la URL del Backend

Cuando el backend Python se mueva de `localhost` a un servidor real (VPS, Render, Railway, etc.), actualizar **dos archivos**:

**`admin.js` línea 2:**

```javascript
// Antes (local):
const API = 'http://localhost:8000';

// Después (servidor propio):
const API = 'https://tu-servidor.com';
```

**`app.js` (buscar la constante API):**

```javascript
const API = 'https://tu-servidor.com';
```

Luego: subir versión de caché + `firebase deploy --only hosting`.

---

## 🔒 Reglas de Seguridad Firestore

Las reglas en `firestore.rules` garantizan que **solo el admin autenticado** puede leer o escribir datos. Para desplegarlas:

```powershell
firebase deploy --only firestore:rules
```

Para agregar otro admin, editar `firestore.rules` y agregar su email:

```javascript
function isAdmin() {
  return request.auth != null && (
    request.auth.token.email == 'dm6636267@gmail.com' ||
    request.auth.token.email == 'nuevo-admin@gmail.com'
  );
}
```

---

## 📋 Checklist de Actualización Segura

- [ ] Hacer respaldo de `*.db` antes de cambios grandes
- [ ] Incrementar versión de caché en HTML
- [ ] Probar en `localhost:3000` antes de desplegar
- [ ] Ejecutar `firebase deploy --only hosting`
- [ ] Verificar en la URL de producción (Ctrl+Shift+R para limpiar caché)
