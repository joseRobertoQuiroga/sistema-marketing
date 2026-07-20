# Análisis Técnico del Sistema — OmniPresence Suite

## Visión General del Proyecto

**OmniPresence Suite** es un SaaS multi-tenant de marketing automation enfocado en PYMEs hispanohablantes. Su propuesta de valor es reemplazar 4-7 herramientas dispersas (Meta Business Suite, TikTok Analytics, Canva, chatbot, Excel de leads) en un único panel con 3 módulos integrados:

| Módulo | Función | Estado Actual |
|--------|---------|---------------|
| **M1 · Analytics Hub** | Métricas unificadas de redes sociales | **No implementado** — solo mockups HTML |
| **M2 · Content Hub** | Publicación centralizada de contenido | **No implementado** — solo mockups HTML |
| **M3 · AI Bot & Lead Engine** | Bot IA multimodal + clasificación de leads | **MVP funcional** (solo Telegram) |

---

## 1. Stack Tecnológico Actual vs Planeado

| Capa | Planeado (SKILL_03) | Implementado | Brecha |
|------|---------------------|--------------|--------|
| **Frontend** | Next.js 14 App Router + TanStack Query + Zustand | React 19 + Vite 8 SPA (App.jsx monolítico) | Sin routing, sin SSR, sin estado global |
| **Backend** | NestJS con Drizzle ORM | Node.js + Express plano con `pg` raw | Sin ORM, sin estructura modular |
| **Base de Datos** | PostgreSQL + Drizzle schema completo + RLS | PostgreSQL + pgvector + raw SQL | Sin RLS (multi-tenancy inseguro), sin soft deletes completo |
| **Auth** | JWT + refresh token + MFA + onboarding 4 pasos | **Inexistente** — org ID hardcodeado | Sin seguridad, sin autenticación |
| **LLM** | Anthropic Claude (cloud) | Ollama + Mistral (local) | Diferente proveedor, OK para MVP |
| **Embeddings** | Voyage AI / OpenAI | nomic-embed-text via Ollama (local) | Diferente, OK para MVP |
| **Audio** | — | Whisper.cpp (local) | Implementado |
| **Visión** | — | Qwen-VL via vLLM (cloud GPU) | Implementado |
| **Cola de Trabajos** | BullMQ | BullMQ con Redis | Implementado |
| **Tiempo Real** | SSE (Server-Sent Events) | Socket.IO (WebSockets) | Diferente implementación |
| **Pagos** | Stripe con planes Free/Pro/Business/Agency | **Inexistente** | Sin monetización |
| **Infra** | CI/CD con GitHub Actions | Docker Compose | Solo dockerización |

---

## 2. Estado por Módulo vs Objetivos

### M3 — AI Bot & Lead Engine (MVP Funcional)

| Feature | Objetivo (SKILL_03) | Estado Actual | % |
|---------|--------------------|---------------|---|
| Bot conversacional IA | Responder en Instagram DMs + Facebook Messenger | Solo Telegram (polling) | 30% |
| RAG con knowledge base | Chunking CSV/PDF → embeddings → pgvector | Texto + seed manual, sin pipeline de upload | 50% |
| Clasificación de intención | Intent scoring + signals + recommended_action | Intent score 0-100 + KPI categories | 70% |
| Captura de datos del lead | Nombre, ubicación, intereses | Implementado en captured_data JSONB | 80% |
| Pipeline multimodal | Texto + Audio + Imagen | Texto funcional, Audio funcional, Visión funcional | 90% |
| Inbox unificado | Conversaciones + filtros + badges | Dashboard 3 columnas básico funcional | 60% |
| Escalado a humano | Bot pause + admin reply + notificación | Bot pause + reply admin con Socket.IO | 75% |
| Plataforma única o multi | Multi-plataforma (WhatsApp, IG, FB, TikTok) | Solo Telegram + PlatformManager pattern | 25% |
| Tabla de Leads CRM | Tabla independiente con upsert por umbral | **No existe** — datos embebidos en messages | 0% |
| Kanban de leads | Frío/Tibio/Caliente/Convertido/Perdido | **No implementado** | 0% |
| Alertas de leads calientes | Notificación push/email por threshold | **No implementado** | 0% |
| Configuración del bot | Tono, canales, mensaje de escalado | BotConfigs tabla, hardcodeado en test | 40% |

### M1 — Analytics Hub (No Implementado)

| Feature | Estado |
|---------|--------|
| OAuth Facebook + Instagram | **No implementado** |
| Ingesta de métricas cada 4h | **No implementado** |
| Dashboard KPIs (alcance, engagement, leads) | **No implementado** — solo mockup HTML |
| Exportación PDF/Excel | **No implementado** |
| Gráficas de evolución temporal | **No implementado** |

