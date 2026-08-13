import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // The Passport callback MUST leave by a full document load (`window.location.replace`).
    // `store.tsx` subscribes `onAuthStateChange` on the client named by the provider cookie at
    // hydration only, and this page arrives with that cookie still reading `app-native` — a
    // client-side navigation leaves the store bound to the wrong Supabase project, so no
    // SIGNED_IN arrives and `AuthGuard` bounces the user to /login on a session that is valid.
    // It presents as "SSO is broken" and nothing logs. Enforced at edit time here; also pinned
    // behaviourally by `page.test.tsx`.
    files: ["src/app/auth/passport-callback/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/navigation",
              message:
                "The Passport callback must leave via window.location.replace (a full page load), never a Next router navigation. See the comment in page.tsx.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
