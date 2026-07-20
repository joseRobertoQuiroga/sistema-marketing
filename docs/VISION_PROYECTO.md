# OmniPresence Suite — Visión del Proyecto

> **Versión:** 2.0 (Junio 2026)
> **Estado:** MVP Funcional → Reestructuración hacia Producción

---

## 1. Concepto del Producto

**OmniPresence Suite** es un SaaS de **marketing automation multi-tenant** diseñado para PYMEs hispanohablantes. Su propuesta de valor es reemplazar 4-7 herramientas dispersas (Meta Business Suite, TikTok Analytics, Canva, chatbot, Excel de leads) en un único panel integrado con 3 módulos centrales:

| Módulo | Función | Estado |
|--------|---------|--------|
| **AI Bot & Lead Engine** | Bot IA multimodal + CRM de leads | ✅ MVP funcional (Telegram) |
| **Analytics Hub** | Métricas unificadas de redes sociales | 🔶 Mockups HTML |
| **Content Hub** | Publicación centralizada de contenido | 🔶 Mockups HTML |

### Diferenciadores Clave

- **IA Híbrida Local/Cloud:** Texto y embeddings con Ollama (local), visión con Qwen-VL (GPU cloud), audio con Whisper.cpp (local)
- **Arquitectura Multi-tenant:** Aislamiento total entre organizaciones via RLS de PostgreSQL
- **Omnicanalidad desde el Día 1:** PlatformManager como abstracción estratégica para cualquier plataforma de mensajería

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Runtime** | Node.js | 20 LTS |
| **Framework Backend** | Express | 5.x |
| **Frontend** | React + Vite | 19 + 8 |
| **Estilos** | Tailwind CSS | 4.x |
| **Base de Datos** | PostgreSQL + pgvector | 16 + 0.8 |
| **Cache/Colas** | Redis + BullMQ | 7 + 5.x |
| **LLM Local** | Ollama (Mistral) | Última |
| **Embeddings** | nomic-embed-text (Ollama) | Última |
| **Audio** | Whisper.cpp | Última |
| **Visión** | Qwen-VL (vLLM) | Última |
| **Tiempo Real** | Socket.IO | 4.x |
| **Container** | Docker + Docker Compose | Última |

---

## 3. Objetivos Estratégicos

### Inmediatos (Julio 2026)
1. **Seguridad y Fundación:** Sistema completo de autenticación JWT + multi-tenancy real
2. **CRM de Leads:** Tabla independiente + upsert automático + Kanban dashboard
3. **Omnicanalidad:** WhatsApp Business API como segunda plataforma

### Corto Plazo (Agosto-Septiembre 2026)
4. **Refactor Backend:** Arquitectura hexagonal con separación clara de capas (domain, application, infrastructure)
5. **Refactor Frontend:** React Router + Zustand + componentes modulares
6. **Analytics Hub:** Conexión OAuth con Meta + dashboard de KPIs

### Mediano Plazo (Octubre-Noviembre 2026)
7. **Content Hub:** Upload de assets + Sharp processing + scheduler de publicaciones
8. **Alertas y Notificaciones:** Sistema push/email + triggers automáticos
9. **Billing y Monetización:** Stripe + planes Free/Pro/Business/Agency

### Largo Plazo (2027)
10. **Bot Avanzado:** State machine + function calling + pipeline de upload de knowledge base
11. **Onboarding de Organización:** Flujo de 4 pasos para nuevos clientes
12. **API Pública:** REST API para integraciones externas

---

## 4. Principios Arquitectónicos (SOLID + Hexagonal)

### SOLID
- **S** — Single Responsibility: Cada clase/archivo tiene una única responsabilidad
- **O** — Open/Closed: Abierto a extensión, cerrado a modificación (PlatformManager)
- **L** — Liskov Substitution: Los adaptadores de plataforma son intercambiables
- **I** — Interface Segregation: Interfaces pequeñas y específicas
- **D** — Dependency Inversion: Módulos de alto nivel no dependen de implementaciones concretas

### Arquitectura Hexagonal (Ports & Adapters)

```
                    ┌──────────────────────┐
                    │      DOMAIN          │
                    │  (Entities + Use     │
                    │   Cases)             │
                    └──────┬──────┬────────┘
                           │      │
              ┌────────────┘      └────────────┐
              ▼                                 ▼
     ┌─────────────────┐            ┌──────────────────┐
     │  APPLICATION    │            │  INFRASTRUCTURE  │
     │  (Services)     │            │  (DB, Cache,     │
     │                 │            │   External APIs)  │
     └─────────────────┘            └──────────────────┘
              │                                 │
              ▼                                 ▼
     ┌─────────────────┐            ┌──────────────────┐
     │  PORTS (In)     │            │  PORTS (Out)     │
     │  Controllers    │            │  Repositories    │
     │  Middleware      │            │  Adapters        │
     └─────────────────┘            └──────────────────┘
```

---

## 5. Estado Actual vs Objetivo por Módulo

### M3 — AI Bot & Lead Engine
| Feature | Actual | Objetivo | % |
|---------|--------|----------|---|
| Bot conversacional | Solo Telegram (polling) | WhatsApp + IG + FB + Telegram | 30% |
| RAG | Texto manual + seed | Upload CSV/PDF automático | 50% |
| Intent scoring | Score 0-100 + KPI | Signals + recommended_action | 70% |
| Captura de datos | captured_data JSONB | CRM completo con upsert | 80% |
| Pipeline multimodal | Texto + Audio + Imagen | + Video + Documentos | 90% |
| Escalado a humano | Bot pause + reply admin | Handoff completo + alertas | 75% |
| CRM Leads | No existe | Tabla independiente + kanban | 0% |
| Alertas leads calientes | No existe | Push/email por threshold | 0% |

### M1 — Analytics Hub | 0% implementado
### M2 — Content Hub | 0% implementado
### Billing & Monetización | 0% implementado

---

## 6. Roadmap de Implementación

```
Semana 1-2:   FASE 0 — Seguridad y Fundación (Auth + Multi-tenancy)
Semana 3:     FASE 3 — Refactor Backend (Arquitectura Hexagonal)
              FASE 4 — Refactor Frontend (Router + Componentes)
Semana 4:     FASE 1 — CRM de Leads
              FASE 7 — Alertas y Notificaciones
Semana 5-6:   FASE 2 — Omnicanalidad (WhatsApp API)
Semana 7-8:   FASE 8 — Onboarding de Organización
              FASE 5 — Analytics Hub
Semana 9-10:  FASE 6 — Content Hub
              FASE 9 — Billing y Monetización
Semana 11-12: FASE 10 — Bot Avanzado (State Machine + Function Calling)
```
