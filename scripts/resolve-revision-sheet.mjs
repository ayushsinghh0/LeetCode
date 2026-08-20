// Resolve the hand-transcribed revision sheet against the committed LeetCode snapshots, and
// report — topic by topic — what is on LeetCode, what is not, and what the learner has already
// done in this repository's own two question universes.
//
// OFFLINE BY CONSTRUCTION. Every fact here comes from files already in the repo:
//   scripts/data/leetcode-topics.json   4,029 problems: frontendId, slug, difficulty, paid, topics
//   scripts/data/leetcode-catalog.json  the title/slug catalog the 539 are resolved against
//   src/data/questions.json             the 539-question curriculum (what is already on the roadmap)
//   src/data/contestLibrary.json        the 2,561 rated contest problems (what is contest-rated)
// No network, ever. This mirrors the repo's existing rule: external verification is engineering
// time only, and the app never needs the network at runtime.
//
// CLOSED WORLD, LIKE THE QUESTION GENERATOR. A sheet title resolves only by exact normalized
// title match or through the hand-verified ALIASES table below. Anything else is reported as
// UNRESOLVED with its topic — never guessed at, never fuzzy-matched. A wrong link in a revision
// list is worse than a missing one: it sends the learner to the wrong problem and they have no
// way to know.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));

/* ------------------------------------------------------------------------------------------- */
/* Sources                                                                                      */
/* ------------------------------------------------------------------------------------------- */

const topics = read('scripts', 'data', 'leetcode-topics.json');
const catalog = read('scripts', 'data', 'leetcode-catalog.json');
const questions = read('src', 'data', 'questions.json');
const library = read('src', 'data', 'contestLibrary.json');

// The contest library is dictionary-encoded (see src/data/contestLibrary.ts); decode the three
// columns this report needs.
const LIB = new Map(
  library.problems.map((r) => [r[0], { rating: r[4], contest: library.dictionaries.contests[r[5]], index: r[6] }]),
);

const slugOf = (url) => {
  const m = /\/problems\/([^/]+)\//.exec(url ?? '');
  return m ? m[1] : null;
};
// The 539, by slug — "already on your roadmap".
const ROADMAP = new Map();
for (const q of questions) {
  const s = slugOf(q.url);
  if (s) ROADMAP.set(s, q);
}

/* ------------------------------------------------------------------------------------------- */
/* Matching                                                                                     */
/* ------------------------------------------------------------------------------------------- */

// Fold the punctuation and casing that differ between hand-written sheets and LeetCode's own
// titles, and nothing else. Note `×` → `x` and the curly apostrophe: both appear in real titles.
const norm = (t) =>
  t
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/×/g, 'x')
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();

const byTitle = new Map();
for (const p of topics.problems) {
  const key = norm(p.title);
  if (!byTitle.has(key)) byTitle.set(key, p);
}
const catalogTitles = new Set(catalog.problems.map((p) => norm(p.title)));

/**
 * Hand-verified aliases: sheet spelling → LeetCode's own title.
 *
 * Every entry was checked against the snapshot by hand. Typos in the sheet are corrected here
 * rather than in the sheet file, so the sheet stays a faithful transcript of what the user sent.
 */
