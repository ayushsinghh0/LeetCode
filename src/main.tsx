import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import './index.css';
import { LocalStorageAdapter } from '@/services/storage/LocalStorageAdapter';
import { createPersistenceMiddleware, loadInitialState } from '@/services/storage/persistence';
import { makeStore } from '@/store/store';

// Hydrate from localStorage before the store (and therefore the first render) exists, so the UI
// never flashes empty state before swapping in persisted progress.
const storageAdapter = new LocalStorageAdapter();
const preloadedState = loadInitialState(storageAdapter);
const store = makeStore(preloadedState, [createPersistenceMiddleware(storageAdapter)]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
