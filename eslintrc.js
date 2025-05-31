'use strict';

module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'script'
  },
  rules: {
    // Allow console.* (we wrap it inside logger.js)
    'no-console': 'off',
    // Enforce strict mode globally
    strict: ['error', 'global'],
    // Example: require semicolons
    'semi': ['error', 'always'],
    // Example: enforce single quotes
    'quotes': ['error', 'single', { avoidEscape: true }]
  }
};
