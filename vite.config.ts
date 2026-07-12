import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Only expose safe, client-public variables to import.meta.env:
  //   VITE_*                    — manually added, intended for the client
  //   NEXT_PUBLIC_SUPABASE_*    — the URL + anon key injected by the Vercel
  //                               Supabase integration (safe for the browser)
  //
  // We deliberately do NOT use the broad `SUPABASE_` prefix here, because it
  // would also bundle server-only secrets such as SUPABASE_SERVICE_ROLE_KEY
  // and SUPABASE_JWT_SECRET into the public client bundle.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_SUPABASE_'],
  server: {
    allowedHosts: true,
  },
})
