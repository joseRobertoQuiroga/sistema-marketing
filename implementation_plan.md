# Plan de Implementación: Módulo 3 - Bot IA Multimodal Híbrido (MVP)

Este documento detalla la estrategia técnica y de producto para implementar el Módulo 3 de OmniPresence Suite siguiendo una **Arquitectura Híbrida** para optimizar costos y control. El sistema utilizará modelos locales para texto y audio, y GPU en la nube para visión (imágenes).

> [!IMPORTANT]
> **Arquitectura Híbrida (Local + Cloud)**
> Se ha definido el uso de modelos Open Source corriendo localmente (vía Ollama y Whisper.cpp) para minimizar costos operativos de APIs externas, reservando la nube para tareas intensivas de GPU como el procesamiento de imágenes con Qwen-VL.

## Open Questions

> [!WARNING]
> **Decisiones Técnicas Pendientes:**
> 1. **Infraestructura Local:** ¿El servidor donde correrá Node.js y Ollama tiene recursos suficientes (mínimo 16GB RAM) para soportar Mistral y Whisper simultáneamente?
> 2. **Instancia GPU (Cloud):** ¿Utilizaremos Google Cloud (G2 standard) o una opción más económica como RunPod/Lambda Labs para el modelo Qwen-VL?
> 3. **Firebase Webhooks:** ¿La integración con Meta (WhatsApp/IG) pasará primero por Firebase Functions o se conectará directamente al Backend Node.js expuesto?

---

## 1. Arquitectura Híbrida del Sistema

El orquestador en Node.js clasificará el input y lo derivará al componente correspondiente:

### Componentes Locales (Coste $0 API)
- **Texto (Ollama + Mistral):** El orquestador llama a la API local de Ollama (`localhost:11434`) para generar respuestas.
- **Audio (Whisper.cpp):** Las notas de voz se procesan mediante un ejecutable local de Whisper.cpp para obtener la transcripción inmediata.
- **RAG (PostgreSQL + pgvector):** Búsqueda de similitud vectorial para inyectar conocimiento del negocio en el prompt de Mistral.

### Componentes en la Nube (GPU on-demand)
- **Visión (Qwen-VL):** Las imágenes se envían a un servidor remoto con GPU (vLLM) para descripción y análisis.

### Integración Lead Scoring
- Después de cada respuesta del LLM local, se evalúa el `intent_score` para segmentar la prioridad (Frío/Tibio/Caliente).

---

## 2. Segmentación de Atención por Prioridad

Se aplicará un clasificador (Lead Scorer) automatizado en tiempo real. Después de cada interacción, el LLM emite un `intent_score` (0-100) y señales (signals).

### Categorías de Prioridad
1. **Frío (0-20):** Consultas genéricas ("Hola", "¿A qué hora abren?"). El bot responde y etiqueta sin alertar a humanos.
2. **Tibio (21-50):** Interés en el catálogo ("¿Cuánto cuesta esto?", "¿Qué colores tienen?").
3. **Caliente (51-80):** Intención clara de compra o agenda ("Quiero reservar una cita", "¿Aceptan tarjeta?"). **Acción:** Notificación push inmediata al dashboard (Inbox) del equipo.
4. **Convertido (81-100):** Venta cerrada o agendada ("Ya realicé la transferencia", "Nos vemos mañana"). **Acción:** Actualización en el pipeline del CRM (Módulo Leads).

---

## 3. Cambios Propuestos en la Base de Datos

Actualizaremos el esquema en PostgreSQL (`omnipresence_erd_schema.html`):

### [MODIFY] Tabla `MESSAGES`
Agregaremos soporte para adjuntos multimodales en el campo `metadata`:
- `metadata.attachment_url` (URL de S3/R2)
- `metadata.attachment_type` ('audio', 'image')
- `metadata.transcript` (texto transcrito si fue audio)

### [MODIFY] Tabla `LEADS`
Añadiremos un nivel de prioridad de atención (urgencia):
- `attention_priority` ('low', 'medium', 'high', 'critical') basado en el tiempo transcurrido y el `intent_score`.

---

## 4. Fases de Desarrollo (Roadmap Híbrido)

### Fase 1: Fundación y RAG Local
- Configuración de **Docker** con PostgreSQL + pgvector.
- Instalación y test de **Ollama** con el modelo Mistral.
- Desarrollo del Orquestador Node.js (Express + Axios).

### Fase 2: Módulo de Audio Local
- Integración de **Whisper.cpp** mediante llamadas de sistema o binding de Node.
- Pruebas de transcripción de notas de voz de WhatsApp.

### Fase 3: Módulo de Visión Cloud
- Configuración de la instancia GPU (vLLM) para **Qwen-VL**.
- Conexión del orquestador a la API de visión remota.

### Fase 4: Omnicanalidad y CRM
- Integración de **WhatsApp API** (via Firebase/Meta Webhook).
- Implementación del Dashboard de control y visualización de Leads por prioridad.

---

## 5. Plan de Verificación

### Pruebas Automatizadas
- **Pruebas de RAG:** Alimentaremos el sistema con un catálogo dummy de una pizzería y haremos consultas vectoriales para validar la precisión del contexto inyectado.
- **Tests de NLP:** Enviaremos frases específicas para verificar que el `intent_score` se asigne correctamente (ej. "Solo mirando" -> Frío; "Paso a buscarlo a las 6pm" -> Caliente).

### Pruebas Manuales
- **Audio/Imagen:** Enviaremos notas de voz en formato OGG/MP3 al endpoint local y subiremos fotos de productos ficticios.
- **Llamadas:** Realizaremos llamadas a un número Twilio de prueba para validar latencia (objetivo: < 1.5s de tiempo de respuesta).
