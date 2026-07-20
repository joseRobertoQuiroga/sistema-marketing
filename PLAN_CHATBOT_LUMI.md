# PLAN MAESTRO — Módulo Chatbot IA Multimodal + Lumi

> **Sistema:** OmniPresence — Plataforma de Marketing Multimodal
> **Stack:** FastAPI + Next.js 14+ + PostgreSQL/pgvector + LangChain
> **IA:** NVIDIA NIM (free tier) + Groq (free) + Gemini (free)
> **Arquitectura:** Clean Architecture + SOLID + Plugin-based Providers

---

## ÍNDICE

1. [RESUMEN EJECUTIVO](#1-resumen-ejecutivo)
2. [VISIÓN Y OBJETIVOS](#2-visión-y-objetivos)
3. [ARQUITECTURA GENERAL](#3-arquitectura-general)
4. [MÓDULO CHATBOT MULTIMODAL](#4-módulo-chatbot-multimodal)
5. [MÓDULO LUMI — ASISTENTE IA COMERCIAL](#5-módulo-lumi)
6. [STACK TECNOLÓGICO](#6-stack-tecnológico)
7. [APIs DE IA GRATUITAS](#7-apis-de-ia-gratuitas)
8. [ROADMAP DE DESARROLLO](#8-roadmap-de-desarrollo)
9. [ESTRUCTURA DE DIRECTORIOS](#9-estructura-de-directorios)
10. [FLUJOS CLAVE](#10-flujos-clave)
11. [MÉTRICAS Y MONITOREO](#11-métricas-y-monitoreo)
12. [PRÓXIMOS PASOS](#12-próximos-pasos)

---

## 1. RESUMEN EJECUTIVO

### 1.1 El Problema
El sistema OmniPresence actual tiene un chatbot básico (procesa mensajes, responde con IA vía Ollama, RAG limitado). No soporta:
- Múltiples plataformas (Telegram, WhatsApp, Messenger, TikTok) con arquitectura plugin
- Campañas de mensajes masivos
- Almacenamiento estructurado de todos los flujos para análisis
- Modo "campaña" con disparo automático de mensajes
- Entrenamiento continuo con datos de la base de datos
- Multi-tenencia real con aislamiento por negocio/tienda

### 1.2 La Solución
Desarrollar dos módulos hermanos con Clean Architecture + SOLID:

**Módulo 1: Chatbot IA Multimodal** — Sistema de chatbot plugueable con capacidad de atender múltiples negocios, con modo campaña, RAG entrenable, y almacenamiento completo de trazas.

**Módulo 2: Lumi** — Asistente IA para e-commerce (inspirado en Tiendanube Lumi) que analiza datos de negocio, genera contenido, ejecuta acciones y provee inteligencia de negocio.

### 1.3 Beneficios Clave
- ✅ Multi-plataforma desde el día 1 (arquitectura plugin)
- ✅ Multi-tenencia real (cada negocio con su propio contexto RAG)
- ✅ Modo campaña para comunicación masiva programada
- ✅ Trazabilidad completa de cada interacción
- ✅ APIs de IA gratuitas (NVIDIA NIM, Groq, Gemini) — sin costo operativo inicial
- ✅ Entrenamiento RAG continuo desde la base de datos

---

## 2. VISIÓN Y OBJETIVOS

### 2.1 Visión General
Construir el asistente inteligente omnicanal definitivo para negocios digitales: un chatbot multimodal que entiende, aprende y actúa a través de cualquier plataforma de mensajería, mientras un asistente gemelo (Lumi) provee inteligencia de negocio profunda.

### 2.2 Objetivos Estratégicos

| # | Objetivo | KPI | Prioridad |
|---|----------|-----|-----------|
| O1 | Soporte multi-plataforma plugin | ≥4 plataformas en MVP | 🔴 Alta |
| O2 | Multi-tenencia real | Aislamiento completo por orgId | 🔴 Alta |
| O3 | Modo campaña masiva | Programación + ejecución + reportes | 🔴 Alta |
| O4 | RAG entrenable desde DB | Actualización dinámica de vectores | 🔴 Alta |
| O5 | Almacenamiento de trazas | Cada interacción, decisión, métrica | 🟡 Alta |
| O6 | Dashboard de rendimiento | Tiempo respuesta, satisfacción, conversión | 🟡 Media |
| O7 | Lumi — Análisis de negocio | Consultas NL sobre ventas, productos, clientes | 🟡 Media |
| O8 | Lumi — Acciones automáticas | Generar descripciones, calcular envíos, etc. | 🟢 Baja |

### 2.3 Principios de Diseño

1. **SOLID en cada capa** — SRP, OCP, LSP, ISP, DIP
2. **Clean Architecture** — Dependencias hacia adentro (Domain → Application → Infrastructure)
3. **Plugin First** — Cada plataforma es un plugin que implementa una interfaz
4. **Fail Gracefully** — Si un proveedor IA falla, se intenta el siguiente
5. **Trazabilidad Total** — Cada mensaje, decisión, error queda registrado
6. **Multi-tenant nativo** — Aislamiento por organización en todas las capas

---

## 3. ARQUITECTURA GENERAL

### 3.1 Diagrama de Alto Nivel

```
┌────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js 14+)                       │
│  ┌─────────────┐  ┌────────────────┐  ┌───────────────────────────┐   │
│  │ Chat Widget  │  │ Dashboard IA   │  │ Panel Lumi (Analytics)    │   │
│  │ (Embejable)  │  │ Campañas/Flujos│  │ Consultas NL + Acciones   │   │
│  └──────┬──────┘  └───────┬────────┘  └───────────┬───────────────┘   │
└─────────┼──────────────────┼──────────────────────┼────────────────────┘
          │                  │                      │
          │           REST API + WebSocket           │
          │                  │                      │
┌─────────┼──────────────────┼──────────────────────┼────────────────────┐
│         ▼                  ▼                      ▼                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    API GATEWAY (FastAPI)                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │   │
│  │  │ Chat     │ │ Campaign │ │ Lumi     │ │ Webhook Receiver │   │   │
│  │  │ Router   │ │ Router   │ │ Router   │ │ (Telegram/Meta)  │   │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │   │
│  └───────┼────────────┼────────────┼────────────────┼─────────────┘   │
│          │            │            │                │                  │
│  ┌───────┴────────────┴────────────┴────────────────┴─────────────┐   │
│  │                   APPLICATION LAYER                             │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────┐  │   │
│  │  │ Chat       │ │ Campaign   │ │ RAG        │ │ Lumi        │  │   │
│  │  │ UseCase    │ │ UseCase    │ │ UseCase    │ │ UseCase     │  │   │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬──────┘  │   │
│  └────────┼──────────────┼──────────────┼───────────────┼─────────┘   │
│           │              │              │               │             │
│  ┌────────┴──────────────┴──────────────┴───────────────┴─────────┐   │
│  │                   DOMAIN LAYER                                  │   │
│  │  Entities: Message, Campaign, Conversation, Lead, Org, Product │   │
│  │  Ports: IMessageRepo, ICampaignRepo, IAIProvider, IPlatform... │   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
│                             │                                          │
│  ┌──────────────────────────┴──────────────────────────────────────┐   │
│  │                INFRASTRUCTURE LAYER                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │   │
│  │  │PostgreSQL │ │ Redis    │ │ AI       │ │ Platform         │   │   │
│  │  │ Repos    │ │ Queue    │ │Providers │ │ Adapters         │   │   │
│  │  │ pgvector │ │ BullMQ   │ │ NVIDIA   │ │ Telegram/TikTok  │   │   │
│  │  │          │ │          │ │ Groq     │ │ WhatsApp/Meta    │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  Servicios Externos:                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ NVIDIA   │ │ Groq     │ │ Gemini   │ │ Telegram │                 │
│  │ NIM API  │ │ API      │ │ API      │ │ Bot API  │                 │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐                      │
│  │ WhatsApp │ │Messenger │ │ TikTok           │                      │
│  │ Cloud API│ │ Graph API│ │ Messaging API    │                      │
│  └──────────┘ └──────────┘ └──────────────────┘                      │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Principios SOLID Aplicados

| Principio | Aplicación |
|-----------|-----------|
| **SRP** (Single Responsibility) | Cada UseCase hace UNA cosa. Cada Controller maneja UN tipo de request. Cada Repository persiste UNA entidad. |
| **OCP** (Open/Closed) | Nuevas plataformas = nuevo plugin que implementa `IPlatformAdapter`. Nuevos proveedores IA = nuevo `IAIProvider`. Sin modificar código existente. |
| **LSP** (Liskov Substitution) | Cualquier `IPlatformAdapter` (Telegram, WhatsApp, TikTok) puede reemplazar a otro sin cambiar el UseCase. |
| **ISP** (Interface Segregation) | Interfaces pequeñas: `IMessageSender`, `IMessageReceiver`, `IFileUploader`. No una interfaz gigante "Plataforma". |
| **DIP** (Dependency Inversion) | UseCases dependen de interfaces (ports), no de implementaciones concretas. DI wirea todo en `main.py`. |

### 3.3 Clean Architecture — Capas

```
┌───────────────────────────────────────────────────┐
│  domain/       → Entidades + Puertos (interfaces) │  ← NO depende de nada externo
├───────────────────────────────────────────────────┤
│  application/  → Use cases (orquestan lógica)     │  ← Depende solo de domain/
├───────────────────────────────────────────────────┤
│  infrastructure/ → Repos, AI Providers, Adapters  │  ← Implementa ports de domain/
├───────────────────────────────────────────────────┤
│  api/          → Controllers, Routes, Middleware   │  ← Depende de application/
├───────────────────────────────────────────────────┤
│  main.py       → DI Wiring, Server start          │  ← Conecta todo
└───────────────────────────────────────────────────┘
```

---

## 4. MÓDULO CHATBOT MULTIMODAL

### 4.1 Funcionalidades por Nivel

#### 🟢 Nivel 1: Fundación (MVP — Semana 1-2)
| Funcionalidad | Descripción |
|---------------|-------------|
| Chat receptivo multi-plataforma | Recibir mensajes de Telegram, WhatsApp, Messenger, TikTok |
| Respuesta automática con IA | Usar NVIDIA NIM / Groq para generar respuestas contextuales |
| RAG básico | Consultar pgvector con embeddings de productos/conocimiento |
| Multi-tenencia | Cada organización con su propio vector store y contexto |
| Almacenamiento de conversaciones | Guardar cada mensaje con metadatos (plataforma, orgId, timestamp) |

#### 🟡 Nivel 2: Inteligencia (Semana 3-4)
| Funcionalidad | Descripción |
|---------------|-------------|
| RAG entrenable desde DB | Sincronización periódica de productos, leads, knowledge_chunks a pgvector |
| Clasificación de intención | Detectar si es consulta, compra, queja, o derivar a humano |
| Captura de datos estructurados | Extraer nombre, email, teléfono, producto de interés de la conversación |
| Derivación a humano (escalation) | Si la IA no puede resolver, pasar a agente humano con contexto completo |
| Multi-idioma automático | Detectar idioma del mensaje y responder en el mismo |

#### 🔴 Nivel 3: Campañas (Semana 5-6)
| Funcionalidad | Descripción |
|---------------|-------------|
| Modo campaña | Crear secuencias de mensajes programados |
| Segmentación de audiencia | Filtrar leads por estado, producto, fecha, comportamiento |
| Disparo automático | Enviar campaña en fecha/hora programada |
| Plantillas de mensajes | Reutilizar plantillas con variables dinámicas |
| Reportes de campaña | Tasa de apertura, clics, conversiones, rebotes |

#### ⚫ Nivel 4: Omnicanalidad Avanzada (Semana 7-8)
| Funcionalidad | Descripción |
|---------------|-------------|
|Respuestas multimedia | Enviar imágenes, videos, documentos, botones interactivos |
| Webhook saliente | Notificar a sistemas externos sobre eventos del chatbot |
| Modo agente híbrido | IA primero, si no resuelve → humano con transferencia de contexto |
| Analytics de conversaciones | Dashboard con métricas de todas las plataformas |
| Exportación de datos | Exportar conversaciones, leads, campañas a CSV/PDF |

### 4.2 Arquitectura de Plugins de Plataforma

```
┌─────────────────────────────────────────────────────────────────────┐
│                      IPlatformAdapter (port)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  sendMessage(conversationId, content, options) → Result    │   │
│  │  sendMedia(conversationId, mediaUrl, type, options) → Res  │   │
│  │  sendButton(conversationId, text, buttons) → Result        │   │
│  │  markRead(conversationId) → Result                         │   │
│  │  getPlatformName() → str                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
         ▲              ▲              ▲              ▲
         │              │              │              │
┌────────┴──┐   ┌───────┴──────┐ ┌────┴────┐  ┌─────┴──────┐
│ Telegram  │   │ WhatsApp     │ │Messenger │  │ TikTok     │
│ Adapter   │   │ Adapter      │ │Adapter   │  │ Adapter    │
├───────────┤   ├──────────────┤ ├─────────┤  ├────────────┤
│ Telegraf  │   │ Meta Cloud   │ │ Graph    │  │ TikTok    │
│ Library   │   │ API HTTP     │ │ API HTTP │  │ API HTTP  │
└───────────┘   └──────────────┘ └─────────┘  └────────────┘
```

### 4.3 Flujo de Procesamiento de Mensajes

```
Usuario envía mensaje
        │
        ▼
┌──────────────────┐
│ Webhook Receiver │  ← Recibe de Telegram/WhatsApp/Messenger/TikTok
│ (API Layer)      │     Normaliza a formato interno
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ ProcessMessage   │  ← UseCase: orquesta todo el flujo
│ UseCase          │
└────────┬─────────┘
         │
    ┌────┴────┬──────────┬─────────────┬─────────────┐
    │         │          │             │             │
    ▼         ▼          ▼             ▼             ▼
┌────────┐ ┌──────┐ ┌────────┐ ┌───────────┐ ┌──────────┐
│Classify│ │ RAG  │ │Generate│ │ Extract   │ │ Store    │
│Intent  │ │Retr. │ │Response│ │Structured │ │ Message  │
│UseCase │ │UseCase│ │UseCase │ │Data UseCase│ │(Repo)   │
└────────┘ └──────┘ └────────┘ └───────────┘ └──────────┘
    │         │         │            │             │
    └─────────┴─────────┴────────────┴─────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ Send Response    │  ← IPlatformAdapter.sendMessage()
              │ (Platform)       │
              └──────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ Emit Event       │  ← Socket.IO (notificar dashboard)
              │ (WebSocket)      │
              └──────────────────┘
```

### 4.4 Modo Campaña — Arquitectura

```
┌───────────────────────────────────────────────────────────────┐
│                    CAMPAIGN ENGINE                             │
├───────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ Campaign     │  │ Audience     │  │ Message           │    │
│  │ Repository   │  │ Segmenter    │  │ Template Engine   │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘    │
│         │                 │                    │              │
│  ┌──────┴─────────────────┴────────────────────┴─────────┐   │
│  │              Campaign Scheduler (Redis Queue)          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Send     │  │ Track    │  │ Retry    │            │   │
│  │  │ Worker   │  │ Worker   │  │ Worker   │            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  └───────┼─────────────┼──────────────┼──────────────────┘   │
│          │             │              │                       │
│          ▼             ▼              ▼                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐           │
│  │Platform  │  │ Analytics│  │ Error Recovery   │           │
│  │Adapters  │  │ Store    │  │ DLQ (Dead Letter)│           │
│  └──────────┘  └──────────┘  └──────────────────┘           │
└───────────────────────────────────────────────────────────────┘

Flujo de creación de campaña:
1. Usuario crea campaña → define segmento + plantilla + schedule
2. Campaign Scheduler programa en Redis (BullMQ)
3. En la fecha/hora, Send Worker ejecuta:
   a. Segmenter consulta BD → lista de destinatarios
   b. Template Engine reemplaza variables {{nombre}}, {{producto}}, etc.
   c. IPlatformAdapter.sendMessage() a cada destinatario
   d. Track Worker registra entrega, lectura, clic
4. Si falla → Retry Worker (3 intentos) → DLQ si persiste
```

---

## 5. MÓDULO LUMI — ASISTENTE IA COMERCIAL

### 5.1 Inspiración
Basado en **Lumi de Tiendanube** (lanzado mayo 2026, México). Lumi es un asistente IA agéntico que:
- Analiza datos reales de la tienda (ventas, productos, clientes)
- Ejecuta acciones (generar descripciones SEO, cargar catálogos, calcular envíos)
- Opera con RAG sobre la base de datos de la tienda
- Es multimodal (texto, voz, imagen)

### 5.2 Funcionalidades Adaptadas

#### Lumi Assistant — Análisis e Inteligencia
| Funcionalidad | Descripción | Prioridad |
|---------------|-------------|-----------|
| Consultas en lenguaje natural | "¿Cuántas ventas tuve este mes?" "¿Qué productos tienen bajo stock?" | 🔴 Alta |
| Diagnóstico de negocio | Análisis de rendimiento vs período anterior, detección de tendencias | 🟡 Media |
| Segmentación de clientes | Agrupar leads por comportamiento, frecuencia de compra, ticket promedio | 🟡 Media |
| Predicción de demanda | Basado en histórico de ventas y estacionalidad | 🟢 Baja |

#### Lumi Actions — Ejecución Automática
| Funcionalidad | Descripción | Prioridad |
|---------------|-------------|-----------|
| Generar descripciones SEO | Crear/optimizar descripciones de productos con estrategia SEO | 🟡 Media |
| Carga masiva de productos | Procesar hasta 20 productos simultáneamente con validación | 🟡 Media |
| Recomendación inteligente | "Clientes que compraron X también compraron Y" | 🟢 Baja |
| Análisis de imagen de producto | Extraer información de imagen (color, categoría, talla) | 🟢 Baja |

### 5.3 Arquitectura Lumi

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LUMI MODULE                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                    LUMI API ROUTER                          │     │
│  │  POST /lumi/query     → Consulta en lenguaje natural       │     │
│  │  POST /lumi/action    → Ejecutar acción específica         │     │
│  │  GET  /lumi/context   → Obtener contexto actual del negocio│     │
│  └──────────────────────────┬─────────────────────────────────┘     │
│                             │                                        │
│  ┌──────────────────────────┴─────────────────────────────────┐     │
│  │                    LUMI ORCHESTRATOR                        │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │     │
│  │  │ Intent       │  │ Context      │  │ Response       │   │     │
│  │  │ Classifier   │  │ Builder      │  │ Formatter      │   │     │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬───────┘   │     │
│  └─────────┼─────────────────┼───────────────────┼───────────┘     │
│            │                 │                   │                  │
│  ┌─────────┴─────────────────┴───────────────────┴───────────┐     │
│  │                    LUMI USE CASES                          │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │     │
│  │  │ Analytics    │  │ Content Gen  │  │ Product        │   │     │
│  │  │ UseCase      │  │ UseCase      │  │ UseCase        │   │     │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬───────┘   │     │
│  └─────────┼─────────────────┼───────────────────┼───────────┘     │
│            │                 │                   │                  │
│  ┌─────────┴─────────────────┴───────────────────┴───────────┐     │
│  │              INFRASTRUCTURE                                │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │     │
│  │  │ Product  │ │ Order    │ │ Customer │ │ AI Provider  │ │     │
│  │  │ Repo     │ │ Repo     │ │ Repo     │ │ (NVIDIA/     │ │     │
│  │  │          │ │          │ │          │ │  Groq)       │ │     │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. STACK TECNOLÓGICO

### 6.1 Stack Core

| Componente | Tecnología | Versión | Razón |
|------------|-----------|---------|-------|
| **Backend** | FastAPI | 0.115+ | Rendimiento, async nativo, validación Pydantic, OpenAPI automático |
| **Frontend** | Next.js | 14+ | SSR para SEO, App Router, React Server Components |
| **Base de Datos** | PostgreSQL | 16+ | pgvector, RLS multi-tenant, robustez |
| **Vector DB** | pgvector | 0.8+ | Embeddings + datos estructurados en misma DB, ACID |
| **Cache/Queue** | Redis | 7+ | BullMQ para campañas, caché de sesiones, rate limiting |
| **ORM** | SQLAlchemy 2.0 | 2.0+ | Async, maduro, type-safe con Pydantic |
| **RAG Framework** | LangChain | 0.3+ | Orquestación RAG, chains, tool calling |
| **LLM Client** | OpenAI SDK | 1.0+ | Compatible con NVIDIA NIM, Groq, etc. |

### 6.2 Stack Frontend

| Componente | Tecnología | Razón |
|------------|-----------|-------|
| **UI Framework** | Next.js 14+ App Router | SSR, Server Components, API routes |
| **UI Library** | Shadcn/ui + Tailwind 4 | Componentes accesibles, personalizables |
| **State Management** | TanStack Query | Server state, caché, re-fetch |
| **Real-time** | Socket.IO client | Chat en vivo, notificaciones |
| **Forms** | React Hook Form + Zod | Validación tipada performante |
| **Charts** | Recharts | Gráficos ligeros para dashboards |

### 6.3 Stack Backend

| Componente | Tecnología | Razón |
|------------|-----------|-------|
| **Framework** | FastAPI | Async, Pydantic, OpenAPI, rendimiento |
| **ORM** | SQLAlchemy 2.0 + asyncpg | Async PostgreSQL, type-safe |
| **Migrations** | Alembic | Migraciones automáticas desde modelos |
| **Queue** | Celery + Redis (o Arq) | Tareas asíncronas para campañas |
| **Vector Search** | pgvector + LangChain | Embeddings + RAG |
| **AI Client** | openai Python SDK | NVIDIA NIM, Groq, Gemini compatibles |
| **Auth** | FastAPI JWT (python-jose) + bcrypt | JWT stateless, multi-tenant |
| **Validation** | Pydantic v2 | Validación nativa FastAPI |

### 6.4 Stack IA (Múltiples Proveedores)

| Proveedor | Modelo Recomendado | Free Tier | Uso Principal |
|-----------|-------------------|-----------|---------------|
| **NVIDIA NIM** | Llama 3.3 70B, Nemotron | 1,000-5,000 créditos, 40 RPM | Chat principal, RAG |
| **Groq** | Llama 3.3 70B, Mixtral | 30 RPM, 1,000 req/día, 0 costo | Fallback rápido, respuestas en tiempo real |
| **Google Gemini** | Gemini 2.5 Flash | 15 RPM, 1,500 req/día, 1M contexto | Análisis de documentos grandes, Lumi |
| **Cerebras** | Llama 3.3 70B | ~1M tokens/día, 30 RPM | Batch processing, alta velocidad |

---

## 7. APIs DE IA GRATUITAS

### 7.1 Comparativa Completa (2026)

| Proveedor | Free Tier | RPM | TPM/Día | Contexto | ¿Requiere TC? | Mejor Para |
|-----------|-----------|-----|---------|----------|--------------|------------|
| **Google Gemini** | 1,500 req/día Flash | 15 | 1,000,000 | 1M tokens | No | Consultas largas, análisis |
| **Groq** | 30 RPM, 1,000 req/día | 30 | 14,400 | 128K | No | Chat en tiempo real, velocidad |
| **NVIDIA NIM** | 1,000-5,000 créditos | 40 | ~1,000 req | 128K | No | Modelos variados, embeddings |
| **Cerebras** | ~1M tokens/día | 30 | 30,000 | 128K | No | Alto throughput batch |
| **OpenRouter** | 20+ modelos gratis | 20 | 50 req/día | 1M | No | Multi-model fallback |
| **Mistral** | ~1B tokens/mes | 2 | 500,000 | 32K | No | Código, datos europeos |
| **Cloudflare AI** | 10K neurons/día | Ilimitado | Ilimitado | 8K | No | Edge computing |

### 7.2 Estrategia de Proveedores (Failover Chain)

```
ORDEN DE INTENTO:

1. Groq (Llama 3.3 70B) — Más rápido, gratis, alta cuota diaria
   ↓ si falla (429, timeout, error)
2. NVIDIA NIM (Nemotron/Llama) — Buena calidad, créditos gratis
   ↓ si falla
3. Gemini 2.5 Flash — Contexto 1M, alta cuota, gratis
   ↓ si falla
4. Cerebras (Llama 3.3 70B) — Alto throughput, gratis
   ↓ si todo falla
5. Modo offline: Respuesta cacheada o mensaje de error amigable
```

### 7.3 Costos Proyectados (Escalando)

| Volumen | Proveedor | Costo Mensual |
|---------|-----------|---------------|
| Prototipo (< 1K req/día) | Groq + NVIDIA + Gemini | **$0 USD** |
| Bajo (< 10K req/día) | Groq + NVIDIA + Gemini | **$0-5 USD** (ocasionalmente pagar NVIDIA credits) |
| Medio (< 50K req/día) | Groq pay-as-you-go | ~$30-100 USD |
| Alto (> 100K req/día) | Self-hosted Ollama con GPU | Costo de GPU único + electricidad |

---

## 8. ROADMAP DE DESARROLLO

### 📅 Fase 0: Fundación Técnica (Sprint 1 — Días 1-7)

**Objetivo:** Setup del proyecto, base de datos, arquitectura base funcional.

| Tarea | Esfuerzo | Dependencias | Resultado |
|-------|----------|--------------|-----------|
| F0.1 | Crear estructura de directorios Clean Architecture | 2h | — | Proyecto base con 4 capas |
| F0.2 | Configurar FastAPI + SQLAlchemy + Alembic | 3h | F0.1 | API base con health check |
| F0.3 | Configurar PostgreSQL + pgvector + Redis Docker | 2h | F0.2 | Entorno local funcional |
| F0.4 | Implementar modelo User + Organization + migraciones | 4h | F0.3 | Multi-tenencia lista |
| F0.5 | Implementar JWT auth + multi-tenant middleware | 4h | F0.4 | Auth funcional |
| F0.6 | Configurar Next.js + Shadcn/ui + Tailwind | 3h | — | Frontend base con layout |
| F0.7 | Crear CI/CD (GitHub Actions) + Dockerfile multi-stage | 3h | F0.5 | Pipeline CI básico |

**🎯 Milestone F0:** Proyecto base funcional con auth multi-tenant, DB, y frontend básico desplegable localmente.

---

### 📅 Fase 1: Chatbot Receptivo + RAG (Sprint 2 — Días 8-18)

**Objetivo:** Chatbot funcional en Telegram con respuestas IA y RAG básico.

| Tarea | Esfuerzo | Dependencias | Resultado |
|-------|----------|--------------|-----------|
| F1.1 | Definir entidades Domain: Message, Conversation, BotConfig | 4h | F0.5 | Modelo de datos del chat |
| F1.2 | Implementar puertos (interfaces) Domain | 3h | F1.1 | IMessageRepo, IConversationRepo, IAIProvider, IPlatformAdapter |
| F1.3 | Implementar repositorios PostgreSQL | 6h | F1.2 | CRUD de mensajes y conversaciones |
| F1.4 | Implementar AI Provider NVIDIA NIM | 4h | F1.2 | Cliente LLM funcional con failover a Groq |
| F1.5 | Implementar proveedor embeddings (NVIDIA / Gemini) | 3h | F1.4 | Embeddings para RAG |
| F1.6 | Configurar pgvector + LangChain RAG chain | 6h | F1.5 | RAG funcional con productos+conocimiento |
| F1.7 | Implementar ProcessMessageUseCase | 6h | F1.3, F1.6 | Orquestador de mensajes |
| F1.8 | Implementar TelegramAdapter (receive + send) | 4h | F1.4 | Chatbot habla por Telegram |
| F1.9 | Crear Webhook Receiver en API | 2h | F1.7 | Endpoint webhook para Telegram |
| F1.10 | Implementar chat UI en Next.js | 6h | F0.6 | Interfaz de chat básica |
| F1.11 | Integrar Socket.IO para tiempo real | 4h | F1.10 | Mensajes en vivo en dashboard |
| F1.12 | Tests de integración Fase 1 | 4h | F1.7-F1.11 | 10+ tests pasando |

**🎯 Milestone F1:** Chatbot funcional en Telegram con respuestas IA vía RAG sobre productos, almacenamiento de conversaciones, y dashboard en tiempo real.

---

### 📅 Fase 2: Multi-Plataforma + Inteligencia (Sprint 3 — Días 19-30)

**Objetivo:** Soportar 4 plataformas + clasificación de intención + RAG entrenable.

| Tarea | Esfuerzo | Dependencias | Resultado |
|-------|----------|--------------|-----------|
| F2.1 | Implementar WhatsAppAdapter (Meta Cloud API) | 6h | F1.8 | WhatsApp funcional |
| F2.2 | Implementar MessengerAdapter (Graph API) | 6h | F1.8 | Messenger funcional |
| F2.3 | Implementar TikTokAdapter (TikTok Messaging API) | 8h | F1.8 | TikTok funcional |
| F2.4 | Factory de plataformas (PlatformFactory + Registry) | 4h | F2.1-F2.3 | Nuevas plataformas = 1 archivo nuevo |
| F2.5 | Implementar ClassifyIntentUseCase (zero-shot) | 6h | F1.6 | Detectar consulta/compra/queja/derivar |
| F2.6 | Implementar ExtractStructuredDataUseCase | 6h | F1.6 | Extraer nombre, email, telf, producto |
| F2.7 | Implementar RAG Sync Worker (actualización periódica) | 6h | F1.6 | RAG se actualiza automáticamente desde DB |
| F2.8 | Implementar EscalationUseCase (derivar a humano) | 4h | F2.5 | Transferencia de contexto a agente |
| F2.9 | Mejorar chat UI: multi-thread, estado, typing | 6h | F1.11 | UX completa de chat |
| F2.10 | Dashboard de conversaciones por plataforma | 6h | F2.9 | Métricas agrupadas |
| F2.11 | Tests multi-plataforma + fixtures | 6h | F2.1-F2.8 | 25+ tests |

**🎯 Milestone F2:** 4 plataformas funcionando, clasificación de intención, extracción de datos, RAG auto-actualizable, dashboard multi-plataforma.

---

### 📅 Fase 3: Campañas (Sprint 4 — Días 31-42)

**Objetivo:** Modo campaña con segmentación, programación, ejecución y reportes.

| Tarea | Esfuerzo | Dependencias | Resultado |
|-------|----------|--------------|-----------|
| F3.1 | Definir entidades Campaign, Audience, Template | 4h | F2.9 | Modelo de datos de campañas |
| F3.2 | Implementar CampaignRepository | 4h | F3.1 | CRUD de campañas |
| F3.3 | Implementar AudienceSegmenter (filtros SQL) | 6h | F3.1 | Segmentar leads por condiciones |
| F3.4 | Implementar TemplateEngine (variables dinámicas) | 4h | F3.1 | Reemplazar {{nombre}}, {{producto}} |
| F3.5 | Configurar Celery/Redis para campañas | 4h | F0.3 | Sistema de colas funcional |
| F3.6 | Implementar CampaignScheduler | 6h | F3.5 | Programar + ejecutar campañas |
| F3.7 | Implementar Send Worker + Retry + DLQ | 8h | F3.6 | Entrega robusta con reintentos |
| F3.8 | Implementar Track Worker (delivery, read, click) | 6h | F3.7 | Tracking de métricas de campaña |
| F3.9 | UI de creación de campañas (Next.js) | 8h | F3.2-F3.4 | Formulario completo |
| F3.10 | UI de reportes de campaña (gráficos) | 6h | F3.8 | Dashboard con métricas |
| F3.11 | Tests de campañas | 6h | F3.1-F3.10 | 20+ tests |

**🎯 Milestone F3:** Sistema de campañas completo con segmentación, plantillas, programación, ejecución multi-plataforma, tracking y reportes.

---

### 📅 Fase 4: Módulo Lumi (Sprint 5 — Días 43-55)

**Objetivo:** Asistente IA de negocio con análisis NL y acciones automáticas.

| Tarea | Esfuerzo | Dependencias | Resultado |
|-------|----------|--------------|-----------|
| F4.1 | Definir entidades Lumi: Query, Action, Context | 4h | F2.9 | Modelo de datos Lumi |
| F4.2 | Implementar LumiIntentClassifier | 6h | F1.4 | Clasificar consultas de negocio |
| F4.3 | Implementar ContextBuilder (datos de la tienda) | 6h | F4.1 | Armar contexto para LLM |
| F4.4 | Implementar AnalyticsUseCase (ventas, productos) | 8h | F4.3 | Consultas SQL → NL |
| F4.5 | Implementar ContentGenUseCase (descripciones SEO) | 6h | F1.4 | Generar descripciones |
| F4.6 | Implementar ProductUseCase (carga masiva) | 6h | F4.5 | Procesar 20 productos |
| F4.7 | Lumi API Router + endpoints | 4h | F4.4-F4.6 | API Lumi completa |
| F4.8 | UI Lumi Chat (Next.js) | 8h | F4.7 | Interfaz conversacional Lumi |
| F4.9 | UI Lumi Actions (panel de acciones) | 6h | F4.8 | Botones + formularios de acción |
| F4.10 | Tests Lumi | 6h | F4.1-F4.9 | 15+ tests |

**🎯 Milestone F4:** Lumi funcional: consultas de negocio en lenguaje natural, generación de descripciones SEO, carga masiva de productos, dashboard de analytics.

---

### 📅 Fase 5: Producción y Escalado (Sprint 6 — Días 56-70)

**Objetivo:** Hardening, monitoreo, documentación, deployment.

| Tarea | Esfuerzo | Dependencias | Resultado |
|-------|----------|--------------|-----------|
| F5.1 | Implementar rate limiting por orgId + plan | 4h | F3.11 | Límites por plan |
| F5.2 | Monitoreo con Prometheus + Grafana | 8h | F3.11 | Métricas de sistema y negocio |
| F5.3 | Logging estructurado (JSON logs → ELK/Loki) | 4h | F5.2 | Trazabilidad completa |
| F5.4 | Error handling global + DLQ monitoreo | 4h | F5.3 | Alertas de errores |
| F5.5 | Documentación API (OpenAPI + Postman) | 6h | F4.10 | Docs completas |
| F5.6 | Documentación técnica + diagramas | 8h | F5.5 | Wiki del proyecto |
| F5.7 | Deploy staging + production (Docker + VPS/Cloud) | 8h | F5.1-F5.4 | Entorno productivo |
| F5.8 | Pruebas de carga + optimización | 8h | F5.7 | 100 req/s estables |
| F5.9 | Tests E2E (Playwright/Cypress) | 8h | F5.6 | 10+ flujos completos |
| F5.10 | Security audit (RLS, JWT, rate-limit, CORS) | 6h | F5.8 | Sin vulnerabilidades críticas |

**🎯 Milestone F5:** Sistema en producción con monitoreo, documentación, 100+ tests pasando, listo para escalar a cientos de organizaciones.

---

## 9. ESTRUCTURA DE DIRECTORIOS

```
chatbot-lumi/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py              ← Dependencias DI (get_db, get_current_org, etc.)
│   │   │   ├── middleware/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── tenant.py        ← Multi-tenant isolation
│   │   │   │   ├── auth.py          ← JWT verification
│   │   │   │   └── rate_limit.py    ← Plan-based rate limiting
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── health.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── chat.py          ← Message endpoints
│   │   │   │   ├── campaign.py      ← Campaign CRUD
│   │   │   │   ├── lumi.py          ← Lumi queries & actions
│   │   │   │   └── webhooks.py      ← Platform webhooks
│   │   │   └── controllers/
│   │   │       ├── __init__.py
│   │   │       ├── auth_controller.py
│   │   │       ├── chat_controller.py
│   │   │       ├── campaign_controller.py
│   │   │       ├── lumi_controller.py
│   │   │       └── webhook_controller.py
│   │   │
│   │   ├── application/
│   │   │   ├── __init__.py
│   │   │   ├── use_cases/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── chat/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── process_message.py
│   │   │   │   │   ├── classify_intent.py
│   │   │   │   │   ├── extract_structured_data.py
│   │   │   │   │   ├── rag_retrieve.py
│   │   │   │   │   ├── generate_response.py
│   │   │   │   │   └── escalate_to_human.py
│   │   │   │   ├── campaign/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── create_campaign.py
│   │   │   │   │   ├── schedule_campaign.py
│   │   │   │   │   ├── execute_campaign.py
│   │   │   │   │   └── get_campaign_report.py
│   │   │   │   └── lumi/
│   │   │   │       ├── __init__.py
│   │   │   │       ├── query_analytics.py
│   │   │   │       ├── generate_content.py
│   │   │   │       └── execute_action.py
│   │   │   └── interfaces/
│   │   │       ├── __init__.py
│   │   │       ├── unit_of_work.py
│   │   │       └── event_bus.py
│   │   │
│   │   ├── domain/
│   │   │   ├── __init__.py
│   │   │   ├── entities/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── organization.py
│   │   │   │   ├── user.py
│   │   │   │   ├── message.py
│   │   │   │   ├── conversation.py
│   │   │   │   ├── campaign.py
│   │   │   │   ├── audience_segment.py
│   │   │   │   ├── lead.py
│   │   │   │   ├── product.py
│   │   │   │   └── lumi_query.py
│   │   │   ├── value_objects/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── platform_type.py
│   │   │   │   ├── message_content.py
│   │   │   │   ├── intent_score.py
│   │   │   │   └── campaign_status.py
│   │   │   └── ports/
│   │   │       ├── __init__.py
│   │   │       ├── repositories/
│   │   │       │   ├── i_message_repo.py
│   │   │       │   ├── i_conversation_repo.py
│   │   │       │   ├── i_campaign_repo.py
│   │   │       │   ├── i_lead_repo.py
│   │   │       │   ├── i_product_repo.py
│   │   │       │   └── i_organization_repo.py
│   │   │       ├── i_ai_provider.py
│   │   │       ├── i_embedding_provider.py
│   │   │       ├── i_platform_adapter.py
│   │   │       └── i_vector_store.py
│   │   │
│   │   └── infrastructure/
│   │       ├── __init__.py
│   │       ├── persistence/
│   │       │   ├── __init__.py
│   │       │   ├── models/
│   │       │   │   ├── __init__.py
│   │       │   │   ├── base.py
│   │       │   │   ├── organization.py
│   │       │   │   ├── user.py
│   │       │   │   ├── message.py
│   │       │   │   ├── conversation.py
│   │       │   │   ├── campaign.py
│   │       │   │   ├── lead.py
│   │       │   │   └── product.py
│   │       │   ├── repositories/
│   │       │   │   ├── __init__.py
│   │       │   │   ├── postgres_message_repo.py
│   │       │   │   ├── postgres_conversation_repo.py
│   │       │   │   ├── postgres_campaign_repo.py
│   │       │   │   ├── postgres_lead_repo.py
│   │       │   │   ├── postgres_product_repo.py
│   │       │   │   └── postgres_organization_repo.py
│   │       │   └── unit_of_work.py
│   │       ├── ai/
│   │       │   ├── __init__.py
│   │       │   ├── nvidia_nim_provider.py
│   │       │   ├── groq_provider.py
│   │       │   ├── gemini_provider.py
│   │       │   ├── ai_provider_factory.py
│   │       │   └── embeddings.py
│   │       ├── rag/
│   │       │   ├── __init__.py
│   │       │   ├── pgvector_store.py
│   │       │   ├── rag_chain.py
│   │       │   └── sync_worker.py
│   │       ├── platforms/
│   │       │   ├── __init__.py
│   │       │   ├── telegram_adapter.py
│   │       │   ├── whatsapp_adapter.py
│   │       │   ├── messenger_adapter.py
│   │       │   ├── tiktok_adapter.py
│   │       │   └── platform_factory.py
│   │       ├── campaign/
│   │       │   ├── __init__.py
│   │       │   ├── scheduler.py
│   │       │   ├── send_worker.py
│   │       │   ├── track_worker.py
│   │       │   └── template_engine.py
│   │       ├── queue/
│   │       │   ├── __init__.py
│   │       │   └── redis_queue.py
│   │       └── config/
│   │           ├── __init__.py
│   │           ├── settings.py
│   │           ├── database.py
│   │           └── redis.py
│   │
│   ├── migrations/                    ← Alembic
│   │   ├── env.py
│   │   ├── alembic.ini
│   │   └── versions/
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   ├── api/
│   │   └── integration/
│   │
│   ├── main.py                        ← FastAPI app, DI wiring
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   ├── pyproject.toml
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   ├── chat/
│   │   │   ├── campaigns/
│   │   │   └── lumi/
│   │   ├── components/
│   │   │   ├── ui/                    ← Shadcn/ui
│   │   │   ├── chat/
│   │   │   ├── campaign/
│   │   │   ├── lumi/
│   │   │   └── shared/
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── socket.ts
│   │   │   └── utils.ts
│   │   └── stores/
│   │       ├── auth.ts
│   │       └── chat.ts
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   ├── package.json
│   └── next.config.js
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx.conf
├── .env.example
├── .github/workflows/ci.yml
└── README.md
```

---

## 10. FLUJOS CLAVE

### 10.1 Flujo de Mensaje (Completo)

```
1. USUARIO → [Telegram/WhatsApp/etc.] → envía mensaje
2. PLATAFORMA → [Webhook] → POST /api/webhooks/{platform}
3. API LAYER → WebhookController:
   a. Valida firma del webhook (según plataforma)
   b. Normaliza mensaje a formato interno
   c. Resuelve orgId desde token de plataforma
   d. Llama a ProcessMessageUseCase
4. APPLICATION LAYER → ProcessMessageUseCase:
   a. Busca o crea Conversation (por orgId + conversationId externo)
   b. Guarda Message (role='user')
   c. ClassifyIntentUseCase:
      - Determina si es consulta, compra, queja, spam, derivar
   d. RAGRetrieveUseCase:
      - Genera embedding del mensaje
      - Busca top-K en pgvector (productos, knowledge_chunks)
      - Filtra por orgId
   e. GenerateResponseUseCase:
      - Construye prompt con contexto RAG + historial
      - Llama a IAIProvider.generate() con failover
   f. ExtractStructuredDataUseCase:
      - Si hay datos (nombre, email, producto), los extrae
      - Actualiza lead si existe o crea uno nuevo
   g. Guarda Message (role='assistant')
   h. Emite evento vía Socket.IO
   i. Si intent_score < 30% → EscalationUseCase (derivar a humano)
5. INFRASTRUCTURE → PlatformAdapter.sendMessage():
   a. Envía respuesta al usuario por la misma plataforma
6. CLIENTE recibe respuesta
```

### 10.2 Flujo de Campaña

```
1. USUARIO → [Dashboard] → crea campaña:
   a. Selecciona plataforma(s)
   b. Define segmento (filtros: estado lead, fecha, producto)
   c. Selecciona plantilla o escribe mensaje
   d. Programa fecha/hora
2. API → CampaignController.create():
   a. Guarda Campaign en BD
   b. Si schedule_at está en futuro → CampaignScheduler programa en Redis
   c. Si es inmediato → encola directamente
3. SCHEDULER (BullMQ/Celery):
   a. A la hora programada, libera el job
   b. SendWorker ejecuta:
      - AudienceSegmenter consulta BD → lista de destinatarios
      - TemplateEngine reemplaza {{variables}}
      - Por cada destinatario en batch de 50:
        → PlatformAdapter.sendMessage()
        → TrackWorker registra intento (success/fail)
      - Si fail → RetryWorker (3 intentos con backoff exponencial)
      - Si persiste → DLQ (Dead Letter Queue) para revisión manual
4. REPORTES:
   a. Tracking de: enviados, entregados, leídos, respondidos, rebotados
   b. Dashboard con gráficos en tiempo real
```

### 10.3 Flujo Lumi Query

```
1. USUARIO → [Lumi Chat] → "¿Cuántas ventas tuve este mes?"
2. API → LumiController.query():
   a. Obtiene orgId del token JWT
   b. Construye contexto: últimas ventas, productos, métricas
   c. Llama a LumiOrchestrator
3. LUMI ORCHESTRATOR:
   a. LumiIntentClassifier → determina intención
      - "analytics" → AnalyticsUseCase
      - "content" → ContentGenUseCase
      - "action" → ExecuteActionUseCase
   b. ContextBuilder → arma contexto completo:
      - Ventas del mes (SQL aggregation)
      - Productos top/bottom
      - Leads nuevos
      - Métricas de campañas activas
   c. AnalyticsUseCase:
      - Ejecuta consultas SQL según la pregunta
      - Convierte resultados a texto natural vía LLM
      - Aplica formato: tablas, gráficos, bullet points
   d. ResponseFormatter:
      - Si es numérico → incluye gráfico
      - Si es lista → tabla formateada
      - Si es análisis → texto con recomendaciones
4. RESPUESTA → UI de Lumi con texto + gráficos + acciones sugeridas
```

---

## 11. MÉTRICAS Y MONITOREO

### 11.1 Métricas de Sistema (Técnicas)

| Métrica | Dónde | Alerta si |
|---------|-------|-----------|
| Latencia de respuesta IA | Prometheus | > 5s promedio |
| Tasa de error de proveedores IA | Prometheus | > 5% en 5 min |
| Mensajes por minuto | Prometheus | > límite del plan |
| Cola de campañas atrasadas | Redis/BullMQ | > 10 min de retraso |
| Conexiones WebSocket activas | Prometheus | > 1000 concurrentes |
| Uso de pgvector (tamaño) | PostgreSQL | > 10GB |

### 11.2 Métricas de Negocio

| Métrica | Tabla | Dashboard |
|---------|-------|-----------|
| Total mensajes procesados | messages | Por día/semana/mes |
| Tasa de resolución IA (%) | messages | intent_score > 70% |
| Tasa de derivación a humano | messages | intent_score < 30% |
| Leads generados por chat | leads | Por plataforma |
| Campañas ejecutadas | campaigns | Por estado |
| Tasa de entrega de campañas | campaign_events | Entregados/enviados |
| Tasa de respuesta a campañas | campaign_events | Respondidos/entregados |
| Plataforma más activa | messages | Porcentaje del total |

### 11.3 Logging Estructurado

```json
{
  "timestamp": "2026-07-03T22:30:00Z",
  "level": "INFO",
  "service": "chatbot",
  "trace_id": "abc-123-def",
  "org_id": "org-456",
  "platform": "telegram",
  "conversation_id": "conv-789",
  "action": "process_message",
  "metrics": {
    "classify_ms": 120,
    "rag_ms": 340,
    "llm_ms": 890,
    "total_ms": 1450,
    "tokens_used": 456,
    "provider": "groq"
  },
  "result": {
    "intent": "product_inquiry",
    "intent_score": 0.85,
    "extracted": {"product": "Vestido Rojo", "price": 180},
    "escalated": false
  }
}
```

---

## 12. PRÓXIMOS PASOS INMEDIATOS

### Día 1: Setup del Proyecto
- [ ] Crear estructura de directorios (Clean Architecture)
- [ ] Configurar FastAPI + SQLAlchemy + Alembic
- [ ] Configurar Docker (PostgreSQL + pgvector + Redis)
- [ ] Configurar Next.js + Shadcn/ui + Tailwind
- [ ] Commit inicial + CI/CD base

### Día 2-3: Fundación
- [ ] Modelos User + Organization + migraciones
- [ ] JWT auth + multi-tenant middleware
- [ ] Repositorios base (org, user, session)
- [ ] Tests de auth multi-tenant

### Día 4-5: IA Provider + RAG
- [ ] Registrarse en NVIDIA Developer Program (build.nvidia.com)
- [ ] Obtener API key NVIDIA NIM + Groq + Gemini
- [ ] Implementar AI Provider con failover chain
- [ ] Configurar pgvector + LangChain
- [ ] Test de embeddings + RAG básico

### Día 6-7: MVP Chatbot Telegram
- [ ] Implementar ProcessMessageUseCase
- [ ] Implementar TelegramAdapter
- [ ] Crear webhook receiver
- [ ] Probar ciclo completo: Telegram → IA → respuesta

### Semana 2-3: Multi-Plataforma + Campañas
- [ ] WhatsApp + Messenger + TikTok adapters
- [ ] Clasificación de intención
- [ ] Extracción de datos estructurados
- [ ] Modo campaña (CRUD + scheduler + workers)

### Semana 4-5: Lumi + Hardening
- [ ] Lumi Assistant (consultas NL)
- [ ] Lumi Actions (generación de contenido)
- [ ] Dashboard de métricas
- [ ] Tests E2E + documentación

---

## ANEXO A: APIs de IA — Guía de Registro Rápido

### NVIDIA NIM (Recomendado #1)
1. Ir a https://build.nvidia.com
2. Crear cuenta gratuita (Developer Program)
3. Ir a Settings → API Keys → Generate Key
4. Key: `nvapi-...`
5. Endpoint: `https://integrate.api.nvidia.com/v1`
6. SDK: OpenAI-compatible (`pip install openai`)
7. Límites: 1,000 créditos gratis, 40 RPM

### Groq (Recomendado #2 — más rápido)
1. Ir a https://console.groq.com
2. Sign up → API Keys
3. Key: `gsk_...`
4. Endpoint: `https://api.groq.com/openai/v1`
5. Límites: 30 RPM, 1,000 req/día, 0 costo
6. Modelos: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`

### Google Gemini (Recomendado #3 — más contexto)
1. Ir a https://aistudio.google.com
2. Get API Key → Create (no credit card)
3. Key: `AIza...`
4. Endpoint: `https://generativelanguage.googleapis.com/v1beta`
5. Límites: 15 RPM, 1,500 req/día, 1M contexto

---

## ANEXO B: Comparativa Lumi (Tiendanube) vs Nuestro Módulo

| Característica | Lumi (Tiendanube) | Nuestro Módulo |
|----------------|-------------------|----------------|
| **Alcance** | Solo Tiendanube (e-commerce) | Multi-negocio, multi-industria |
| **Plataformas** | Solo dentro del admin Tiendanube | Telegram, WhatsApp, Messenger, TikTok, Web |
| **Modo Campaña** | No tiene | Sí, con segmentación y programación |
| **RAG** | Sobre datos de tienda Tiendanube | Sobre cualquier DB del negocio (productos, knowledge, leads) |
| **Multi-tenencia** | No aplica (es Tiendanube) | Sí, aislamiento completo por orgId |
| **Plugins** | No extensible | Arquitectura plugin para plataformas y proveedores IA |
| **Campañas masivas** | No | Sí, con tracking de entrega/lectura/clic |
| **Código abierto** | No (propietario) | Sí, desarrollo propio |
| **APIs IA** | Propietarias | NVIDIA NIM + Groq + Gemini (gratis) |
| **Exportación datos** | Limitado | CSV, PDF, API pública |
