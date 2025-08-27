import js from "@eslint/js"
import { defineConfig } from "eslint/config"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import globals from "globals"
import tseslint from "typescript-eslint"

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": [
        "warn",
        {
          groups: [
            // Side effect imports
            ["^\\u0000"],
            // Packages. `react` related packages come first.
            ["^react", "^@?\\w"],
            // Aliases (adjust these regexes for your aliases)
            ["^@domain"],
            ["^@app"],
            ["^@presentation"],
            ["^@infra"],
            // Parent imports
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            // Relative imports
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
            // Style imports
            ["^.+\\.s?css$"],
          ],
        },
      ],
      "simple-import-sort/exports": "warn",
    },
  },
])
