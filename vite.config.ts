import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'relative-static-assets',
      generateBundle(_options, bundle) {
        for (const fileName in bundle) {
          const output = bundle[fileName];
          if (output.type === 'chunk') {
            output.code = output.code.split('/Assets/').join('./Assets/');
          }
        }
      },
    },
  ],
});
