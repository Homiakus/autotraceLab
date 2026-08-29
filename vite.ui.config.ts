import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/labtrace-ui',
    lib: {
      entry: path.resolve(__dirname, 'src/labtrace/index.ts'),
      name: 'LabTraceUI',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'lucide-react', 'motion'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
