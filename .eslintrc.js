module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'      // jen built-in JS pravidla
    //'plugin:prettier/recommended'
  ],
  rules: {
    'no-console': 'off'
    //'prettier/prettier': 'error',
  }
};
