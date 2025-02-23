import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: ['src/options_custom/**/*']
    },
    {
        files: ['**/*.js'],
        languageOptions: {sourceType: 'script'}
    },
    {
        languageOptions: { 
            globals: {
                ...globals.browser,
                ...globals.webextensions  // This adds chrome and other WebExtension APIs
            } 
        }
    },
    pluginJs.configs.recommended,
    {
        rules: {
            // Google-style
            'indent': ['error', 4],
            'linebreak-style': ['error', 'unix'],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],

            // Airbnb-style
            'no-unused-vars': 'error',
            'prefer-const': 'error',
            'arrow-body-style': ['error', 'as-needed'],

            // Microsoft-style
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'object-shorthand': ['error', 'always'],
            'prefer-template': 'error',
        }
    }
];