# Mejoras Pendientes y Evolución del Bot IA

Este documento recopila las ideas, análisis y propuestas de mejora a largo plazo para la OmniPresence Suite, enfocadas en hacer que el bot sea más profesional, dinámico y que el sistema sea agnóstico a la plataforma.

## 1. Evolución de la Personalidad y Flujo del Bot

- **Flujo Basado en Estados (State Machine):**
  Actualmente, el bot inyecta todo el contexto mediante RAG en un solo prompt. Una mejora sustancial sería dividir la conversación en estados:
  1. *Saludo y Cualificación:* Recabar información inicial.
  2. *Descubrimiento:* RAG enfocado solo en el catálogo basado en lo que pidió el cliente.
  3. *Cierre/Agendamiento:* RAG enfocado en políticas de venta, métodos de pago o conexión a calendario.
- **Llamadas a Herramientas (Function Calling):**
  Permitir que el LLM (ej. Mistral o Qwen) decida invocar funciones específicas de backend, como `crear_cita()` o `guardar_lead()`.

## 2. Abstracción de Múltiples Plataformas de Chat

Para escalar el sistema a WhatsApp, Facebook Messenger, Instagram Direct y TikTok, se debe abstraer la capa de mensajería:

- **Patrón Strategy (`PlatformManager`):**
  Toda la lógica de envío y recepción debe pasar por un `PlatformManager` que delega al adaptador correspondiente.
  *Ejemplo:* `PlatformManager.sendMessage('whatsapp', chatId, texto)`
- **Estandarización de Payloads:**
  Los webhooks de Meta, Twilio o TikTok son diferentes. Deben ser normalizados al entrar al sistema para que la cola `botQueue` reciba siempre el mismo objeto genérico.

## 3. Organización y Persistencia de Leads

- **Tabla Independiente de `Leads` (CRM):**
  Actualmente extraemos el `captured_data` desde la tabla de mensajes. Lo ideal es que, una vez que el Intent Score supere un umbral (ej. 50), se ejecute un *Upsert* (Insert o Update) en una tabla central de `leads`. Esto facilitará:
  - Crear filtros complejos en el dashboard.
  - Generar analíticas de conversión.
  - Sincronizar automáticamente con otros CRMs mediante APIs.

## 4. Diferenciación Visual en Dashboard

- **Indicadores de Origen:**
  A medida que agreguemos plataformas, la barra lateral de chats debe incluir el ícono de la plataforma (ej. logo de WhatsApp verde, o Telegram azul) para que el agente tenga contexto de cómo se está comunicando con el cliente.
