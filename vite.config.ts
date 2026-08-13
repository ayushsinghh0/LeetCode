/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app-code edits stop invalidating the framework bytes in
        // users' caches, and the browser fetches these in parallel with the app chunk.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', 'react-redux', '@reduxjs/toolkit'],
          'vendor-motion': ['framer-motion'],
          // The curriculum: 539 questions with their authored teaching content, plus the family,
          // sub-pattern and company tables. It is immutable between releases and roughly a third
          // of what used to be the app chunk, so pinning it here means shipping an app fix stops
          // invalidating the dataset in every user's cache — and the browser fetches the two in
          // parallel instead of blocking on one large file.
          'data-curriculum': [
            './src/data/questions.json',
            './src/data/families.json',
            './src/data/subpatterns.json',
            './src/data/companies.json',
          ],
          // The ML curriculum: 11 from-scratch implementation tracks and the 14-project ladder,
          // ~180 kB of authored content with measured figures in it. Same reasoning as
          // data-curriculum, and a separate chunk rather than an addition to it because only the
          // /aiml route reads it — a learner who never opens the AI/ML track never fetches it,
          // and an edit to either dataset leaves the other one valid in every cache.
          'data-ml': ['./src/data/mlTracks.json', './src/data/mlProjects.json'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
});
