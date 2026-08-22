import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";
import promisePlugin from "eslint-plugin-promise";
import prettierConfig from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "src/prisma/migrations/**"],
  },
  // Must precede the rule block below: eslint-config-prettier switches off
  // `curly` along with the formatting rules, and this repo wants it on.
  prettierConfig,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mjs", "**/*.mts"],
    plugins: {
      promise: promisePlugin,
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": ["error", "properties"],
      "promise/prefer-await-to-then": "error",
      "promise/prefer-await-to-callbacks": "off",
      "@typescript-eslint/array-type": ["error", { default: "array" }],
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "never",
        },
      ],
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        { accessibility: "explicit" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "id-denylist": [
        "error",
        "cfg",
        "ctx",
        "mgr",
        "svc",
        "evt",
        "res",
        "req",
        "msg",
        "acc",
        "val",
        "idx",
        "tmp",
        "obj",
        "arr",
        "num",
        "str",
        "fn",
      ],
    },
  },
  {
    files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/explicit-member-accessibility": "off",
    },
  },
];

export default eslintConfig;
