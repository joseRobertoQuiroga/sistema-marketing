# 📋 PRUEBAS DE MÓDULOS — OmniPresence Suite
## Módulo 1: Analytics Hub | Módulo 3: Chatbot Multimodal

---

## 🚀 GUÍA DE CONFIGURACIÓN PASO A PASO

### PRE-REQUISITOS
```
Node.js >= 18 | PostgreSQL >= 14 | Redis >= 7 | Ollama (local)
```

### PASO 1 — Clonar variables de entorno
```bash
cd backend
cp .env.example .env
```
Editar `.env` con tus credenciales:
```env
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/omnipresence
REDIS_URL=redis://localhost:6379
TELEGRAM_TOKEN=         # Bot de Telegram (@BotFather)
ANTHROPIC_API_KEY=      # Alternativa a Ollama
META_APP_ID=            # developer.facebook.com
META_APP_SECRET=        # developer.facebook.com
TIKTOK_APP_ID=          # developers.tiktok.com
TIKTOK_APP_SECRET=      # developers.tiktok.com
LINKEDIN_CLIENT_ID=     # linkedin.com/developers
LINKEDIN_CLIENT_SECRET= # linkedin.com/developers
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_EMBED_URL=http://localhost:11434/api/embeddings
```

### PASO 2 — Instalar dependencias
```bash
cd backend && npm install
cd ../frontend && npm install
```

### PASO 3 — Inicializar la base de datos
```bash
# Conectar a PostgreSQL y ejecutar el esquema:
psql -U postgres -d omnipresence -f backend/db_init.sql
# O desde Node:
node backend/init_db.js
```

### PASO 4 — Levantar Redis (Docker recomendado)
```bash
docker run -d --name redis-omni -p 6379:6379 redis:alpine
```

### PASO 5 — Instalar y arrancar Ollama (Módulo 3 - Chatbot)
```bash
# Instalar desde https://ollama.ai
ollama pull mistral:instruct      # LLM para respuestas del bot
ollama pull nomic-embed-text      # Embeddings para RAG
```

### PASO 6 — Arrancar los servicios
```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```
✅ Backend disponible en `http://localhost:3000`
✅ Frontend disponible en `http://localhost:5173`

---

## 🧪 PRUEBAS UNITARIAS — MÓDULO 1 (Analytics Hub)

### TEST U1.1 — Endpoint `/api/analytics/overview` (sin filtros)
```bash
curl http://localhost:3000/api/analytics/overview
```
**Resultado esperado:**
```json
{
  "kpis": {
    "total_reach": 245000,
    "engagement_rate": 4.8,
    "leads_generated": 142,
    "cpl": 3.50,
    "total_spend": 497.00,
    "roas": 2.4
  },
  "evolution": [...],   // Array de 30 objetos con fecha, reach, conversions
  "top_posts": [...]    // Array de 3 posts
}
```
✅ PASS si el status es 200 y todos los campos de `kpis` están presentes.

---

### TEST U1.2 — Filtro por días
```bash
curl "http://localhost:3000/api/analytics/overview?days=7"
```
**Verificar:**
- `evolution` tiene exactamente **8 elementos** (0..7)
- `kpis.total_reach` ≈ `245000 × (7/30)` ≈ 57,166

✅ PASS si el array de evolución se encoge proporcionalmente.

---

### TEST U1.3 — Filtro por canal individual
```bash
curl "http://localhost:3000/api/analytics/overview?channel=instagram"
```
**Verificar:**
- `kpis.engagement_rate` = `4.8 × 1.2` = **5.76**
- `top_posts` solo contiene posts de plataforma `instagram`

✅ PASS si la tasa de engagement refleja la multiplicación de canal.

---

### TEST U1.4 — Endpoint `/api/analytics/channels`
```bash
curl http://localhost:3000/api/analytics/channels
```
**Resultado esperado:** Array con 3 objetos (instagram, facebook, tiktok) con campos: `platform`, `followers`, `growth_rate`, `reach`, `engagement_rate`.

✅ PASS si los 3 canales están presentes con todos sus campos.

---

