# SKILL 06 — Frontend, UI y Componentes
## OmniPresence Suite · SaaS Multi-tenant

> **Propósito de este skill:** Define los patrones, convenciones y componentes del frontend de OmniPresence construido con Next.js 15 App Router. Cualquier código de UI, fetching de datos, formularios, estado o navegación debe seguir estas definiciones para garantizar consistencia en toda la aplicación.

---

## 1. Stack del frontend

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Next.js | 15 (App Router) | Framework principal |
| TypeScript | 5.x (strict) | Tipado completo |
| Tailwind CSS | 3.x | Estilos utilitarios |
| shadcn/ui | latest | Componentes base (sobre Radix UI) |
| TanStack Query | v5 | Fetching, caching, sincronización de datos |
| Zustand | v4 | Estado UI global mínimo |
| React Hook Form | v7 | Gestión de formularios |
| Zod | v3 | Validación de schemas (compartida con backend) |
| Recharts | v2 | Gráficas de analytics |
| Lucide React | latest | Iconografía |
| date-fns | v3 | Manipulación de fechas |

---

## 2. Estructura de archivos

```
apps/web/
├── app/                           ← App Router de Next.js
│   ├── (auth)/                    ← Grupo de rutas sin layout de dashboard
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── onboarding/
│   │       └── page.tsx           ← Flujo de 4 pasos con estado local
│   ├── (dashboard)/               ← Grupo con layout de sidebar + topbar
│   │   ├── layout.tsx             ← AuthGuard + Sidebar + Topbar + Alert Banner
│   │   ├── page.tsx               ← Redirect a /analytics
│   │   ├── analytics/
│   │   │   ├── page.tsx           ← Dashboard overview (Server Component)
│   │   │   └── [channelId]/
│   │   │       └── page.tsx       ← Drill-down por canal
│   │   ├── publish/
│   │   │   ├── page.tsx           ← Calendario de contenido
│   │   │   ├── new/
│   │   │   │   └── page.tsx       ← Nueva publicación
│   │   │   └── library/
│   │   │       └── page.tsx       ← Biblioteca de assets
│   │   ├── inbox/
│   │   │   ├── page.tsx           ← Lista de conversaciones
│   │   │   └── [conversationId]/
│   │   │       └── page.tsx       ← Conversación individual
│   │   ├── leads/
│   │   │   └── page.tsx           ← Kanban + tabla de leads
│   │   ├── bot/
│   │   │   └── page.tsx           ← Config del bot + knowledge base
│   │   └── settings/
│   │       ├── page.tsx           ← Ajustes generales de la org
│   │       ├── channels/
│   │       │   └── page.tsx       ← Canales conectados
│   │       ├── team/
│   │       │   └── page.tsx       ← Gestión de miembros
│   │       └── billing/
│   │           └── page.tsx       ← Plan y facturación
│   ├── api/
│   │   └── webhooks/
│   │       ├── meta/
│   │       │   └── route.ts       ← Webhook de Meta (POST + GET para verificación)
│   │       └── stripe/
│   │           └── route.ts       ← Webhook de Stripe
│   ├── layout.tsx                 ← Root layout: Providers + fonts
│   └── globals.css
│
├── components/
│   ├── ui/                        ← Componentes shadcn/ui (NO modificar directamente)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ... (generados por shadcn CLI)
│   ├── layout/                    ← Componentes de estructura
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   ├── alert-banner.tsx       ← Banner de alertas in-app
│   │   └── page-header.tsx
│   ├── analytics/                 ← Componentes del módulo Analytics
│   │   ├── kpi-card.tsx
│   │   ├── channel-metrics-row.tsx
│   │   ├── engagement-chart.tsx
│   │   └── post-performance-table.tsx
│   ├── publish/                   ← Componentes del módulo Content Hub
│   │   ├── upload-zone.tsx
│   │   ├── variant-grid.tsx
│   │   ├── caption-editor.tsx
│   │   ├── content-calendar.tsx
│   │   └── asset-library.tsx
│   ├── inbox/                     ← Componentes del módulo Inbox
│   │   ├── conversation-list.tsx
│   │   ├── message-bubble.tsx
│   │   ├── intent-badge.tsx
│   │   └── handoff-banner.tsx
│   ├── leads/                     ← Componentes del módulo Leads
│   │   ├── lead-kanban.tsx
│   │   ├── lead-card.tsx
│   │   └── lead-detail-modal.tsx
│   └── shared/                    ← Componentes reutilizables entre módulos
│       ├── empty-state.tsx
│       ├── error-state.tsx
│       ├── loading-skeleton.tsx
│       ├── confirm-dialog.tsx
│       └── plan-limit-banner.tsx
│
├── hooks/                         ← Custom hooks de React
│   ├── use-analytics.ts
│   ├── use-posts.ts
│   ├── use-leads.ts
│   ├── use-inbox.ts
│   ├── use-bot-config.ts
│   └── use-sse.ts                 ← Hook para Server-Sent Events
│
├── lib/                           ← Utilidades del frontend
│   ├── api-client.ts              ← Fetch wrapper con auth automática
│   ├── query-client.ts            ← Configuración de TanStack Query
│   ├── auth.ts                    ← Helpers de autenticación
│   ├── format.ts                  ← Formateo de fechas, moneda, números
│   └── constants.ts               ← Constantes del frontend
│
├── stores/                        ← Zustand stores
│   ├── auth-store.ts
│   └── ui-store.ts
│
└── types/                         ← Tipos TypeScript del frontend
    ├── api.ts                     ← Response shapes de la API (fuente de verdad)
    └── ui.ts                      ← Tipos específicos de UI
```

