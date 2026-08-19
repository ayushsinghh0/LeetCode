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
          // plus the 130 course recall prompts behind "Check yourself" — ~270 kB of authored
          // content with measured figures in it. Same reasoning as data-curriculum, and a
          // separate chunk rather than an addition to it because only the /aiml route reads it —
          // a learner who never opens the AI/ML track never fetches it, and an edit to either
          // dataset leaves the other one valid in every cache. courseRecall.json belongs here
          // rather than in data-curriculum for exactly that reason: it is reachable only from
          // /aiml (courseRecall.ts → AimlCoursePage/CourseWeekRow), so filing it with the
          // questions dataset would ship 92 kB of ML content to every DSA-only session.
          'data-ml': [
            './src/data/mlTracks.json',
            './src/data/mlProjects.json',
            './src/data/courseRecall.json',
          ],
          // The contest library: 2,561 rated contest problems with their LeetCode topics and
          // mapped AICM patterns. Dictionary-encoded by the generator because the naive object
          // form measured 1,232.9 kB against this 336 kB — the difference between shippable and
          // not, given the app chunk's ~20 kB of headroom.
          //
          // Its own chunk rather than an addition to data-curriculum for the data-ml reason: only
          // the Contest Practice route reads it, so a learner who never opens contest practice
          // never fetches it, and re-running the ingestion leaves the 539-question dataset valid
          // in every cache. The store must reach contest problems through
          // src/data/contestLibraryIndex.ts, never through this chunk.
          'data-contests': ['./src/data/contestLibrary.json'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    // The first test in a worker that mounts a heavy lazy route (routes.test's Analytics pulls
    // recharts; the shell tests pull the whole app graph) pays that chunk's transform while every
    // other worker is doing the same. In isolation those are sub-second; at peak contention they
    // have been measured past 18s. This is a KILL CEILING, not an assertion — it exists to stop a
    // genuinely hung test, and it must sit above every per-query `findBy` window in the suite
    // (the largest is routes.test's CHUNK_TIMEOUT at 8s) or it silently truncates the wait a
    // query asked for, which is how this suite's "flakes" were manufactured.
    testTimeout: 30_000,
  },
});