const ALIASES = {
  'number of atoms': 'Number of Atoms',
  'robot collisons': 'Robot Collisions',
  'insert intervals': 'Insert Interval',
  'student attendance record leetcode': 'Student Attendance Record II',
  'delete operation for two strings': 'Delete Operation for Two Strings',
  'print all lcs sequences': null, // GfG — printing all LCS is not a LeetCode problem
  'find length of loop': null, // GfG
  'merge k sorted lists': 'Merge k Sorted Lists',
  'sort a linked list of 0s 1s and 2s': null, // GfG
  'add 1 to a linked list number': null, // GfG
  'flattening a linked list': null, // GfG
  'construct smallest number from di string': 'Construct Smallest Number From DI String',
  'kth largest element in a stream': 'Kth Largest Element in a Stream',
  'k th smallest prime fraction': 'K-th Smallest Prime Fraction',
  'kth smallest element in a sorted matrix': 'Kth Smallest Element in a Sorted Matrix',
  'find the k sum of an array': 'Find the K-Sum of an Array',
  'the k weakest rows in a matrix': 'The K Weakest Rows in a Matrix',
  'longest common prefix': 'Longest Common Prefix',
  'sort characters by frequency': 'Sort Characters By Frequency',
  'sort array by increasing frequency': 'Sort Array by Increasing Frequency',
  'check if array pairs are divisible by k': 'Check If Array Pairs Are Divisible by k',
  'count pairs that form a complete day ii': 'Count Pairs That Form a Complete Day II',
  'maximum 69 number': 'Maximum 69 Number',
  'minimum cost for tickets': 'Minimum Cost For Tickets',
  'number of ways to paint n x 3 grid': 'Number of Ways to Paint N x 3 Grid',
  'best time to buy and sell stock with transaction fee': 'Best Time to Buy and Sell Stock with Transaction Fee',
  'maximum sum bst in binary tree': 'Maximum Sum BST in Binary Tree',
  'find common nodes in two bsts': null, // GfG
  'is graph bipartite': 'Is Graph Bipartite?',
  'does array represent heap': null, // GfG
  'is binary tree heap': null, // GfG
  'dijkstra': null, // CSES "Dijkstra?"
  'valid bfs': null, // Codeforces "Valid BFS?"
  'find a peak element ii': 'Find a Peak Element II',
  'sqrt x': 'Sqrt(x)',
  'pow x n': 'Pow(x, n)',
  // Verified against the snapshot, all four:
  'k th lexicographical string of all happy strings of length n':
    'The k-th Lexicographical String of All Happy Strings of Length n', // 1415
  'number of beautiful subsets': 'The Number of Beautiful Subsets', // 2597
  'play with chips': 'Minimum Cost to Move Chips to The Same Position', // 1217 — LeetCode renamed it
  // The sheet says Medium; 3095 (I) is Easy and 3097 (II) is Medium, so the difficulty decides it.
  'shortest subarray with or at least k': 'Shortest Subarray With OR at Least K II', // 3097
  'minimum distance to type a word using two fingers': 'Minimum Distance to Type a Word Using Two Fingers',
  'longest subarray with maximum bitwise and': 'Longest Subarray With Maximum Bitwise AND',
  'find the original array of prefix xor': 'Find The Original Array of Prefix Xor',
  'decode xored array': 'Decode XORed Array',
  'decode xored permutation': 'Decode XORed Permutation',
  'minimum number of operations to make array xor equal to k': 'Minimum Number of Operations to Make Array XOR Equal to K',
  'find xor sum of all pairs bitwise and': 'Find XOR Sum of All Pairs Bitwise AND',
  'xor queries of a subarray': 'XOR Queries of a Subarray',
  'maximum xor of two numbers in an array': 'Maximum XOR of Two Numbers in an Array',
  'maximum xor with an element from array': 'Maximum XOR With an Element From Array',
  'count pairs with xor in a range': 'Count Pairs With XOR in a Range',
  'maximum strong pair xor ii': 'Maximum Strong Pair XOR II',
  'utf 8 validation': 'UTF-8 Validation',
  'ipo': 'IPO',
  'lru cache': 'LRU Cache',
  'lfu cache': 'LFU Cache',
  "all o'one data structure": "All O`one Data Structure",
  '132 pattern': '132 Pattern',
  '01 matrix': '01 Matrix',
  '4sum ii': '4Sum II',
  '3sum closest': '3Sum Closest',
  'h index ii': 'H-Index II',
  'dota2 senate': 'Dota2 Senate',
  'design front middle back queue': 'Design Front Middle Back Queue',
  'minimum operations to exceed threshold value ii': 'Minimum Operations to Exceed Threshold Value II',
  'sum of prefix scores of strings': 'Sum of Prefix Scores of Strings',
  'remove sub folders from the filesystem': 'Remove Sub-Folders from the Filesystem',
  'delete duplicate folders in system': 'Delete Duplicate Folders in System',
  'longest common suffix queries': 'Longest Common Suffix Queries',
  'minimum xor value pair': null, // GfG
  'lexicographically minimum string after removing stars': 'Lexicographically Minimum String After Removing Stars',
  'find the winning player in coin game': 'Find the Winning Player in Coin Game',
  'maximum spending after buying items': 'Maximum Spending After Buying Items',
  'minimum moves to move a box to their target location': 'Minimum Moves to Move a Box to Their Target Location',
  'sort an array': 'Sort an Array',
  'maximum binary tree': 'Maximum Binary Tree',
};