### TEST U1.5 — Exportación CSV
```bash
curl -O "http://localhost:3000/api/analytics/export?format=csv&days=30"
# Debe descargar: analytics_report_30d.csv
```
**Verificar:**
- El archivo contiene encabezado: `Fecha,Alcance,Engagement Rate,Conversiones,Inversion`
- Mínimo 7 filas de datos

✅ PASS si el archivo CSV se descarga con el header correcto.

---

### TEST U1.6 — Gestión de canales (CRUD)
```bash
# Listar canales conectados
curl http://localhost:3000/api/channels

# Conectar un canal nuevo (modo fallback)
curl -X POST http://localhost:3000/api/channels/connect \
  -H "Content-Type: application/json" \
  -d '{"platform": "linkedin", "app_id": "test_123", "app_secret": "secret_abc"}'

# Desconectar (reemplazar :id con el ID obtenido en el POST)
curl -X DELETE http://localhost:3000/api/channels/:id
```
**Verificar:**
- `GET /` retorna canales con campo `expiry_warning` (boolean) y `days_until_expiry` (número)
- `POST /connect` retorna el nuevo canal con `id`, `status: "connected"`
- `DELETE /:id` retorna `{"success": true}`
- `POST /connect` con plataforma ya existente retorna status **400**

✅ PASS si todos los status HTTP son correctos.

---

### TEST U1.7 — OAuth Init sin credenciales configuradas
```bash
curl http://localhost:3000/api/channels/oauth/meta/init
```
**Resultado esperado (sin .env configurado):**
```json
{
  "error": "Credenciales no configuradas.",
  "message": "Agrega META_APP_ID..."
}
```
✅ PASS si retorna status **503** con el mensaje descriptivo.

---

### TEST U1.8 — Alerta de token por expirar
**Verificar en el frontend:**
1. Navegar a `Settings → Integraciones`
2. La tarjeta de `Facebook` (configurada a expirar en 3 días) debe mostrar badge amarillo `⚠️ Expira en 3d`
3. El sidebar debe mostrar un badge rojo `1` sobre `Integraciones`
4. Debe aparecer banner de advertencia en la parte superior de la vista

✅ PASS si los 4 indicadores visuales se muestran correctamente.

---

## 🧪 PRUEBAS UNITARIAS — MÓDULO 3 (Chatbot Multimodal)

### TEST U3.1 — Procesamiento de mensaje de texto básico
```bash
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "test-001", "text": "Hola, ¿qué productos tienen disponibles?", "platform": "telegram"}'
```
**Resultado esperado:**
```json
{
  "response_text": "¡Hola! ...",
  "intent_score": <número 0-100>,
  "confidence": <número 0.0-1.0>,
  "captured_data": {
    "kpi_category": "Consultas"
  }
}
```
✅ PASS si `response_text` no está vacío y `kpi_category` es uno de: `Consultas`, `Interés`, `Conversión`.

---

### TEST U3.2 — Clasificación KPI por intención de compra
```bash
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "test-002", "text": "Quiero comprar el vestido rojo, ¿cómo pago?", "platform": "telegram"}'
```
**Verificar:**
- `intent_score` > **70**
- `captured_data.kpi_category` = `"Conversión"` o `"Interés"`

✅ PASS si el score refleja alta intención de compra.

---

### TEST U3.3 — Recabado discreto de datos del usuario
```bash
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "test-003", "text": "Me llamo María, soy de Cochabamba y me interesan los vestidos", "platform": "telegram"}'
```
**Verificar que `captured_data` contenga:**
```json
{
  "nombre": "María",
  "localidad": "Cochabamba",
  "intereses": "vestidos",
  "kpi_category": "Interés"
}
```
✅ PASS si al menos 2 de los 3 campos personales fueron capturados.

---

### TEST U3.4 — Pausa del bot (Toma de control por admin)
```bash
# 1. Pausar el bot para una conversación
curl -X POST http://localhost:3000/api/conversations/test-004/take-control

# 2. Enviar mensaje mientras está pausado
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "test-004", "text": "Quiero saber más", "platform": "telegram"}'
```
**Verificar:**
- El endpoint de pausa retorna `{"success": true, "message": "Bot pausado"}`
- El mensaje enviado mientras el bot está pausado NO genera respuesta automática (el body de respuesta es null o vacío)