---

## 3. Autenticación en el cliente

### 3.1 Auth Store (Zustand)
```typescript
// stores/auth-store.ts
import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;           // En memoria — NUNCA en localStorage
  user: { id: string; name: string; email: string; role: string } | null;
  org: { id: string; name: string; plan: string; trialEndsAt: string | null } | null;
  setAuth: (token: string, user: AuthState['user'], org: AuthState['org']) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  org: null,
  setAuth: (accessToken, user, org) => set({ accessToken, user, org }),
  clearAuth: () => set({ accessToken: null, user: null, org: null }),
}));
```

### 3.2 Silent refresh del access token
```typescript
// lib/api-client.ts
// El refresh token vive en cookie httpOnly — no accesible desde JS
// El access token vive en memoria (Zustand) — se pierde al recargar

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // Singleton: si ya hay un refresh en curso, esperar al mismo
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include', // incluye la cookie httpOnly automáticamente
  })
    .then(res => res.json())
    .then(data => {
      useAuthStore.getState().setAuth(data.accessToken, data.user, data.org);
      return data.accessToken as string;
    })
    .finally(() => { refreshPromise = null; });

  return refreshPromise;
}

// Fetch wrapper con auth automática y retry en 401
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });

  if (response.status === 401) {
    // Token expirado — intentar refresh una sola vez
    try {
      const newToken = await refreshAccessToken();
      const retryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        },
        credentials: 'include',
      });
      if (!retryResponse.ok) throw await retryResponse.json();
      return retryResponse.json();
    } catch {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw error;
  }

  return response.json();
}
```

### 3.3 Auth Guard en el layout del dashboard
```typescript
// app/(dashboard)/layout.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, org } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      // Intentar refresh silencioso al cargar la página
      fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) useAuthStore.getState().setAuth(data.accessToken, data.user, data.org);
          else router.replace('/login');
        })
        .catch(() => router.replace('/login'));
    }
  }, []);

  if (!accessToken) return <LoadingFullscreen />;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        {org && isTrialActive(org) && <TrialBanner trialEndsAt={org.trialEndsAt!} />}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

---

## 4. Fetching de datos con TanStack Query

### 4.1 Configuración del QueryClient
```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutos antes de refetch automático
      gcTime: 1000 * 60 * 30,          // 30 minutos en caché tras dejar de usar
      retry: 2,
      refetchOnWindowFocus: false,     // No refetch al volver al tab — manual
    },
  },
});
```

### 4.2 Query keys — nomenclatura canónica
```typescript
// lib/query-keys.ts
// REGLA: los query keys son arrays tipados — nunca strings sueltos
// Jerarquía: [entidad, acción/filtro, parámetros]
// El orgId NO va en el query key — el servidor lo extrae del JWT