/**
 * Titles that plausibly name more than one thing. Reported as ambiguous WITH the candidates,
 * never silently resolved to one of them — a wrong link in a revision list sends the learner to
 * the wrong problem and gives them no way to notice.
 */
const AMBIGUOUS = {
  'beautiful numbers':
    'Could be LeetCode 3490 "Count Beautiful Numbers" (Hard), or the Codeforces problem of this exact name — its neighbours in this subtopic (Tiles, Right Triangles, Count the Arrays, String Mark) are all Codeforces.',
};

/** Titles that are certainly not LeetCode problems, with the platform they actually belong to. */
const NOT_LEETCODE = {
  // GeeksforGeeks / classic textbook exercises
  'find length of loop': 'GeeksforGeeks',
  'sort a linked list of 0s 1s and 2s': 'GeeksforGeeks',
  'add 1 to a linked list number': 'GeeksforGeeks',
  'flattening a linked list': 'GeeksforGeeks',
  'print all lcs sequences': 'GeeksforGeeks',
  'find common nodes in two bsts': 'GeeksforGeeks',
  'does array represent heap': 'GeeksforGeeks',
  'is binary tree heap': 'GeeksforGeeks',
  'operations on binary min heap': 'GeeksforGeeks',
  'convert min heap to max heap': 'GeeksforGeeks',
  'implementation of priority queue using binary heap': 'GeeksforGeeks',
  'heap sort': 'GeeksforGeeks',
  'merge k sorted arrays': 'GeeksforGeeks',
  'minimum xor value pair': 'GeeksforGeeks',
  'trie delete': 'GeeksforGeeks',
  'aggressive cows': 'GeeksforGeeks / SPOJ',
  'rat in a maze problem': 'GeeksforGeeks',
  'josephus problem': 'GeeksforGeeks',
  'tower of hanoi': 'GeeksforGeeks',
  'delete middle element of a stack': 'GeeksforGeeks',
  'sort a stack': 'GeeksforGeeks',
  'minimum platforms': 'GeeksforGeeks',
  'fractional knapsack': 'GeeksforGeeks',
  'activity selection': 'GeeksforGeeks',
  'job sequencing problem': 'GeeksforGeeks',
  'knapsack 1': 'GeeksforGeeks',
  'knapsack 2': 'GeeksforGeeks',
  'rod cutting': 'GeeksforGeeks',
  'max sum increasing subsequence': 'GeeksforGeeks',
  'printing longest increasing subsequence': 'GeeksforGeeks',
  'matrix chain multiplication': 'GeeksforGeeks',
  "geek's training": 'GeeksforGeeks',
  'count common subsequence in two strings': 'GeeksforGeeks (theory)',
  'minimum spanning tree': 'GeeksforGeeks',
  'water connection problem': 'GeeksforGeeks',
  'detect cycle in an undirected graph geeksforgeeks': 'GeeksforGeeks',
  'detect cycle in a directed graph geeksforgeeks': 'GeeksforGeeks',
  'check if a graph has a cycle of odd length': 'GeeksforGeeks',
  'dfs traversal': 'GeeksforGeeks',
  'bfs in graph': 'GeeksforGeeks',
  'factorial of large numbers': 'GeeksforGeeks',
  'ncr mod m': 'GeeksforGeeks',
  'median in a row wise sorted matrix': 'GeeksforGeeks',
  'construct bst from postorder': 'GeeksforGeeks',
  'construct binary tree from parent array': 'GeeksforGeeks',
  'linked list to binary tree': 'GeeksforGeeks',
  'construct binary tree from string with bracket representation': 'GeeksforGeeks',
  'remove half nodes': 'GeeksforGeeks',
  'two mirror trees': 'GeeksforGeeks',
  'check if tree is isomorphic': 'GeeksforGeeks',
  'check if subtree': 'GeeksforGeeks',
  'mirror tree': 'GeeksforGeeks',
  'left view of binary tree': 'GeeksforGeeks',
  'top view of binary tree': 'GeeksforGeeks',
  'burning tree': 'GeeksforGeeks',
  'children sum in a binary tree': 'GeeksforGeeks',
  'preorder postorder inorder in a single traversal': 'GeeksforGeeks',
  'n ary tree': 'Theory',
  'reverse first k elements of queue': 'GeeksforGeeks',
  'first negative integer in every window of size k': 'GeeksforGeeks',
  'queue using two stacks': 'GeeksforGeeks',
  'implement queue using array': 'GeeksforGeeks',
  'implement queue using linked list': 'GeeksforGeeks',
  'n queue using array': 'GeeksforGeeks',
  'deque implementations': 'GeeksforGeeks',
  'c stl queue': 'Reference (C++ STL)',
  'redundant parenthesis': 'GeeksforGeeks / InterviewBit',
  'decimal to binary': 'GeeksforGeeks',
  'get set clear ith bit': 'GeeksforGeeks',
  'kth bit is set or not': 'GeeksforGeeks',
  'check odd or even': 'GeeksforGeeks',
  'set the rightmost unset bit': 'GeeksforGeeks',
  'count total set bits': 'GeeksforGeeks',
  'swap two numbers with temp variable': 'GeeksforGeeks',
  'rotation': 'GeeksforGeeks',
  'xor sequences': 'Codeforces',
  'first non repeating character in a stream': 'GeeksforGeeks',
  // CSES Problem Set
  'shortest route i': 'CSES',
  'investigation': 'CSES',
  'flight discount': 'CSES',
  'high score': 'CSES',
  'cycle finding': 'CSES',
  'road construction': 'CSES',
  'round trip': 'CSES',
  'counting numbers': 'CSES',
  'subordinates': 'CSES',
  'tree matching': 'CSES',
  'tree distances 1': 'CSES',
  'tree distances ii': 'CSES',
  'company queries i': 'CSES',
  'company queries ii': 'CSES',
  'distance queries': 'CSES',
  'counting tilings': 'CSES',
  'grouping': 'CSES',
  'matching': 'CSES',
  'range minimum query': 'CSES / SPOJ',
  'dijkstra': 'CSES ("Dijkstra?")',
  // Codeforces
  'valid bfs': 'Codeforces',
  'pongal bunk': 'Codeforces',
  'greg and array': 'Codeforces',
  'yet another string game': 'Codeforces',
  'substring removal game': 'Codeforces',
  'sasha and sticks': 'Codeforces',
  'card game': 'Codeforces',
  '01 game': 'Codeforces',
  'digit game': 'Codeforces',
  'dinner with emma': 'Codeforces',
  'matrix game': 'Codeforces',
  'sequential game': 'Codeforces',
  'ping pong': 'Codeforces',
  'godsend': 'Codeforces',
  'polandball and game': 'Codeforces',
  'even odd game': 'Codeforces',
  'palindrome game': 'Codeforces',
  'right triangles': 'Codeforces',
  'tiles': 'Codeforces',
  'count the arrays': 'Codeforces',
  'string mark': 'Codeforces',
  'little elephant and t shirts': 'Codeforces',
  'catapult that ball': 'Codeforces',
  'miraculous': 'Codeforces',
  'negative score': 'Codeforces',
  'diferencija': 'COCI',
  'check if two line segments intersect': 'GeeksforGeeks',
  // AtCoder
  sushi: 'AtCoder (DP contest)',
  coins: 'AtCoder (DP contest)',
  // Theory entries the sheet itself marks as such
  'kmp algorithm for pattern searching': 'Theory',
  'rabin karp algorithm for pattern searching': 'Theory',
  'z algorithm linear time pattern searching algorithm': 'Theory',
  "prim's minimum spanning tree mst greedy algorithm": 'Theory',
  "kruskal's minimum spanning tree algorithm greedy algorithm": 'Theory',
  'articulation points or cut vertices in a graph': 'Theory',
  'strongly connected components': 'Theory',
};

