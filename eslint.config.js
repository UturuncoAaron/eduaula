// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const boundaries = require('eslint-plugin-boundaries');

/**
 * Reglas de arquitectura: imports permitidos por capa.
 *
 *   core     ← capa baja, no depende de nadie internamente.
 *   shared   ← puede importar core.
 *   features ← pueden importar core, shared y, eventualmente, otras features
 *              cruzadas (lo permitimos pero lo monitoreamos).
 *   layouts  ← pueden importar core, shared y features.
 *   app      ← raiz, puede importar todo.
 *
 * Esto previene que `core/` empiece a depender de `features/` (lo que romperia
 * la regla de capas) y que `shared/` se vuelva un cajon de sastre con logica
 * de negocio. Las violaciones se reportan como warnings al principio para no
 * frenar la migracion; subir a error cuando todo el codebase cumpla.
 */
const elements = [
  { type: 'core', pattern: 'src/app/core/**' },
  { type: 'shared', pattern: 'src/app/shared/**' },
  { type: 'features', pattern: 'src/app/features/**' },
  { type: 'layouts', pattern: 'src/app/layouts/**' },
  { type: 'app', pattern: 'src/app/*.ts' },
  { type: 'env', pattern: 'src/environments/**' },
];

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'boundaries/include': ['src/**/*.ts'],
    },
    processor: angular.processInlineTemplates,
    rules: {
      // ── Angular conventions ─────────────────────────────────
      // Directivas legadas (`hasModulo`, `hasRole`) sin prefijo `app`;
      // bajamos a warn hasta que se renombren.
      '@angular-eslint/directive-selector': [
        'warn',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],

      // ── Tipos ────────────────────────────────────────────────
      // Las APIs externas del backend devuelven JSON sin contrato fuerte.
      // Hoy hay ~100 `any` en el codebase legado; bajamos a `warn` para no
      // bloquear la migracion. Subir a `error` cuando se hagan los DTOs.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // ── Estilo legado: bajar a warn ─────────────────────────
      // Hay codigo viejo con inyeccion por constructor y selectores sin
      // prefijo `app`. Bajamos a warning; los nuevos componentes deberian
      // usar inject() y prefijo correcto.
      '@angular-eslint/prefer-inject': 'warn',
      '@angular-eslint/no-output-native': 'warn',

      // ── Boundaries (arquitectura) ───────────────────────────
      'boundaries/no-unknown': 'off',
      'boundaries/element-types': [
        'warn',
        {
          default: 'disallow',
          rules: [
            // core no importa nada interno (solo libs externas).
            { from: 'core', allow: [] },
            // shared puede importar core.
            { from: 'shared', allow: ['core', 'env'] },
            // features pueden importar core, shared, env, y otras features.
            { from: 'features', allow: ['core', 'shared', 'features', 'env'] },
            // layouts pueden importar core, shared, features y env.
            { from: 'layouts', allow: ['core', 'shared', 'features', 'env'] },
            // app es la raiz, puede importar todo.
            { from: 'app', allow: ['core', 'shared', 'features', 'layouts', 'env'] },
            // env no importa nada del codigo.
            { from: 'env', allow: [] },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // Templates legados con muchos warnings de a11y. Mantener como warning
      // para que se vean en CI sin bloquear, y atacarlos por feature.
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
      '@angular-eslint/template/label-has-associated-control': 'warn',
      '@angular-eslint/template/eqeqeq': 'warn',
    },
  },
]);