export const queryKeys = {
  // Analytics
  analytics: {
    overview: (period: string) => ['analytics', 'overview', period] as const,
    channel: (channelId: string, period: string) => ['analytics', 'channel', channelId, period] as const,
    posts: (channelId?: string, period?: string) => ['analytics', 'posts', { channelId, period }] as const,
  },
  // Canales
  channels: {
    list: () => ['channels'] as const,
    detail: (id: string) => ['channels', id] as const,
  },
  // Publicaciones
  posts: {
    list: (filters?: { status?: string; channelId?: string }) => ['posts', filters] as const,
    detail: (id: string) => ['posts', id] as const,
    calendar: (month: string) => ['posts', 'calendar', month] as const,
  },
  // Assets
  assets: {
    list: (filters?: { type?: string }) => ['assets', filters] as const,
    detail: (id: string) => ['assets', id] as const,
  },
  // Inbox
  inbox: {
    conversations: (filters?: { status?: string; channelId?: string }) =>
      ['inbox', 'conversations', filters] as const,
    conversation: (id: string) => ['inbox', 'conversations', id] as const,
  },
  // Leads
  leads: {
    list: (filters?: { status?: string; channelId?: string }) => ['leads', filters] as const,
    detail: (id: string) => ['leads', id] as const,
  },
  // Bot
  bot: {
    config: () => ['bot', 'config'] as const,
    knowledge: () => ['bot', 'knowledge'] as const,
  },
  // Org
  org: {
    detail: () => ['org'] as const,
    usage: () => ['org', 'usage'] as const,
    members: () => ['org', 'members'] as const,
  },
  // Alertas
  alerts: {
    list: () => ['alerts'] as const,
  },
} as const;
```

### 4.3 Custom hooks por módulo
```typescript
// hooks/use-analytics.ts
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { apiClient } from '@/lib/api-client';
import type { GetAnalyticsOverviewResponse } from '@/types/api';

export function useAnalyticsOverview(period: string) {
  return useQuery({
    queryKey: queryKeys.analytics.overview(period),
    queryFn: () =>
      apiClient<GetAnalyticsOverviewResponse>(`/analytics/overview?period=${period}`),
    // Los datos de analytics son costosos de generar — mantener en caché más tiempo
    staleTime: 1000 * 60 * 15, // 15 minutos
  });
}

// hooks/use-posts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePostInput) => apiClient<Post>('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      // Invalidar todas las queries de posts para refrescar listas y calendario
      qc.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
```

---

## 5. Formularios con React Hook Form + Zod

### Template estándar de formulario
```typescript
// Patrón aplicable a cualquier formulario del sistema
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from '@/components/ui/use-toast';

// 1. Definir schema Zod (reutilizable en el backend)
const createPostSchema = z.object({
  captionTemplate: z.string().min(1, 'El caption es requerido').max(2200, 'Máximo 2200 caracteres'),
  scheduledAt: z.string().datetime().optional(),
  channelIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos un canal'),
});

type CreatePostInput = z.infer<typeof createPostSchema>;

