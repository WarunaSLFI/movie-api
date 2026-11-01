const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/"] },
  js.configs.recommended,
  {
    // Server code: Node.js, CommonJS (require / module.exports)
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      // Express error handlers need all four parameters, even if next is unused
      "no-unused-vars": ["error", { argsIgnorePattern: "^next$" }],
    },
  },
];
