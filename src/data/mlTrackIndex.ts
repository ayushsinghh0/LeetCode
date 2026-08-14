/**
 * The bundle boundary for the ML implementation tracks.
 *
 * The track and project CONTENT — derivations, checklists, measured experiments, failure modes —
 * is ~275 kB and lives in the `data-ml` chunk, loaded by /aiml and nothing else. But the app
 * chunk needs three tiny facts about it: which tracks exist, what they are called (the day plan
 * names a due rebuild), and which rungs a track has. Importing `@/data/mlTracks` to get them made
 * `data-ml` a static import of the app chunk, which put the whole 275 kB on the Dashboard's
 * critical path — the exact thing the performance contract forbids.
 *
 * So these three facts are restated here, and `mlTrackIndex.test.ts` pins every one of them
 * against the real dataset. Duplication that a test proves identical is not drift; duplication
 * nobody checks is. If the generator adds, removes or renames a track, that test fails.
 */

/** The five rungs every track has, in progression order. */
export const ML_RUNG_IDS = ['math', 'scratch', 'library', 'experiment', 'failure'] as const;

export type MlRungId = (typeof ML_RUNG_IDS)[number];

export const ML_TRACK_TITLES: Record<string, string> = {
  'linear-regression': 'Linear Regression',
  'logistic-regression': 'Logistic Regression',
  'gradient-descent': 'Gradient Descent',
  'k-means': 'K-Means Clustering',
  pca: 'Principal Component Analysis',
  'decision-tree': 'Decision Tree (CART)',
  'naive-bayes': 'Naive Bayes by Counting',
  'neural-network': 'A Two-Layer Neural Network from Scratch',
  backpropagation: 'Backpropagation and Gradient Checking',
  attention: 'Scaled Dot-Product Attention',
  transformer: 'A Decoder-Only Transformer',
};

export const ML_TRACK_IDS: string[] = Object.keys(ML_TRACK_TITLES);

export const ML_PROJECT_IDS: string[] = [
  'california-housing-beat-the-mean',
  'breast-cancer-operating-point',
  'telco-churn-messy-data',
  'creditcard-fraud-extreme-imbalance',
  'bike-demand-end-to-end-service',
  'movielens-two-stage-recommender',
  'mlp-from-scratch-fashion-mnist',
  'cnn-cifar10-overfitting-budget',
  'char-transformer-from-scratch',
  'distilbert-imdb-finetune',
  'scifact-rag-beat-bm25',
  'llm-eval-harness-calibrated-judge',
  'churn-service-with-drift-monitoring',
  'llm-endpoint-cost-and-observability',
];

export const isMlTrackId = (id: string): boolean => id in ML_TRACK_TITLES;
export const isMlRungId = (id: string): boolean => (ML_RUNG_IDS as readonly string[]).includes(id);
export const isMlProjectId = (id: string): boolean => ML_PROJECT_IDS.includes(id);