✅ PASS si el bot respeta el estado de pausa.

---

### TEST U3.5 — Respuesta de admin manual
```bash
# (Con bot pausado desde TEST U3.4)
curl -X POST http://localhost:3000/api/conversations/test-004/reply \
  -H "Content-Type: application/json" \
  -d '{"text": "¡Claro! Soy el agente de ventas, con gusto te ayudo."}'
```
**Verificar:**
- Respuesta: `{"success": true, "message": "Mensaje enviado"}`
- El mensaje aparece en la UI con badge `AGENT (YOU)` en color verde

✅ PASS si el mensaje de admin se registra y emite por WebSocket.

---

### TEST U3.6 — Historial de conversación (Context Window)
```bash
# Enviar 3 mensajes seguidos en la misma conversación
for i in 1 2 3; do
  curl -X POST http://localhost:3000/api/message \
    -H "Content-Type: application/json" \
    -d "{\"conversationId\": \"test-005\", \"text\": \"Mensaje $i\", \"platform\": \"telegram\"}"
done

# Verificar que el 4to mensaje referencia el historial
curl -X POST http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "test-005", "text": "¿Recuerdas lo que te dije antes?", "platform": "telegram"}'
```
✅ PASS si la respuesta demuestra contexto de mensajes anteriores.

---

### TEST U3.7 — Endpoint de conversaciones activas
```bash
curl http://localhost:3000/api/conversations
```
**Verificar:**
- Devuelve un array de conversaciones con campos: `id`, `name`, `lastMsg`, `status`, `score`
- Las conversaciones de los tests anteriores aparecen en la lista

✅ PASS si las conversaciones creadas en los tests anteriores están listadas.

---

## 🖥️ PRUEBAS DE USUARIO (End-to-End Manual)

### PU1 — Flujo completo del Analytics Hub
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Abrir `http://localhost:5173` | La app carga sin errores en consola |
| 2 | Clic en `Analytics Hub` (sidebar) | Se renderiza el dashboard con 4 tarjetas KPI |
| 3 | Cambiar filtro a `Últimos 7 días` | La gráfica se encoge a 8 puntos de datos |
| 4 | Cambiar canal a `Instagram` | `Engagement Rate` sube a ~5.7% |
| 5 | Clic en `Exportar CSV` | Se descarga un archivo `.csv` válido |
| 6 | Verificar alertas (banner rojo y verde) | Ambos banners visibles en la UI |
| 7 | Navegar a `Ajustes → Integraciones` | Se ven 3 tarjetas de plataformas |
| 8 | Badge amarillo `⚠️ Expira en 3d` en Facebook | Visible en la tarjeta de Facebook |
| 9 | Clic en `Conectar` en TikTok | Se abre el modal con campos `App ID` y `App Secret` |
| 10 | Ingresar datos ficticios y confirmar | La tarjeta muestra badge verde `Activo` |
| 11 | Clic en `Desconectar` | La tarjeta vuelve al estado desconectado |

---

### PU2 — Flujo completo del Chatbot (Módulo 3)
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Clic en `AI Bot Engine` (sidebar) | Se carga la vista de conversaciones |
| 2 | Seleccionar un hilo activo de la lista | Se carga el historial de mensajes del lado derecho |
| 3 | Verificar badge de `AI Bot Active` | Indicador verde parpadeante visible |
| 4 | Panel lateral derecho muestra `Intent Score` | Barra de progreso con el score del lead |
| 5 | Panel lateral derecho muestra `Captured Data` | Campos de localidad, intereses visibles |
| 6 | Clic en `Take Control` | El badge cambia a naranja `Manual Override` |
| 7 | Escribir un mensaje en el campo de texto | El campo aparece con borde naranja |
| 8 | Enviar el mensaje | Aparece en el chat con badge `AGENT (YOU)` |
| 9 | El bot NO responde automáticamente | Confirmado: el bot está pausado |