/* ------------------------------------------------------------------------------------------- */
/* Resolve                                                                                      */
/* ------------------------------------------------------------------------------------------- */

const lines = readFileSync(join(root, 'scripts', 'data', 'revision-sheet.txt'), 'utf8').split(/\r?\n/);
const sheet = [];
let topic = null;
let sub = null;
for (const line of lines) {
  if (line.startsWith('## ')) sub = line.slice(3).trim();
  else if (line.startsWith('# ')) { topic = line.slice(2).trim(); sub = null; }
  else if (line.trim() !== '') {
    const [title, difficulty] = line.split('|');
    sheet.push({ topic, sub, title: title.trim(), difficulty: (difficulty ?? '').trim() });
  }
}

for (const row of sheet) {
  const key = norm(row.title);
  const notLc = NOT_LEETCODE[key];
  const aliasTitle = ALIASES[key];
  const ambiguous = AMBIGUOUS[key];

  let hit = byTitle.get(key);
  if (!hit && aliasTitle) hit = byTitle.get(norm(aliasTitle));

  if (ambiguous) {
    row.status = 'ambiguous';
    row.note = ambiguous;
  } else if (hit && !notLc) {
    row.status = 'leetcode';
    row.frontendId = hit.frontendId;
    row.slug = hit.slug;
    row.url = `https://leetcode.com/problems/${hit.slug}/`;
    row.officialDifficulty = hit.difficulty;
    row.premium = hit.paid === true;
    row.leetcodeTopics = hit.topics ?? [];
    row.inRoadmap = ROADMAP.has(hit.slug) ? ROADMAP.get(hit.slug).id : null;
    const lib = LIB.get(hit.slug);
    row.contestRating = lib ? lib.rating : null;
    row.contestLabel = lib ? `${lib.contest} · Q${lib.index}` : null;
    row.inCatalog = catalogTitles.has(norm(hit.title));
    row.difficultyMismatch =
      ['Easy', 'Medium', 'Hard'].includes(row.difficulty) &&
      row.difficulty.toLowerCase() !== hit.difficulty;
  } else if (notLc) {
    row.status = 'other-platform';
    row.platform = notLc;
  } else {
    row.status = 'unresolved';
  }
}

