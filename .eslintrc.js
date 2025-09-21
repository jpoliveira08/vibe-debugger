module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  root: true,
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off', // Allow any types for debugging tool
    '@typescript-eslint/no-inferrable-types': 'off',
    
    // General ESLint rules
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off',
    
    // Disable some rules that might conflict with TypeScript
    'no-undef': 'off',
    'no-unused-vars': 'off', // Use @typescript-eslint/no-unused-vars instead
  },
};