// 2. Componente del formulario
export function CreatePostForm() {
  const { mutate: createPost, isPending } = useCreatePost();

  const form = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      captionTemplate: '',
      channelIds: [],
    },
  });

  async function onSubmit(values: CreatePostInput) {
    createPost(values, {
      onSuccess: () => {
        toast({ title: 'Post programado exitosamente' });
        form.reset();
      },
      onError: (error: any) => {
        // Manejo de errores del servidor en el formulario
        if (error?.error?.code === 'PLAN_LIMIT_EXCEEDED') {
          toast({ title: 'Límite de plan alcanzado', description: error.error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Error al crear el post', description: error?.error?.message, variant: 'destructive' });
        }
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="captionTemplate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Caption</FormLabel>
              <FormControl>
                <textarea {...field} className="..." />
              </FormControl>
              <FormMessage />  {/* Muestra el error de Zod automáticamente */}
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Programando...' : 'Programar publicación'}
        </Button>
      </form>
    </Form>
  );
}
```

---

## 6. Estados de carga, error y vacío

```typescript
// components/shared/loading-skeleton.tsx
// Usar siempre Skeleton en lugar de spinners para listas y tablas
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 w-full rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}

// Patrón de uso en páginas
export default function LeadsPage() {
  const { data, isLoading, isError, error } = useLeadsList();

  if (isLoading) return <TableSkeleton rows={8} />;
  if (isError) return <ErrorState error={error} retry={() => refetch()} />;
  if (!data?.length) return <EmptyState
    title="Sin leads aún"
    description="Los leads aparecerán aquí cuando el bot empiece a recibir mensajes."
    action={{ label: 'Configurar bot', href: '/bot' }}
  />;

  return <LeadKanban leads={data} />;
}

// components/shared/error-state.tsx
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = (error as any)?.error?.message || 'Ocurrió un error inesperado';
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {retry && <Button variant="outline" onClick={retry}>Reintentar</Button>}
    </div>
  );
}
```

---

## 7. Tiempo real con Server-Sent Events

```typescript
// hooks/use-sse.ts
// Para: alertas en tiempo real, progreso de procesado de assets, nuevos mensajes del bot
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';

export function useSSE() {
  const qc = useQueryClient();
  const { accessToken } = useAuthStore();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const url = `${process.env.NEXT_PUBLIC_API_URL}/sse?token=${accessToken}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    // Alerta nueva
    es.addEventListener('alert', () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
    });

    // Nuevo mensaje entrante en el inbox
    es.addEventListener('new_message', (event) => {
      const { conversationId } = JSON.parse(event.data);
      qc.invalidateQueries({ queryKey: queryKeys.inbox.conversations() });
      qc.invalidateQueries({ queryKey: queryKeys.inbox.conversation(conversationId) });
    });

    // Asset procesado (variantes listas)
    es.addEventListener('asset_processed', (event) => {
      const { assetId } = JSON.parse(event.data);
      qc.invalidateQueries({ queryKey: queryKeys.assets.detail(assetId) });
    });

    es.onerror = () => {
      // Reconectar automáticamente después de 5 segundos
      setTimeout(() => es.close(), 5000);
    };

    return () => es.close();
  }, [accessToken]);
}
```

---

## 8. Tipos de respuesta de la API (fuente de verdad)

```typescript
// types/api.ts — Response shapes de todos los endpoints

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginResponse {
  accessToken: string;
  user: { id: string; name: string; email: string; role: 'owner'|'admin'|'member'|'viewer' };
  org: { id: string; name: string; plan: string; trialEndsAt: string | null };
}

// ── Analytics ────────────────────────────────────────────────────────────────
export interface GetAnalyticsOverviewResponse {
  period: { from: string; to: string };
  kpis: {
    totalReach: number;
    avgEngagementRate: number;
    totalLeads: number;
    costPerLead: number | null;
    totalSpend: number;
    totalConversions: number;
  };
  reachOverTime: Array<{ date: string; value: number }>;
  engagementOverTime: Array<{ date: string; value: number }>;
  topPosts: Array<{
    id: string;
    caption: string;
    platform: string;
    engagementRate: number;
    reach: number;
  }>;
  channels: ChannelSummary[];
}

export interface ChannelSummary {
  id: string;
  platform: string;
  username: string;
  followers: number;
  followersDelta: number;
  totalReach: number;
  avgEngagementRate: number;
  totalSpend: number;
  totalLeads: number;
  roas: number | null;
  isActive: boolean;
}

// ── Posts ────────────────────────────────────────────────────────────────────
export interface Post {
  id: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
  captionTemplate: string;
  platformCaptions: Record<string, string>;
  scheduledAt: string | null;
  publishedAt: string | null;
  author: { id: string; name: string } | null;
  assets: PostAsset[];
  accounts: PostAccount[];
  createdAt: string;
}

export interface PostAsset {
  id: string;
  assetType: 'image' | 'video' | 'carousel';
  variants: Array<{
    platform: string;
    format: string;
    width: number;
    height: number;
    url: string;          // URL firmada — expira en 15 minutos
  }>;
}

export interface PostAccount {
  id: string;
  platform: string;
  username: string;
  status: 'pending' | 'publishing' | 'published' | 'failed' | 'skipped';
  errorMessage: string | null;
  publishedAt: string | null;
}

// ── Leads ────────────────────────────────────────────────────────────────────
export interface Lead {
  id: string;
  platform: string;
  displayName: string;
  status: 'cold' | 'warm' | 'hot' | 'converted' | 'lost';
  intentScore: number;
  firstContactSource: string;
  firstContactAt: string;
  lastActivityAt: string;
  convertedAt: string | null;
  conversionValue: number | null;
  notes: string | null;
  conversationCount: number;
}

// ── Error estándar ────────────────────────────────────────────────────────────
export interface ApiError {
  error: {
    code: string;          // 'PLAN_LIMIT_EXCEEDED', 'UNAUTHORIZED', 'NOT_FOUND', etc.
    message: string;       // Mensaje legible para el usuario
    details?: unknown;     // Detalles adicionales de validación
    upgrade_url?: string;  // Solo presente en PLAN_LIMIT_EXCEEDED
  };
}

// ── Paginación ────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
```

---

## 9. Internacionalización y formateo

```typescript
// lib/format.ts
// Todas las fechas y monedas se formatean según la timezone y locale de la org

import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Usar siempre estas funciones — NUNCA new Date().toLocaleDateString() directamente

export function formatDate(dateStr: string, orgTimezone = 'America/La_Paz'): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es', {
    timeZone: orgTimezone,
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateStr: string, orgTimezone = 'America/La_Paz'): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es', {
    timeZone: orgTimezone,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('es', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('es');
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
```

---

## 10. UI Store (Zustand) — estado global mínimo

```typescript
// stores/ui-store.ts
// REGLA: solo estado que no puede vivir en el componente local
// No guardar aquí datos del servidor — eso es TanStack Query

import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  unreadAlertCount: number;
  setUnreadAlertCount: (count: number) => void;
  incrementUnreadAlerts: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),

  unreadAlertCount: 0,
  setUnreadAlertCount: (count) => set({ unreadAlertCount: count }),
  incrementUnreadAlerts: () => set(state => ({ unreadAlertCount: state.unreadAlertCount + 1 })),
}));
```

---

## 11. Reglas del frontend — no omitir

1. **Server Components por defecto** — usar `'use client'` solo cuando se necesite interactividad, hooks o eventos del navegador
2. **Todos los textos en español** — sin mezcla de idiomas en la UI
3. **El plan se lee de `org.plan` del auth store** — nunca hacer fetch adicional para esto
4. **`apiClient()` para todas las llamadas a la API** — nunca `fetch()` directo (sin auth automática)
5. **Los query keys son de `queryKeys.*`** — nunca strings hardcoded
6. **El `accessToken` solo vive en el auth store (memoria)** — nunca en `localStorage` ni `sessionStorage`
7. **Los URLs de assets (imágenes)** duran 15 minutos — no guardar en localStorage, pedir siempre vía la API que genera URLs firmadas frescas
8. **Los errores de la API siempre tienen forma `ApiError`** — usar el tipo, no hacer `.catch(e => e.message)`
9. **Skeleton, no spinner**, para estados de carga de listas y tablas
10. **No confirmar acciones destructivas sin `ConfirmDialog`** — delete de lead, desconectar canal, etc.

---

## Checklist del frontend — antes de cada PR

- [ ] Nuevo componente tiene manejo de loading, error y estado vacío
- [ ] Nuevos query keys en `queryKeys.*` (no strings sueltos)
- [ ] Mutaciones invalidan los queries relevantes con `invalidateQueries`
- [ ] Formularios usan `zodResolver` con schema tipado
- [ ] Fechas formateadas con `formatDate()` (no `Date.toLocaleDateString()`)
- [ ] Textos de UI en español
- [ ] No hay `localStorage` ni `sessionStorage` con datos de auth o sesión
- [ ] Server Component cuando no se necesita interactividad del cliente
- [ ] Errores del servidor manejados en `onError` de la mutación con toast descriptivo