/* ------------------------------------------------------------------------------------------- */
/* Report                                                                                       */
/* ------------------------------------------------------------------------------------------- */

const uniq = (arr) => [...new Set(arr)];
const lc = sheet.filter((r) => r.status === 'leetcode');
const other = sheet.filter((r) => r.status === 'other-platform');
const unresolved = sheet.filter((r) => r.status === 'unresolved');
const ambiguousRows = sheet.filter((r) => r.status === 'ambiguous');
const mismatched = lc.filter((r) => r.difficultyMismatch);
const uniqueSlugs = uniq(lc.map((r) => r.slug));
const alreadyRoadmap = uniq(lc.filter((r) => r.inRoadmap !== null).map((r) => r.slug));
const rated = uniq(lc.filter((r) => r.contestRating !== null).map((r) => r.slug));
const premium = uniq(lc.filter((r) => r.premium).map((r) => r.slug));
const freshRated = uniq(lc.filter((r) => r.inRoadmap === null && r.contestRating !== null).map((r) => r.slug));
const freshUnrated = uniq(lc.filter((r) => r.inRoadmap === null && r.contestRating === null).map((r) => r.slug));

const summary = {
  rows: sheet.length,
  topics: uniq(sheet.map((r) => r.topic)).length,
  subtopics: uniq(sheet.map((r) => `${r.topic}|${r.sub}`)).length,
  onLeetCode: lc.length,
  uniqueLeetCodeProblems: uniqueSlugs.length,
  otherPlatform: other.length,
  unresolved: unresolved.length,
  ambiguous: ambiguousRows.length,
  difficultyMismatches: mismatched.length,
  alreadyOnRoadmap: alreadyRoadmap.length,
  ratedContestProblems: rated.length,
  premium: premium.length,
  newAndRated: freshRated.length,
  newAndUnrated: freshUnrated.length,
};

writeFileSync(
  join(root, 'scripts', 'data', 'revision-sheet-resolved.json'),
  JSON.stringify({ summary, sheet }, null, 1),
);

console.log(JSON.stringify(summary, null, 2));
if (mismatched.length > 0) {
  console.log('\nDIFFICULTY DISAGREES WITH LEETCODE (' + mismatched.length + '):');
  for (const r of mismatched) console.log(`  [${r.topic}] ${r.title}: sheet ${r.difficulty} vs LeetCode ${r.officialDifficulty}`);
}
if (ambiguousRows.length > 0) {
  console.log('\nAMBIGUOUS (' + ambiguousRows.length + '):');
  for (const r of ambiguousRows) console.log(`  [${r.topic}] ${r.title}`);
}
if (unresolved.length > 0) {
  console.log('\nUNRESOLVED (' + unresolved.length + '):');
  for (const r of unresolved) console.log(`  [${r.topic} / ${r.sub}] ${r.title}`);
}