### M2 — Content Hub (No Implementado)

| Feature | Estado |
|---------|--------|
| Upload de assets con validación | **No implementado** |
| Procesamiento Sharp (variantes) | **No implementado** |
| Scheduler + calendario visual | **No implementado** |
| Publicación directa API | **No implementado** |
| Biblioteca de assets | **No implementado** |

---

## 3. Base de Datos — Estado vs Objetivo

### Tablas Actuales (7 tablas, implementadas)
- ✅ `organizations` — pero sin `billing_email`, `settings`, `slug`
- ✅ `knowledge_chunks` — con pgvector(768), soft delete, metadata
- ✅ `products` — catálogo de productos
- ✅ `product_sets` + `product_set_items` — conjuntos/outfits
- ✅ `messages` — con intent_score + captured_data + metadata
- ✅ `bot_configs` — configuración por organización

### Tablas Faltantes vs SKILL_02/SKILL_03
- ❌ `social_connections` — OAuth tokens para redes sociales
- ❌ `leads` — tabla CRM independiente (upsert desde messages)
- ❌ `memberships` — roles y permisos (owner/admin/member/viewer)
- ❌ `audit_events` — log inmutable de acciones
- ❌ `alerts` — notificaciones del sistema
- ❌ `post_assets` / `posts` / `post_accounts` — content hub
- ❌ `account_metrics` / `post_metrics` — analytics
- ❌ `subscriptions` / `invoices` — billing Stripe

### Brechas de Seguridad
- ❌ **Sin RLS (Row Level Security)** — las queries no filtran por organización automáticamente
- ❌ **Org ID hardcodeado** — `369344ae-f39e-4eaa-a684-4e63c5a3a48a` en `index.js`
- ❌ **Sin JWTs** — cero autenticación en endpoints
- ❌ **Sin cifrado de tokens OAuth** — SKILL_01 lo requiere pero no hay tokens que cifrar aún
- ❌ **CORS abierto** — `origin: "*"` en producción

---

## 4. APIs REST — Estado vs Objetivo

De los ~30 endpoints definidos en SKILL_03, solo existen 5:

| Endpoint | SKILL_03 | Estado | Notas |
|----------|----------|--------|-------|
| `GET /api/conversations` | `GET /inbox` | ✅ Funcional | Sin filtros, sin paginación |
| `GET /api/conversations/:id/messages` | `GET /inbox/:id` | ✅ Funcional | Sin paginación |
| `POST /api/conversations/:id/reply` | `POST /inbox/:id/message` | ✅ Funcional | Hardcodea orgId |
| `POST /api/conversations/:id/take-control` | `PATCH /inbox/:id/handoff` | ✅ Funcional | Básico |
| `GET /api/products` | — | ✅ Funcional | Para TrainingHub |
| `POST /webhook` | — | ⚠️ Funcional | Solo para pruebas, sin HMAC |
| Todos los de auth | `POST /auth/*` | ❌ **No existen** | — |
| Todos los de analytics | `GET /analytics/*` | ❌ **No existen** | — |
| Todos los de content | `POST /assets/*`, `GET /posts/*` | ❌ **No existen** | — |
| Todos los de leads | `GET /leads/*` | ❌ **No existen** | — |
| Todos los de channels | `GET /channels/*` | ❌ **No existen** | — |

---

## 5. Frontend — Estado vs Objetivo

| Aspecto | Planeado (Next.js App Router) | Actual (Vite + React SPA) |
|---------|------------------------------|--------------------------|
| **Routing** | `app/(dashboard)/analytics`, `/inbox`, `/leads`, etc. | **Sin routing** — todo en App.jsx con estado `currentScreen` |
| **Autenticación** | `(auth)/login`, `register`, `onboarding` | **Sin auth** — sin login, sin onboarding |
| **Analytics Dashboard** | KPIs, gráficas, tabla top posts | **No existe** |
| **Content Hub** | Upload, variantes, scheduler, calendario | **No existe** |
| **AI Bot Engine** | Inbox, leads kanban, config | Panel 3 columnas funcional |
| **Training Hub** | Knowledge base management | Panel básico de productos + conjuntos |
| **Estado** | TanStack Query + Zustand | `useState` + `useEffect` directo |
| **Forms** | React Hook Form + Zod | Inputs controlados manualmente |
| **Tiempo Real** | SSE | Socket.IO (funcional) |

---

## 6. Roadmap Original vs Realidad

