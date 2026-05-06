# EduAula — Frontend

Aula virtual para colegios. Frontend en **Angular 21** (standalone components +
signals) que consume el backend NestJS de
[`backendcapstone`](https://github.com/UturuncoAaron/backendcapstone).

---

## Arquitectura

El código está organizado en **capas** con dependencias unidireccionales. Las
reglas se hacen cumplir vía `eslint-plugin-boundaries` (ver `eslint.config.js`).

```
src/app/
├─ core/               capa baja: auth, services HTTP, guards, models globales
├─ shared/             componentes y pipes reutilizables (depende de core)
├─ features/           dominios de negocio (cada uno autocontenido)
│  └─ <feature>/
│     ├─ <feature>.routes.ts          rutas lazy de la feature
│     ├─ data-access/                 capa de datos
│     │  ├─ <feature>.store.ts        signals + lógica
│     │  ├─ <feature>.service.ts      HTTP only (cuando aplique)
│     │  └─ <feature>.types.ts        tipos del dominio (cuando aplique)
│     ├─ pages/                       smart components (routed)
│     │  └─ <page>/
│     │     ├─ <page>.ts
│     │     ├─ <page>.html
│     │     └─ <page>.scss
│     ├─ ui/                          dumb components reutilizables
│     └─ dialogs/                     MatDialogs
├─ layouts/            shells de la app (main / login / etc.)
└─ environments/       config por entorno
```

### Reglas de dependencia

| Desde      | Puede importar |
|------------|----------------|
| `core`     | (nada interno — solo libs externas) |
| `shared`   | `core`, `environments` |
| `features` | `core`, `shared`, otras `features`, `environments` |
| `layouts`  | `core`, `shared`, `features`, `environments` |
| `app.*`    | todo |
| `environments` | (nada) |

**ESLint las verifica automáticamente** en cada commit. Hoy las violaciones se
reportan como `warning` para no bloquear migraciones; subir a `error` cuando el
codebase legado esté limpio.

### Roles y permisos

El backend tiene **6 roles**: `alumno`, `padre`, `admin`, `docente`, `auxiliar`,
`psicologa`. La UI los agrupa en **3 macro-roles** (ver
`src/app/core/auth/roles.ts`):

- **`alumno`** — el estudiante (vista personal: cursos, notas, libreta).
- **`padre`** — apoderados (portal con sus hijos).
- **`staff`** — `admin + docente + auxiliar + psicologa` comparten el shell de
  la app y el sidebar; lo que cada staff ve dentro se filtra por **permisos
  por módulo** (`MODULO` enum + `permissionGuard`).

`AuthService` expone:

```ts
auth.isAlumno() / isPadre() / isAdmin() / isDocente() / isAuxiliar() / isPsicologa()
auth.isStaff()      // true si admin|docente|auxiliar|psicologa
auth.macroRol()     // 'alumno' | 'padre' | 'staff' | null
```

Regla de uso: usá `isStaff()` para decisiones del shell/layout; usá los roles
individuales (`isAdmin() || isDocente()`) cuando la granularidad importa
(p. ej. solo docentes y admins editan contenido del curso).

### Path aliases

Para imports más cortos y estables ante refactors, `tsconfig.json` define:

| Alias       | Apunta a                |
|-------------|-------------------------|
| `@core/*`   | `src/app/core/*`        |
| `@shared/*` | `src/app/shared/*`      |
| `@features/*` | `src/app/features/*`  |
| `@layouts/*` | `src/app/layouts/*`    |
| `@env/*`    | `src/environments/*`    |

> Nuevo código: usar siempre los aliases. Código legado se migra
> oportunísticamente al tocar cada archivo.

---

## Setup local

```bash
npm ci                # instala dependencias
npm start             # ng serve en http://localhost:4200/
```

El backend espera correr en `http://localhost:3000/` (configurable en
`src/environments/environment.ts`).

## Comandos

```bash
npm start             # dev server con HMR
npm run build         # build de producción
npm run watch         # build incremental para desarrollo
npm run lint          # ESLint sobre todo el código
```

### Calidad

- **TypeScript estricto**: `strict: true`, `noUnusedLocals`,
  `noUnusedParameters`, `noImplicitReturns`. Ver `tsconfig.json`.
- **ESLint**: angular-eslint + typescript-eslint + boundaries.
  - 0 errores requeridos para mergear.
  - Warnings se atienden de forma incremental.

## Convenciones

### Componentes

- **Standalone components** siempre. No `NgModule`.
- **Signals + computed** para estado. Solo usar `BehaviorSubject` o RxJS si
  es estrictamente necesario (ej. interop con `HttpClient`).
- **`ChangeDetectionStrategy.OnPush`** por defecto en componentes nuevos.
- **`inject()` function** sobre constructor injection.

### Stores y servicios

- `*.store.ts` — estado con signals + lógica de negocio.
- `*.service.ts` — solo HTTP (devuelve `Observable<T>` o `Promise<T>`).
- El componente solo habla con el store; el store habla con el service.

### Naming

- Archivos de página: `<page>.ts` (no `<page>.component.ts`).
- Archivos de store: `<feature>.store.ts`.
- Archivos de service: `<feature>.service.ts`.
- Selectores de componente: `app-<kebab>`.
- Clases: `PascalCase` (ej. `MyTutoring`, `CourseStore`).

---

## Build

`npm run build` deja el bundle en `dist/colegio/`.

## Licencia

Privado — uso interno del colegio.
