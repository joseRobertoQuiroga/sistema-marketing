# 🧠 Plan de Desarrollo - Bot Multimodal Híbrido (MVP)

## 🎯 Objetivo General
Construir un bot multimodal omnicanal capaz de procesar:
- Texto
- Audio (notas de voz)
- Imágenes

Con una arquitectura híbrida (local + nube) optimizada para:
- Bajo costo
- Escalabilidad
- Control total del sistema

---

# 🏗️ Arquitectura General

```
Usuario → Firebase Webhook → Backend Node.js (Orquestador)

→ Texto → LLM local (Ollama - Mistral)
→ Audio → Whisper.cpp → LLM
→ Imagen → Qwen-VL (GPU en nube)

→ RAG (PostgreSQL + pgvector)
→ Respuesta → Usuario
```

---

# 🧩 Componentes del Sistema

## 1. Backend (Node.js)
Responsable de:
- Recibir requests
- Clasificar tipo de input
- Orquestar modelos
- Integrar RAG

## 2. IA Local

### Texto
- Modelo: Mistral
- Runtime: Ollama

### Audio
- Modelo: Whisper.cpp

### Voz (opcional)
- Coqui TTS

## 3. IA en la Nube

### Imagen
- Modelo: Qwen-VL
- Runtime: vLLM
- Infraestructura: GPU (Google Cloud / RunPod)

## 4. Base de Datos

- PostgreSQL
- Extensión: pgvector

Funciones:
- Almacenamiento de embeddings
- Contexto conversacional

---

# 💻 Entorno Local (Desarrollo)

## Requisitos mínimos
- CPU: 4 cores
- RAM: 16GB (ideal 32GB)
- GPU: opcional

## Instalación base

```bash
sudo apt update
sudo apt install docker.io ffmpeg git -y
```

---

## Instalar Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull mistral
```

---

## Instalar Whisper.cpp

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make
./models/download-ggml-model.sh base
```

---

## Instalar PostgreSQL + pgvector

```bash
sudo apt install postgresql postgresql-contrib -y
```

Dentro de PostgreSQL:

```sql
CREATE EXTENSION vector;
```

---

# ☁️ Infraestructura en la Nube

## GPU Instance

- Tipo: g2-standard-4
- GPU: NVIDIA L4
- OS: Ubuntu 22.04

---

## Instalación

```bash
sudo apt update
sudo apt install python3-pip -y
pip install vllm transformers accelerate
```

---

## Ejecutar modelo Qwen-VL

```bash
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen-VL-Chat \
  --port 8000
```

---

# 🔗 Backend - Orquestador

## Instalación

```bash
npm init -y
npm install express axios multer
```

---

## Lógica principal

```js
async function processInput(input) {
  if (input.type === "text") {
    return await queryLLM(input.text);
  }

  if (input.type === "audio") {
    const text = await transcribe(input.file);
    return await queryLLM(text);
  }

  if (input.type === "image") {
    return await queryVision(input.file);
  }
}
```

---

# 🔄 Flujo de Ejecución

1. Usuario envía mensaje
2. Firebase recibe webhook
3. Backend procesa request
4. Clasifica input
5. Llama modelo correspondiente
6. Consulta RAG
7. Genera respuesta
8. Devuelve respuesta

---

# 🧠 RAG (Memoria Inteligente)

## Flujo

1. Convertir texto a embedding
2. Guardar en pgvector
3. Buscar contexto relevante
4. Inyectar en prompt

---

# 💸 Optimización de Costos

- Usar GPU solo para imágenes
- Apagar instancias cuando no se usen
- Cachear respuestas frecuentes
- Usar modelos ligeros localmente

---

# 🚀 Roadmap de Desarrollo

## Fase 1
- Bot texto
- RAG funcional

## Fase 2
- Audio (Whisper)

## Fase 3
- Imagen (Qwen-VL)

## Fase 4
- Voz (TTS)

## Fase 5
- Escalado y optimización

---

# 🎯 Resultado Esperado

- Bot multimodal funcional
- Arquitectura híbrida
- Bajo costo operativo
- Escalable

---

# 🧩 Próximos pasos

- Implementar Docker
- Integrar WhatsApp API
- Crear dashboard de control
- Añadir sistema de leads

---

# ✅ Conclusión

Este sistema permite desarrollar un producto SaaS robusto, escalable y optimizado, manteniendo control sobre la infraestructura y reduciendo costos mediante una arquitectura híbrida inteligente.

