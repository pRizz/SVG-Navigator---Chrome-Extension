import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: [
            'web-ext-artifacts/**/*',
            'src/js/buildInfo.ts',
            'node_modules/**/*',
            'dist/**/*',
            'packages/**/*',
            '.build/**/*',
            'test-results/**/*',
            // Apple's Safari app template, not extension code
            'safari/**/*'
        ]
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                // Extension code and Node code have separate tsconfigs (different globals and module rules).
                project: ['./tsconfig.json', './tsconfig.node.json'],
                tsconfigRootDir: import.meta.dirname
            }
        }
    },
    {
        // Tool config files stay JavaScript because their tools load them directly.
        files: ['**/*.{js,mjs,cjs}'],
        ...tseslint.configs.disableTypeChecked
    },
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.webextensions  // This adds chrome and other WebExtension APIs
            }
        }
    },
    {
        // Node-side tooling: tests, build/release scripts, and config files.
        files: ['test/**/*.ts', 'scripts/**/*.ts', '**/*.{js,mjs,cjs}'],
        languageOptions: { globals: { ...globals.node } }
    },
    {
        files: ['test/**/*.ts'],
        rules: {
            // node:test's describe/test return promises that the runner itself awaits.
            '@typescript-eslint/no-floating-promises': ['error', {
                allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['describe', 'suite', 'test', 'it'] }]
            }]
        }
    },
    {
        files: ['**/*.cjs'],
        languageOptions: { sourceType: 'commonjs' }
    },
    {
        rules: {
            // Google-style
            'indent': ['error', 4],
            'linebreak-style': ['error', 'unix'],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],

            // Airbnb-style
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'error',
            'prefer-const': 'error',
            'arrow-body-style': ['error', 'as-needed'],

            // Microsoft-style
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'object-shorthand': ['error', 'always'],
            'prefer-template': 'error',

            // Custom
            // Space before blocks
            'space-before-blocks': ['error', 'always'],
            // Space before function parentheses
            'space-before-function-paren': ['error', {
                'anonymous': 'always',
                'named': 'never',
                'asyncArrow': 'always'
            }],
            // No multiple empty lines
            'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
            // Space inside braces
            'object-curly-spacing': ['error', 'always'],
            // Consistent spacing in comments
            'spaced-comment': ['error', 'always'],
            // No trailing spaces
            'no-trailing-spaces': 'error'
        }
    }
];
