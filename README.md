# Test Manager

Plataforma para gestión de testing manual. Permite organizar casos de test por proyectos e historias de usuario, ejecutar test runs con seguimiento en tiempo real y consultar reportes históricos por rol.

## Stack

- **Frontend:** React + Vite + TypeScript + Ant Design
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** Vercel (frontend) / Supabase Cloud (backend)

## Funcionalidades

- Autenticación con email y contraseña
- Proyectos con historias de usuario y casos de test
- Roles de la app testeada para filtrar y organizar casos
- Test runs con filtro por rol y opción de excluir casos ya aprobados
- Ejecución de tests: Pass / Fail / Bloqueado / Omitido + comentarios
- Reportes por run con métricas y filtros
- Historial de runs por historia de usuario con estado actual por caso
- Importación masiva desde CSV

## Desarrollo local

### Requisitos

- Node.js 20+
- Cuenta en [Supabase](https://supabase.com)

### Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 3. Levantar servidor de desarrollo
npm run dev
```

### Variables de entorno

| Variable                 | Descripción                    |
| ------------------------ | ------------------------------ |
| `VITE_SUPABASE_URL`      | URL del proyecto Supabase      |
| `VITE_SUPABASE_ANON_KEY` | Clave anon/pública de Supabase |

## Deploy en Vercel

1. Subir el repositorio a GitHub
2. Conectar el repo en [vercel.com](https://vercel.com)
3. Agregar las variables de entorno en la configuración del proyecto
4. Deploy automático en cada push a `main`

## Importar casos de test desde CSV

Para cargar casos masivamente se necesita la **service role key** del proyecto Supabase (Settings → API).

```bash
export SUPABASE_SERVICE_KEY=tu_service_role_key

node scripts/import-csv.mjs <project_id> archivo.csv
```

### Formato del CSV

```csv
user_story,title,description,steps,expected_result,roles
"Login","Login exitoso","El usuario puede ingresar","1. Ir a /login\n2. Ingresar credenciales\n3. Click Ingresar","Redirige al dashboard","Cajero,Supervisor"
"Caja","Abrir caja","","1. Ir a Caja\n2. Ingresar monto inicial","Caja queda abierta","Cajero"
```

| Columna           | Requerido | Descripción                                       |
| ----------------- | --------- | ------------------------------------------------- |
| `user_story`      | Sí        | Nombre de la historia (se crea si no existe)      |
| `title`           | Sí        | Título del caso de test                           |
| `description`     | No        | Descripción opcional                              |
| `steps`           | No        | Pasos separados por `\n`                          |
| `expected_result` | No        | Resultado esperado                                |
| `roles`           | No        | Roles separados por coma (se crean si no existen) |

## Estructura del proyecto

```
src/
  components/
    AppLayout.tsx       # Layout con sidebar de navegación
  pages/
    Login.tsx           # Pantalla de autenticación
    Projects.tsx        # Lista de proyectos
    ProjectDetail.tsx   # Historias, casos, runs y reportes
    RunExecution.tsx    # Ejecución de un test run
    RunReport.tsx       # Reporte detallado de un run
  lib/
    supabase.ts         # Cliente Supabase
    types.ts            # Tipos generados de la DB
scripts/
  import-csv.mjs        # Importador de casos desde CSV
```

## Modelo de datos

```
projects
└── app_roles           (roles de la app testeada: Cajero, Supervisor, etc.)
└── user_stories
    └── test_cases
        └── test_case_roles  (qué roles ejecutan cada caso)

test_runs               (una sesión de testing, con filtro de rol opcional)
└── test_results        (resultado por caso: pending/pass/fail/blocked/skipped)
```
