import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env files (.env, .env.local, etc.) for the current mode without a
  // prefix filter so we can also see NEXT_PUBLIC_* / SUPABASE_* style vars.
  const fileEnv = loadEnv(mode, process.cwd(), "");

  // Merge file-based env with process.env (where the hosting platform /
  // integration injects credentials). process.env wins so deploy-time vars
  // are respected.
  const env = { ...fileEnv, ...process.env };

  // The Supabase client reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
  // The Supabase integration provides these under NEXT_PUBLIC_* / SUPABASE_*
  // names, so we normalize them here and expose them to the client bundle.
  const supabaseUrl =
    env.VITE_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL ||
    "";

  const supabaseAnonKey =
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    "";

  if (!supabaseUrl || !supabaseAnonKey) {
    // Surface a clear warning at startup instead of a silent runtime failure.
    console.warn(
      "[vite] Supabase env vars are missing. Expected VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY " +
        "(or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Database calls will fail."
    );
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "framer-motion", "lucide-react"],
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
    },
  };
});