| Fase | Planeado | Realidad |
|------|----------|----------|
| **Fase 1: Fundación** (semanas 1-8) | Auth, Onboarding, OAuth, Analytics MVP, Docker | ✅ Docker | ⚠️ Parcial: no hay auth, no hay analytics |
| **Fase 2: Contenido** (semanas 9-16) | Upload assets, Sharp, scheduler, publicación | ❌ No iniciado |
| **Fase 3: Bot IA** (semanas 17-24) | KB upload, RAG, bot IG/FB, inbox, scoring, kanban, alerts | ⚠️ Parcial: RAG sí, pero solo Telegram, sin kanban, sin alerts |
| **Fase 4: Crecimiento** (semanas 25-32) | WhatsApp API, lead flows, white-label, API pública, Stripe, landing | ❌ No iniciado |

**Conclusión:** El proyecto avanzó directamente a Fase 3 (Bot IA) sin completar Fase 1 ni Fase 2, y el bot solo corre sobre Telegram (no IG/FB como especifica el roadmap).

---

## 7. Pendientes Inmediatos Identificados

### Críticos (Seguridad y Arquitectura)
1. **Multi-tenancy real** — Reemplazar orgId hardcodeado por JWT + middleware de tenant isolation
2. **Autenticación completa** — Sistema de auth con login, registro, refresh tokens
3. **CORS restrictivo** — Configurar orígenes permitidos en producción
4. **Webhook security** — Implementar HMAC verification para Meta webhooks

### Funcionales (Alto Impacto)
5. **Tabla `leads` independiente** — Crear tabla CRM + upsert automático desde messages cuando intent_score > umbral
6. **WhatsApp Business API** — Segunda plataforma (la de mayor adopción en Latam)
7. **Pipeline de upload de knowledge base** — Subida de CSV/PDF con chunking automático
8. **Alertas de leads calientes** — Notificación cuando intent_score >= threshold configurable

### Frontend (Deuda Técnica)
9. **Routing** — Migrar de estado booleano a React Router para navegación real
10. **Módulos Analytics Hub y Content Hub** — Implementar desde mockups existentes
11. **Estado global** — Introducir Zustand o contexto para evitar prop drilling
12. **Kanban de leads** — Vista drag & drop con columnas Frío/Tibio/Caliente/Convertido

### DevOps
13. **Variables de entorno** — Validar que todas las env vars están documentadas y con defaults seguros
14. **Tests** — Solo hay 3 test files (suite.test.js, rag.test.js, security.test.js), cobertura insuficiente
15. **CI/CD** — No hay pipeline de integración continua

---

## 8. Deuda Técnica Actual

| Archivo | Problema | Impacto |
|---------|----------|---------|
| `backend/index.js` | Lógica de Telegram polling + endpoints API + workers todo en un archivo | Baja mantenibilidad |
| `backend/logic.js` | Lógica de negocio + DB + llamadas a IA todo en un archivo | Difícil de testear |
| `frontend/src/App.jsx` | 478 líneas, sin división en componentes, sin routing | Ilegible, difícil de escalar |
| `backend/queues/botWorker.js` | Dependencia directa de `logic.js` (acoplamiento fuerte) | Dificulta cambios |
| Estructura general | Backend plano sin carpetas `routes/`, `controllers/`, `services/` | Sin separación de responsabilidades |

---

## 9. Resumen Ejecutivo

**Fortalezas del sistema actual:**
- Bot IA multimodal funcional (texto + audio + imagen) con RAG y Ollama local
- Dashboard en tiempo real con Socket.IO
- PlatformManager como abstracción multi-plataforma (preparado para escalar)
- Docker Compose listo para deployment
- Pipeline BullMQ para procesamiento async
- Seed data funcional para pruebas

**Debilidades críticas:**
- Sin autenticación ni multi-tenancy real (riesgo de seguridad #1)
- Solo Telegram implementado (el objetivo es IG/FB/WhatsApp)
- Sin tabla CRM de leads (los datos están embebidos en messages)
- Frontend monolítico (478 líneas en App.jsx)
- Analytics Hub y Content Hub no existen
- Sin sistema de alertas
- Sin onboarding de organización
- Sin billing/monetización

**Prioridad recomendada:**
1. **Seguridad:** Auth + multi-tenancy + orgId dinámico
2. **CRM:** Tabla leads independiente con upsert
3. **Omnicanal:** WhatsApp Business API + webhook Meta
4. **Deuda técnica:** Refactor backend en capas + frontend en componentes con routing
5. **Módulos faltantes:** Analytics Hub desde mockups existentes, luego Content Hub
6. **Monetización:** Stripe + plan limiter cuando haya features que limitar
