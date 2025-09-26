import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupPluginRules } from '@eslint/compat';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import stylistic from '@stylistic/eslint-plugin';
import functional from 'eslint-plugin-functional';
import importX from 'eslint-plugin-import-x';
import noDirectExportOfImports from 'eslint-plugin-no-direct-export-of-imports';
import noSecrets from 'eslint-plugin-no-secrets';
import preferArrow from 'eslint-plugin-prefer-arrow';
import sonarjs from 'eslint-plugin-sonarjs';
import sortKeysCustomOrder from 'eslint-plugin-sort-keys-custom-order';
import typescriptEnum from 'eslint-plugin-typescript-enum';
import unicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default [
    {
        ignores: ['dist/**', 'dist-tests/**', 'node_modules/**', 'eslint.config.mjs'],
    },
    {
        files: ['**/*.{cjs,js,mjs,ts,cts,mts}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: ['./tsconfig.json', './tsconfig.test.json'],
                tsconfigRootDir,
                sourceType: 'module',
            },
            globals: {
                ...globals.node,
            },
        },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.mjs', '.ts', '.cts', '.mts'],
                },
            },
        },
        plugins: {
            '@eslint-community/eslint-comments': eslintComments,
            '@typescript-eslint': fixupPluginRules(typescriptEslint),
            '@stylistic': fixupPluginRules(stylistic),
            functional: fixupPluginRules(functional),
            import: importX,
            'no-direct-export-of-imports': noDirectExportOfImports,
            'no-secrets': noSecrets,
            'prefer-arrow': preferArrow,
            sonarjs,
            'sort-keys-custom-order': sortKeysCustomOrder,
            'typescript-enum': typescriptEnum,
            unicorn,
            'unused-imports': unusedImports,
        },
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
        rules: {
            '@eslint-community/eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
            '@eslint-community/eslint-comments/no-duplicate-disable': 'error',
            '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
            '@eslint-community/eslint-comments/no-unused-disable': 'error',
            '@eslint-community/eslint-comments/no-unused-enable': 'error',
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
            '@stylistic/semi': ['error', 'always'],
            '@typescript-eslint/array-type': ['error', { default: 'array' }],
            '@typescript-eslint/consistent-type-assertions': [
                'error',
                {
                    assertionStyle: 'as',
                    objectLiteralTypeAssertions: 'allow-as-parameter',
                },
            ],
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    disallowTypeAnnotations: false,
                },
            ],
            '@typescript-eslint/explicit-function-return-type': [
                'error',
                {
                    allowDirectConstAssertionInArrowFunctions: true,
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                },
            ],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/prefer-readonly': ['error', { onlyInlineLambdas: true }],
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            'functional/immutable-data': [
                'error',
                {
                    ignoreClasses: true,
                    ignoreAccessorPattern: ['**.current'],
                },
            ],
            'functional/prefer-immutable-types': [
                'error',
                {
                    enforcement: 'ReadonlyShallow',
                    ignoreClasses: true,
                    ignoreInferredTypes: true,
                },
            ],
            'functional/type-declaration-immutability': 'off',
            'import/no-default-export': 'error',
            'import/no-extraneous-dependencies': 'error',
            'import/order': [
                'error',
                {
                    groups: [
                        ['builtin', 'external'],
                        ['internal', 'parent', 'sibling', 'index'],
                    ],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'no-direct-export-of-imports/no-direct-export-of-imports': 'error',
            'no-secrets/no-secrets': ['warn', { tolerance: 5 }],
            'prefer-arrow/prefer-arrow-functions': [
                'error',
                {
                    disallowPrototype: true,
                    singleReturnOnly: false,
                    classPropertiesAllowed: false,
                },
            ],
            'sonarjs/cognitive-complexity': ['warn', 15],
            'prefer-arrow/prefer-arrow-functions': 'off',
            'sort-keys-custom-order/object-keys': [
                'error',
                {
                    orderedKeys: ['id'],
                },
            ],
            'functional/prefer-immutable-types': 'off',
            'typescript-enum/no-enum': 'warn',
            'functional/immutable-data': 'off',
            'unicorn/no-abusive-eslint-disable': 'error',
            'unicorn/no-array-for-each': 'warn',
            'unicorn/no-null': 'off',
            'unicorn/prefer-logical-operator-over-ternary': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        files: ['**/*.test.ts'],
        languageOptions: {
            globals: {
                ...globals.mocha,
            },
        },
        rules: {
            'functional/immutable-data': 'off',
            'functional/prefer-immutable-types': 'off',
            'functional/type-declaration-immutability': 'off',
        },
    },
];