---

## 📊 RESUMEN DE ESTADO POR MÓDULO

### Módulo 1 — Analytics Hub
| Función | Implementado | Probado | Producción-Ready |
|---------|:-----------:|:-------:|:----------------:|
| KPIs Overview | ✅ | 🔄 | Mock |
| Gráfica de Evolución | ✅ | 🔄 | Mock |
| Filtro por días | ✅ | 🔄 | Mock |
| Filtro por canal | ✅ | 🔄 | Mock |
| Desglose por canal | ✅ | 🔄 | Mock |
| Top Posts Table | ✅ | 🔄 | Mock |
| Exportación CSV | ✅ | 🔄 | Mock |
| Panel de Alertas | ✅ | 🔄 | Mock |
| OAuth Meta | ✅ | ⏳ | Requiere App ID |
| OAuth TikTok | ✅ | ⏳ | Requiere App ID |
| OAuth LinkedIn | ✅ | ⏳ | Requiere App ID |
| BullMQ Worker | ✅ | ⏳ | Requiere Redis |
| DB Real (PostgreSQL) | ✅ Esquema | ⏳ | Requiere DB |

### Módulo 3 — Chatbot Multimodal
| Función | Implementado | Probado | Producción-Ready |
|---------|:-----------:|:-------:|:----------------:|
| Procesamiento texto | ✅ | 🔄 | Requiere Ollama |
| RAG / Knowledge Base | ✅ | 🔄 | Requiere Ollama |
| Captura datos usuario | ✅ | 🔄 | Requiere Ollama |
| Clasificación KPIs | ✅ | 🔄 | Requiere Ollama |
| Pausa del bot | ✅ | 🔄 | ✅ |
| Respuesta de admin | ✅ | 🔄 | ✅ |
| WebSocket en tiempo real | ✅ | 🔄 | ✅ |
| Transcripción de audio | ✅ | ⏳ | Requiere Whisper |
| Análisis de imágenes | ✅ | ⏳ | Requiere Qwen-VL |
| Telegram Bot | ✅ | ⏳ | Requiere TOKEN |

**Leyenda:** ✅ Listo | 🔄 Validar al ejecutar | ⏳ Pendiente de configuración externa

---

## 🔧 COMANDOS RÁPIDOS DE TESTING

```bash
# Ejecutar suite de pruebas Jest (unitarias)
cd backend && npm test

# Prueba rápida del bot (script incluido)
node backend/test_bot.js

# Health check general del backend
curl http://localhost:3000/health

# Verificar conexión con Ollama
curl http://localhost:11434/api/tags

# Verificar conexión con Redis
redis-cli ping   # Debe responder: PONG
```

---

## ⚙️ PASOS PARA ACTIVAR DATOS REALES

### Meta (Facebook & Instagram)
1. Ir a `https://developers.facebook.com` → Crear App → Tipo: Negocios
2. Agregar productos: **Instagram Basic Display** + **Instagram Graph API** + **Pages API**
3. Copiar `App ID` y `App Secret` al `.env`
4. En Settings → App Review: solicitar permisos `pages_show_list`, `instagram_manage_insights`
5. Con servidor activo: `GET http://localhost:3000/api/channels/oauth/meta/init` → redirige a Meta

### TikTok Business
1. Ir a `https://developers.tiktok.com` → Crear App
2. Activar los scopes: `user.info.basic`, `video.list`
3. Copiar credenciales al `.env`

### Redis + BullMQ (Workers automáticos)
1. `docker run -d -p 6379:6379 redis:alpine`
2. Reiniciar el backend → verás en consola: `[BullMQ] 🕒 Cronjob de métricas registrado (cada 4 hrs + startup sync)`

### Telegram Bot
1. Hablar con `@BotFather` en Telegram → `/newbot`
2. Copiar el TOKEN al `.env` como `TELEGRAM_TOKEN`
3. Reiniciar el backend → el bot comienza a escuchar mensajes

---

*Documento generado: 2026-05-08 | OmniPresence Suite v1.0*
