import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend imports ../utils/validation.js (shared with the API), so Vite
// must be allowed to read files from the project root, which it is by default.
export default defineConfig({ plugins: [react()] });
