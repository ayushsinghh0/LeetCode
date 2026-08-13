// Generates src/data/questions.json from the canonical question list.
// Source of truth: the user's pasted 539-question roadmap (28 patterns, in order).
// Run: node scripts/generate-questions.mjs
//
// External identity: every question is resolved against the committed LeetCode catalog
// snapshot (scripts/data/leetcode-catalog.json, fetched by fetch-leetcode-catalog.mjs).
// Resolution is closed-world — a title must EITHER exact-match a catalog title (after
// normalization), OR appear in LEETCODE_ALIASES (hand-verified renames), OR appear in
// NOT_ON_LEETCODE (Educative/Grokking originals with no exact LeetCode counterpart).
// Anything else is a hard failure, so a typo'd new title can never silently ship linkless,
// and no URL is ever emitted that didn't come from LeetCode's own catalog.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const D = { e: 'easy', m: 'medium', h: 'hard' };

// [patternId, patternName, [[title, difficulty], ...]]
const SECTIONS = [
  ['two-pointers', 'Two Pointers', [
    ['Valid Palindrome', 'e'], ['3Sum', 'm'], ['Remove nth Node from End of List', 'm'],
    ['Sort Colors', 'm'], ['Reverse Words in a String', 'm'], ['Valid Word Abbreviation', 'e'],
    ['Valid Palindrome II', 'e'], ['Lowest Common Ancestor of a Binary Tree III', 'm'],
    ['Strobogrammatic Number', 'e'], ['Minimum Number of Moves to Make Palindrome', 'h'],
    ['Next Palindrome Using Same Digits', 'h'], ['Count Subarrays With Fixed Bounds', 'h'],
    ['Find the Lexicographically Largest String From Box II', 'h'], ['Get the Maximum Score', 'h'],
    ['Create Maximum Number', 'h'], ['Append Characters to String to Make Subsequence', 'm'],
    ['Squares of a Sorted Array', 'e'], ['Reverse String', 'e'], ['Intersection of Two Linked Lists', 'e'],
    ['Partition Labels', 'm'], ['Remove Element', 'e'], ['String Compression', 'm'],
    ['Rotate Array', 'm'], ['Next Permutation', 'm'], ['Remove Duplicates from Sorted Array', 'e'],
    ['Reverse Vowels of a String', 'e'], ['Is Subsequence', 'e'], ['Merge Strings Alternately', 'e'],
    ['Compare Version Numbers', 'm'], ['Move Zeroes', 'm'],
    ["Longest Subarray of 1's After Deleting One Element", 'm'], ['Backspace String Compare', 'm'],
    ['Next Greater Element III', 'm'], ['Rotating the Box', 'm'],
  ]],
  ['fast-slow-pointers', 'Fast and Slow Pointers', [
    ['Happy Number', 'e'], ['Linked List Cycle', 'e'], ['Middle of the Linked List', 'e'],
    ['Circular Array Loop', 'm'], ['Find The Duplicate Number', 'm'], ['Palindrome Linked List', 'e'],
    ['Linked List Cycle III', 'm'], ['Linked List Cycle IV', 'm'],
    ['Maximum Twin Sum of a Linked List', 'm'], ['Split a Circular Linked List', 'm'],
  ]],
  ['sliding-window', 'Sliding Window', [
    ['Repeated DNA Sequences', 'm'], ['Sliding Window Maximum', 'h'], ['Minimum Window Subsequence', 'h'],
    ['Longest Repeating Character Replacement', 'm'], ['Minimum Window Substring', 'h'],
    ['Longest Substring without Repeating Characters', 'm'], ['Minimum Size Subarray Sum', 'm'],
    ['Best Time to Buy and Sell Stock', 'e'], ['Fruit Into Baskets', 'm'],
    ['Frequency of the Most Frequent Element', 'm'], ['Maximum Average Subarray I', 'e'],
    ['Diet Plan Performance', 'e'], ['Subarrays with K Different Integers', 'h'],
    ['Count Subarrays With Score Less Than K', 'h'], ['Count Substrings With K-Frequency Characters II', 'h'],
    ['Substring with Concatenation of All Words', 'h'], ['Binary Subarrays With Sum', 'm'],
    ['Permutation in String', 'm'], ['Number of Substrings Containing All Three Characters', 'm'],
    ['Find the Index of the First Occurrence in a String', 'm'], ['Max Consecutive Ones III', 'm'],
    ['Longest Subarray With Diff At Most Limit', 'm'], ['Subarray Product Less Than K', 'm'],
  ]],
  ['intervals', 'Intervals', [
    ['Merge Intervals', 'm'], ['Insert Interval', 'm'], ['Interval List Intersections', 'm'],
    ['Employee Free Time', 'h'], ['Task Scheduler', 'm'], ['Meeting Rooms II', 'm'],
    ['Remove Covered Intervals', 'm'], ['Count Days Without Meetings', 'm'], ['Car Pooling', 'm'],
    ['Data Stream as Disjoint Intervals', 'h'], ['Minimum Interval to Include Each Query', 'h'],
  ]],
  ['linked-list-inplace', 'In-Place Manipulation of a Linked List', [
    ['Reverse Linked List', 'e'], ['Reverse Nodes in k-Group', 'h'], ['Reverse Linked List II', 'm'],
    ['Reorder List', 'm'], ['Swapping Nodes in a Linked List', 'm'],
    ['Reverse Nodes In Even Length Groups', 'm'], ['Swap Nodes in Pairs', 'm'],
    ['Split Linked List in Parts', 'm'], ['Remove Linked List Elements', 'e'],
    ['Delete N Nodes After M Nodes of a Linked List', 'e'], ['Remove Duplicates from Sorted List', 'e'],
    ['Insert into a Sorted Circular Linked List', 'm'], ['Odd Even Linked List', 'm'], ['Rotate List', 'm'],
  ]],
  ['two-heaps', 'Two Heaps', [
    ['Maximize Capital', 'h'], ['Find Median from a Data Stream', 'h'], ['Sliding Window Median', 'h'],
    ['Schedule Tasks on Minimum Machines', 'm'], ['Meeting Rooms III', 'h'],
    ['Minimum Cost to Connect Sticks', 'm'], ['Longest Happy String', 'm'],
    ['Maximum Average Pass Ratio', 'm'], ['The Number of the Smallest Unoccupied Chair', 'm'],
    ['Largest Number After Digit Swaps by Parity', 'e'], ['Find Right Interval', 'm'],
    ['Construct Target Array with Multiple Sums', 'h'],
  ]],
  ['k-way-merge', 'K-way Merge', [
    ['Merge Sorted Array', 'e'], ['Kth Smallest Number in M Sorted Lists', 'm'],
    ['Find K Pairs with Smallest Sums', 'm'], ['Merge K Sorted Lists', 'h'],
    ['Kth Smallest Element in a Sorted Matrix', 'm'], ['K-th Smallest Prime Fraction', 'm'],
    ['Super Ugly Number', 'm'],
  ]],
  ['top-k-elements', 'Top K Elements', [
    ['Kth Largest Element in a Stream', 'e'], ['Reorganize String', 'm'], ['K Closest Points to Origin', 'm'],
    ['Top K Frequent Elements', 'm'], ['Kth Largest Element in an Array', 'm'],
    ['Maximal Score After Applying K Operations', 'm'], ['Find the Kth Largest Integer in the Array', 'm'],
    ['Third Maximum Number', 'e'], ['Find Subsequence of Length K with the Largest Sum', 'e'],
    ['Minimum Cost to Hire K Workers', 'h'], ['Smallest Range Covering Elements from K Lists', 'h'],
    ['Maximum Performance of a Team', 'h'], ['K Maximum Sum Combinations From Two Arrays', 'h'],
    ['K Empty Slots', 'h'], ['Find the K-Sum of an Array', 'h'], ['Maximum Product After K Increments', 'm'],
    ['Least Number of Unique Integers after K Removals', 'm'],
    ['Final Array State After K Multiplication Operations I', 'e'],
  ]],
  ['modified-binary-search', 'Modified Binary Search', [
    ['Binary Search', 'e'], ['Search in Rotated Sorted Array', 'm'], ['First Bad Version', 'e'],
    ['Find K Closest Elements', 'm'], ['Single Element in a Sorted Array', 'm'],
    ['Split Array Largest Sum', 'h'], ['The K Weakest Rows in a Matrix', 'e'],
    ['Maximum Value at a Given Index in a Bounded Array', 'm'], ['Search in Rotated Sorted Array II', 'm'],
    ['Count Pairs Whose Sum is Less than Target', 'e'], ['Find Minimum in Rotated Sorted Array II', 'h'],
    ['Maximum Running Time of N Computers', 'h'], ['Minimize Max Distance to Gas Station', 'h'],
    ['Divide Chocolate', 'h'], ['Split Array Into Two Arrays to Minimize Sum Difference', 'h'],
    ['Number of Flowers in Full Bloom', 'h'], ['Koko Eating Bananas', 'm'], ['Search Insert Position', 'e'],
    ['Find Peak Element', 'm'], ['Find First and Last Position of Element in Sorted Array', 'm'],
    ['Kth Smallest Product of Two Sorted Arrays', 'h'], ['Sqrt(x)', 'm'], ['Reaching Points', 'm'],
    ['Kth Missing Positive Number', 'm'],
  ]],
  ['subsets', 'Subsets', [
    ['Subsets', 'm'], ['Permutations', 'm'], ['Letter Combinations of a Phone Number', 'm'],
    ['Generate Parentheses', 'm'], ['Find K-Sum Subsets', 'm'], ['Letter Case Permutation', 'm'],
    ['Letter Tile Possibilities', 'm'], ['Subsets II', 'm'],
  ]],
  ['greedy', 'Greedy Techniques', [
    ['Jump Game I', 'm'], ['Boats to Save People', 'm'], ['Gas Stations', 'm'], ['Two City Scheduling', 'm'],
    ['Minimum Number of Refueling Stops', 'h'], ['Largest Palindromic Number', 'm'], ['Jump Game II', 'm'],
    ['Number of Steps to Reduce a Binary Number to One', 'm'], ['Rearranging Fruits', 'h'],
    ['Maximum Swap', 'm'], ['Can Place Flowers', 'e'], ['Largest Odd Number in String', 'e'],
    ['Assign Cookies', 'e'], ['Candy', 'h'], ['Minimum Replacements to Sort the Array', 'h'],
    ['Sort an Array', 'm'], ['Text Justification', 'h'], ['Best Time to Buy and Sell Stock II', 'm'],
    ['Wildcard Matching', 'h'], ['Remove K Digits', 'm'], ['Largest Number', 'm'],
    ['Strong Password Checker', 'h'], ['Maximum Points After Enemy Battles', 'm'], ['Integer to Roman', 'm'],
  ]],
  ['backtracking', 'Backtracking', [
    ['N-Queens II', 'h'], ['Word Search', 'm'], ['House Robber III', 'm'], ['Restore IP Addresses', 'm'],
    ['Flood Fill', 'e'], ['Minimum Moves to Spread Stones Over Grid', 'm'], ['Sudoku Solver', 'h'],
    ['Matchsticks to Square', 'm'], ['Binary Watch', 'e'], ['Optimal Account Balancing', 'h'],
    ['Split a String Into the Max Number of Unique Substrings', 'm'], ['Binary Tree Paths', 'e'],
    ['All Paths From Source to Target', 'm'], ['Remove Invalid Parentheses', 'h'], ['Unique Paths III', 'h'],
    ['N-Queens', 'h'], ['Combinations', 'm'], ['Word Ladder II', 'h'], ['Flip Game', 'e'],
    ['Additive Number', 'm'],
  ]],
  ['dynamic-programming', 'Dynamic Programming', [
    ['0/1 Knapsack', 'm'], ['Coin Change', 'm'], ['N-th Tribonacci Number', 'e'],
    ['Partition Equal Subset Sum', 'm'], ['Counting Bits', 'e'], ['01 Matrix', 'm'],
    ['House Robber II', 'm'], ['Maximum Product Subarray', 'm'], ['Combination Sum', 'm'],
    ['Word Break', 'm'], ['Palindromic Substrings', 'm'], ['Longest Common Subsequence', 'm'],
    ['Word Break II', 'h'], ['Decode Ways', 'm'], ['Count the Number of Good Subsequences', 'm'],
    ['Climbing Stairs', 'e'], ['Binary Tree Cameras', 'h'],
    ['Number of Ways to Form a Target String Given a Dictionary', 'h'], ["Pascal's Triangle", 'e'],
    ['Triangle', 'm'], ['Frog Jump', 'h'], ['Cherry Pickup', 'h'], ['Regular Expression Matching', 'h'],
    ['Dungeon Game', 'h'], ['Burst Balloons', 'h'], ['Shortest Common Supersequence', 'h'],
    ['Interleaving String', 'm'], ['Maximal Rectangle', 'h'], ['Longest Increasing Path in a Matrix', 'h'],
    ['Min Cost Climbing Stairs', 'e'], ['Number of Longest Increasing Subsequence', 'm'],
    ['Distinct Subsequences', 'h'], ['Cheapest Flights Within K Stops', 'm'], ['Minimum Path Sum', 'm'],
    ['Best Time to Buy and Sell Stock III', 'h'], ['Maximal Square', 'm'],
    ['The Number of Good Subsets', 'h'], ['Freedom Trail', 'h'], ['Soup Servings', 'm'],
    ['Number of People Aware of a Secret', 'm'], ['Edit Distance', 'm'],
  ]],
  ['cyclic-sort', 'Cyclic Sort', [
    ['Missing Number', 'e'], ['First Missing Positive', 'h'], ['Find the Corrupt Pair', 'm'],
    ['Find the First K Missing Positive Numbers', 'e'], ['Sort Array By Parity II', 'e'],
    ['Cyclic Sort', 'e'],
  ]],
  ['topological-sort', 'Topological Sort', [
    ['Compilation Order', 'm'], ['Alien Dictionary', 'h'], ['Verifying an Alien Dictionary', 'e'],
    ['Course Schedule II', 'm'], ['Course Schedule', 'm'],
    ['Find All Possible Recipes from Given Supplies', 'm'], ['Build a Matrix with Conditions', 'h'],
    ['Longest Path With Different Adjacent Characters', 'h'], ['Parallel Courses III', 'h'],
    ['Parallel Courses', 'm'], ['Sort Items by Groups Respecting Dependencies', 'h'],
    ['Collect Coins in a Tree', 'm'],
  ]],
  ['sort-search', 'Sort and Search', [
    ['Sum of Mutated Array Closest to Target', 'm'], ['Contains Duplicate II', 'e'],
    ['Find K-th Smallest Pair Distance', 'h'], ['Maximum Number of Integers to Choose from a Range I', 'm'],
    ['Find the Distance Value Between Two Arrays', 'e'], ['Find Target Indices After Sorting Array', 'e'],
    ['Russian Doll Envelopes', 'h'], ['Minimum Operations to Make All Array Elements Equal', 'm'],
    ['Longest Subsequence With Limited Sum', 'e'], ['Range Sum of Sorted Subarray Sums', 'm'],
    ['Magnetic Force Between Two Balls', 'm'], ['Minimum Space Wasted from Packaging', 'h'],
    ['Two Sum Less Than K', 'e'], ['Valid Triangle Number', 'm'], ['Count Pairs in Two Arrays', 'm'],
    ['Put Marbles in Bags', 'h'], ['H-Index', 'm'], ['Reverse Pairs', 'h'], ['Minimum Time Difference', 'm'],
  ]],
  ['matrices', 'Matrices', [
    ['Set Matrix Zeros', 'm'], ['Rotate Image', 'm'], ['Spiral Matrix', 'm'],
    ['Where Will the Ball Fall', 'm'], ['Island Perimeter', 'e'], ['Convert 1D Array Into 2D Array', 'e'],
    ['Spiral Matrix II', 'm'], ['Flip Columns For Maximum Number of Equal Rows', 'm'],
    ['Number of Spaces Cleaning Robot Cleaned', 'm'], ['Transpose Matrix', 'e'],
    ['Count Negative Numbers in a Sorted Matrix', 'e'],
    ['Minimum Time Takes to Reach Destination Without Drowning', 'h'],
    ['Smallest Rectangle Enclosing Black Pixels', 'h'], ['Minimize Maximum Value in a Grid', 'h'],
    ['Kth Smallest Number in Multiplication Table', 'h'], ['Swim in Rising Water', 'h'],
    ['Best Meeting Point', 'h'], ['Game of Life', 'm'], ['Toeplitz Matrix', 'e'], ['Diagonal Traverse', 'm'],
  ]],
  ['stacks', 'Stacks', [
    ['Basic Calculator', 'h'], ['Remove All Adjacent Duplicates In String', 'e'],
    ['Minimum Remove to Make Valid Parentheses', 'm'], ['Exclusive Time of Functions', 'm'],
    ['Flatten Nested List Iterator', 'm'], ['Implement Queue Using Stacks', 'e'], ['Valid Parentheses', 'e'],
    ['Decode String', 'm'], ['Daily Temperatures', 'm'],
    ['Minimum String Length After Removing Substrings', 'e'], ['Number of Valid Subarrays', 'h'],
    ['Number of Visible People in a Queue', 'h'], ['Parsing A Boolean Expression', 'h'],
    ['Remove Duplicate Letters', 'm'], ['Longest Valid Parentheses', 'h'], ['Next Greater Element IV', 'h'],
    ['Maximum Width Ramp', 'm'], ['Basic Calculator II', 'm'],
    ['Remove All Adjacent Duplicates in String II', 'm'], ['Simplify Path', 'm'],
  ]],
  ['graphs', 'Graphs', [
    ['Network Delay Time', 'm'], ['Paths in Maze That Lead to Same Room', 'm'], ['Clone Graph', 'm'],
    ['Graph Valid Tree', 'm'], ['Bus Routes', 'h'], ['Reconstruct Itinerary', 'h'],
    ['Lucky Numbers in a Matrix', 'e'], ['Path with Maximum Probability', 'm'],
    ['Reorder Routes to Make All Paths Lead to the City Zero', 'm'], ['Tree Diameter', 'm'],
    ['Find the Town Judge', 'e'], ['Find Center of Star Graph', 'e'], ['Longest Cycle in a Graph', 'h'],
    ['Minimum Cost to Make at Least One Valid Path in a Grid', 'h'], ['Shortest Cycle in a Graph', 'h'],
    ['Shortest Path Visiting All Nodes', 'h'], ['Max Area of Island', 'm'],
    ['Shortest Path in a Grid with Obstacles Elimination', 'm'],
  ]],
  ['tree-dfs', 'Tree Depth-First Search', [
    ['Flatten Binary Tree to Linked List', 'm'], ['Diameter of Binary Tree', 'e'],
    ['Serialize and Deserialize Binary Tree', 'h'], ['Invert Binary Tree', 'e'],
    ['Binary Tree Maximum Path Sum', 'h'], ['Convert Sorted Array to Binary Search Tree', 'e'],
    ['Build Binary Tree from Preorder and Inorder Traversal', 'm'], ['Binary Tree Right Side View', 'm'],
    ['Lowest Common Ancestor of a Binary Tree', 'm'], ['Validate Binary Search Tree', 'm'],
    ['Nested List Weight Sum II', 'm'], ['Inorder Successor in BST', 'm'],
    ['Height of Binary Tree After Subtree Removal Queries', 'h'], ['Maximum Depth of Binary Tree', 'e'],
    ['Kth Smallest Element in a BST', 'm'], ['Delete Nodes And Return Forest', 'm'],
    ['Sum of Distances in a Tree', 'h'], ['Recover a Tree From Preorder Traversal', 'h'],
    ['Binary Tree Preorder Traversal', 'e'], ['Univalued Binary Tree', 'e'], ['Path Sum', 'e'],
    ['Closest Binary Search Tree Value', 'e'],
  ]],
  ['tree-bfs', 'Tree Breadth-First Search', [
    ['Level Order Traversal of Binary Tree', 'm'], ['Binary Tree Zigzag Level Order Traversal', 'm'],
    ['Populating Next Right Pointers in Each Node', 'm'], ['Vertical Order Traversal of a Binary Tree', 'h'],
    ['Symmetric Tree', 'e'], ['Word Ladder', 'h'], ['Connect All Siblings of a Binary Tree', 'm'],
    ['Two Sum IV - Input is a BST', 'e'], ['Find Minimum Diameter After Merging Two Trees', 'h'],
    ['Closest Node to Path in Tree', 'h'], ['Frog Position After T Seconds', 'h'],
    ['Average of Levels in Binary Tree', 'e'], ['Open the Lock', 'm'],
    ['Shortest Distance from All Buildings', 'm'],
  ]],
  ['trie', 'Trie', [
    ['Implement Trie', 'm'], ['Search Suggestions System', 'm'], ['Replace Words', 'm'],
    ['Design Add and Search Words Data Structure', 'm'], ['Word Search II', 'h'],
    ['Top K Frequent Words', 'm'], ['Lexicographical Numbers', 'm'], ['Longest Common Prefix', 'e'],
    ['Index Pairs of a String', 'e'], ['K-th Smallest in Lexicographical Order', 'h'],
    ['Palindrome Pairs', 'h'], ['Longest Common Suffix Queries', 'h'], ['Map Sum Pairs', 'm'],
    ['Check If a Word is a Prefix of Any Word in a Sentence', 'e'], ['Longest Word With All Prefixes', 'm'],
  ]],
  ['hash-maps', 'Hash Maps', [
    ['Design HashMap', 'e'], ['Fraction to Recurring Decimal', 'm'], ['Logger Rate Limiter', 'e'],
    ['Next Greater Element I', 'e'], ['Isomorphic Strings', 'e'], ['Find Duplicate File in System', 'm'],
    ['Longest Palindrome', 'e'], ['Continuous Subarray Sum', 'm'], ['Unique Number of Occurrences', 'e'],
    ['High Five', 'e'], ['Bulls and Cows', 'm'], ['Number of Wonderful Substrings', 'm'],
    ['Number of Distinct Islands', 'm'], ['Custom Sort String', 'm'], ['Total Appeal of a String', 'h'],
    ['Dot Product of Two Sparse Vectors', 'm'], ['Longest Happy Prefix', 'h'],
    ['Find Longest Self-Contained Substring', 'h'], ['Intersection of Two Arrays', 'e'],
    ['Word Pattern', 'e'], ['Valid Sudoku', 'm'], ['Roman to Integer', 'e'], ['Contiguous Array', 'm'],
    ['Jewels and Stones', 'e'], ['Vowel Spellchecker', 'm'], ['N-Repeated Element in Size 2N Array', 'e'],
    ['Powerful Integers', 'm'], ['Before and After Puzzle', 'm'], ['Intersection of Two Arrays II', 'e'],
    ['Subarray Sum Equals K', 'm'], ['Identify the Largest Outlier in an Array', 'm'],
    ['Find the Length of the Longest Common Prefix', 'm'],
  ]],
  ['tracking', 'Knowing What to Track', [
    ['Palindrome Permutation', 'e'], ['Valid Anagram', 'e'], ['Design Tic-Tac-Toe', 'm'],
    ['Group Anagrams', 'm'], ['Maximum Frequency Stack', 'h'], ['First Unique Character in a String', 'e'],
    ['Find All Anagrams in a String', 'm'], ['Longest Palindrome by Concatenating Two-Letter Words', 'm'],
    ['Ransom Note', 'e'], ['Minimum Number of Pushes to Type Word II', 'm'], ['Rank Teams by Votes', 'm'],
    ['Pairs of Songs With Total Durations Divisible by 60', 'm'], ['Count Anagrams', 'h'],
    ['Divide Array Into Increasing Sequences', 'h'], ['Max Consecutive Ones', 'e'], ['Count and Say', 'm'],
    ['Find Words That Can Be Formed by Characters', 'e'],
    ['Check if One String Swap Can Make Strings Equal', 'e'], ['Find Pivot Index', 'm'],
    ['Sort Array by Increasing Frequency', 'm'], ['Concatenation of Array', 'm'], ['Zigzag Conversion', 'm'],
    ['Zero Array Transformation I', 'm'], ['Count Binary Substrings', 'm'],
  ]],
  ['union-find', 'Union Find', [
    ['Redundant Connection', 'm'], ['Number of Islands', 'm'],
    ['Most Stones Removed with Same Row or Column', 'm'], ['Longest Consecutive Sequence', 'm'],
    ['Last Day Where You Can Still Cross', 'h'], ['Regions Cut by Slashes', 'm'], ['Accounts Merge', 'm'],
    ['Minimize Malware Spread', 'h'], ['Evaluate Division', 'm'], ['Find if Path Exists in Graph', 'e'],
    ['The Skyline Problem', 'h'], ['Similar String Groups', 'h'],
    ['Optimize Water Distribution in a Village', 'h'], ['Number of Islands II', 'h'],
  ]],
  ['custom-data-structures', 'Custom Data Structures', [
    ['Snapshot Array', 'm'], ['Time-Based Key-Value Store', 'm'], ['Implement LRU Cache', 'm'],
    ['Insert Delete GetRandom O(1)', 'm'], ['Min Stack', 'm'], ['Range Module', 'h'],
    ['Shortest Word Distance II', 'm'], ['LFU Cache', 'h'], ['Moving Average from Data Stream', 'e'],
    ['Two Sum III - Data structure design', 'e'], ['Range Sum Query - Immutable', 'e'],
    ['Design HashSet', 'e'], ['Max Stack', 'h'], ['Stream of Characters', 'h'],
    ["All O'one Data Structures", 'h'], ['Finding MK Average', 'h'],
  ]],
  ['bitwise-manipulation', 'Bitwise Manipulation', [
    ['Find the Difference', 'e'], ['Complement of Base 10 Integer', 'e'], ['Flipping an Image', 'e'],
    ['Single Number', 'e'], ['Single Number II', 'm'], ['Encode and Decode Strings', 'm'],
    ['Reverse Bits', 'e'], ['Find the Longest Substring Having Vowels in Even Counts', 'm'],
    ['Longest Subarray With Maximum Bitwise AND', 'm'],
    ['Count Triplets That Can Form Two Arrays of Equal XOR', 'm'], ['Sum of All Subset XOR Totals', 'e'],
    ['Find The K-th Lucky Number', 'm'], ['Minimum Number of K Consecutive Bit Flips', 'h'],
    ['Minimum One Bit Operations to Make Integers Zero', 'h'],
    ['Triples with Bitwise AND Equal To Zero', 'h'], ['Power of Two', 'e'], ['Hamming Distance', 'e'],
    ['Minimum Operations to Make the Integer Zero', 'm'],
  ]],
  ['math-geometry', 'Math and Geometry', [
    ['Minimum Area Rectangle', 'm'], ['Maximum Area Rectangle With Point Constraints I', 'm'],
    ['Reverse Integer', 'm'], ['Minimum Number of Lines to Cover Points', 'm'],
    ['Minimize Manhattan Distances', 'h'], ['Convex Polygon', 'm'], ['Check If It Is a Straight Line', 'e'],
    ['Minimum Cuts to Divide a Circle', 'e'], ['Valid Square', 'm'], ['Rectangle Overlap', 'e'],
    ['Minimum Time Visiting All Points', 'e'], ['Rectangle Area', 'm'],
    ['Queries on Number of Points Inside a Circle', 'm'], ['Max Points on a Line', 'h'],
    ['Maximum Number of Visible Points', 'h'], ['Detonate the Maximum Bombs', 'm'], ['Self Crossing', 'h'],
    ['Erect the Fence', 'h'], ['Nth Magical Number', 'h'], ['Add Strings', 'e'], ['Perfect Squares', 'm'],
    ['Palindrome Number', 'e'], ['Fibonacci Number', 'e'], ['Integer to English Words', 'h'],
    ['Add Two Numbers', 'm'], ['Plus One', 'e'], ['Confusing Number', 'e'], ['Nim Game', 'e'],
    ['Bulb Switcher', 'm'], ['Water and Jug Problem', 'm'], ['Poor Pigs', 'h'],
    ['Add to Array-Form of Integer', 'e'], ['Greatest Common Divisor of Strings', 'e'],
    ['Count Substrings with Only One Distinct Letter', 'e'], ['Equal Rational Numbers', 'h'],
    ['Adding Two Negabinary Numbers', 'm'], ['Power of Three', 'e'], ['Base 7', 'e'],
    ['Sum of k-Mirror Numbers', 'h'], ['Sum of Squares of Special Elements', 'e'], ['Add Digits', 'm'],
    ['Count Primes', 'm'], ['Pow(x, n)', 'm'],
  ]],
];

// Roadmap title -> LeetCode slug, for titles that differ from LeetCode's canonical name.
// Every entry was verified against the catalog snapshot (slug exists, identity confirmed) —
// these are known renames of the SAME problem, never "similar" problems.
const LEETCODE_ALIASES = {
  'Find the Lexicographically Largest String From Box II': 'find-the-lexicographically-largest-string-from-the-box-ii',
  'Longest Subarray With Diff At Most Limit': 'longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit',
  'Maximize Capital': 'ipo',
  'Find Median from a Data Stream': 'find-median-from-data-stream',
  'Split Array Into Two Arrays to Minimize Sum Difference': 'partition-array-into-two-arrays-to-minimize-sum-difference',
  'Jump Game I': 'jump-game',
  'Gas Stations': 'gas-station',
  'Number of Steps to Reduce a Binary Number to One': 'number-of-steps-to-reduce-a-number-in-binary-representation-to-one',
  'Find the Corrupt Pair': 'set-mismatch',
  'Set Matrix Zeros': 'set-matrix-zeroes',
  'Build Binary Tree from Preorder and Inorder Traversal': 'construct-binary-tree-from-preorder-and-inorder-traversal',
  'Sum of Distances in a Tree': 'sum-of-distances-in-tree',
  'Level Order Traversal of Binary Tree': 'binary-tree-level-order-traversal',
  'Implement Trie': 'implement-trie-prefix-tree',
  'Check If a Word is a Prefix of Any Word in a Sentence': 'check-if-a-word-occurs-as-a-prefix-of-any-word-in-a-sentence',
  'Implement LRU Cache': 'lru-cache',
  "All O'one Data Structures": 'all-oone-data-structure',
  'Find the Longest Substring Having Vowels in Even Counts': 'find-the-longest-substring-containing-vowels-in-even-counts',
};

// Educative/Grokking originals with no exact LeetCode counterpart. Mapping these to a
// "similar" LeetCode problem would either misrepresent the problem or duplicate a mapping
// that another roadmap question already owns (e.g. Compilation Order ≡ Course Schedule,
// which is its own row) — so they deliberately carry no external link.
const NOT_ON_LEETCODE = new Set([
  'Linked List Cycle III',
  'Linked List Cycle IV',
  'Schedule Tasks on Minimum Machines',
  'Kth Smallest Number in M Sorted Lists',
  'K Maximum Sum Combinations From Two Arrays',
  'Find K-Sum Subsets',
  '0/1 Knapsack',
  'Find the First K Missing Positive Numbers',
  'Cyclic Sort',
  'Compilation Order',
  'Connect All Siblings of a Binary Tree',
]);

// ── Curriculum intelligence (scripts/data/curriculum.json) ─────────────────────────────
// Hand-verified problem families ("these questions are the same idea underneath") and
// sub-pattern groupings. Same closed-world rule as external identity: every referenced
// title must exact-match a SECTIONS entry of the declared pattern, or the build fails.
// Emitted as src/data/families.json + src/data/subpatterns.json, plus per-question
// `familyId`/`subpattern` fields on questions.json.
const FAMILY_ROLES = new Set(['canonical', 'warmup', 'standard', 'variant', 'stretch']);
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateCurriculum(curriculum, titlesByPattern) {
  const errors = [];
  const patternIds = new Set(titlesByPattern.keys());
  // Family members may come from any section (a family may deliberately reach across
  // patterns to show the same idea under another banner); subpatterns stay pattern-pure.
  const allTitles = new Set([...titlesByPattern.values()].flatMap((s) => [...s]));
  const familyIds = new Set();
  const titleToFamily = new Map();

  for (const f of curriculum.families) {
    const where = `family "${f.id}"`;
    if (!KEBAB.test(f.id)) errors.push(`${where}: id must be kebab-case`);
    if (familyIds.has(f.id)) errors.push(`${where}: duplicate family id`);
    familyIds.add(f.id);
    if (!patternIds.has(f.pattern)) errors.push(`${where}: unknown pattern "${f.pattern}"`);
    for (const field of ['name', 'idea', 'trap']) {
      if (typeof f[field] !== 'string' || f[field].trim() === '') errors.push(`${where}: empty ${field}`);
    }
    if (!Array.isArray(f.signals) || f.signals.length < 2 || f.signals.some((s) => typeof s !== 'string' || !s.trim())) {
      errors.push(`${where}: signals must be 2+ non-empty strings`);
    }
    if (!Array.isArray(f.members) || f.members.length < 3) {
      errors.push(`${where}: needs 3+ members`);
      continue;
    }
    let canonicals = 0;
    for (const [title, role] of f.members) {
      if (!FAMILY_ROLES.has(role)) errors.push(`${where}: invalid role "${role}" on "${title}"`);
      if (role === 'canonical') canonicals++;
      if (!allTitles.has(title)) {
        errors.push(`${where}: "${title}" is not a SECTIONS title`);
      }
      if (titleToFamily.has(title)) {
        errors.push(`${where}: "${title}" already belongs to family "${titleToFamily.get(title)}"`);
      }
      titleToFamily.set(title, f.id);
    }
    if (canonicals !== 1) errors.push(`${where}: needs exactly one canonical member, found ${canonicals}`);
  }

  const titleToSubpattern = new Map();
  for (const [patternId, groups] of Object.entries(curriculum.subpatterns)) {
    if (!patternIds.has(patternId)) errors.push(`subpatterns: unknown pattern "${patternId}"`);
    const sectionTitles = titlesByPattern.get(patternId) ?? new Set();
    const groupIds = new Set();
    for (const g of groups) {
      const where = `subpattern "${patternId}/${g.id}"`;
      if (!KEBAB.test(g.id)) errors.push(`${where}: id must be kebab-case`);
      if (groupIds.has(g.id)) errors.push(`${where}: duplicate subpattern id in pattern`);
      groupIds.add(g.id);
      if (typeof g.name !== 'string' || g.name.trim() === '') errors.push(`${where}: empty name`);
      if (!Array.isArray(g.titles) || g.titles.length === 0) errors.push(`${where}: empty titles`);
      for (const title of g.titles ?? []) {
        if (!sectionTitles.has(title)) errors.push(`${where}: "${title}" is not a SECTIONS title of "${patternId}"`);
        const key = `${patternId}::${title}`;
        if (titleToSubpattern.has(key)) {
          errors.push(`${where}: "${title}" already in subpattern "${titleToSubpattern.get(key)}"`);
        }
        titleToSubpattern.set(key, g.id);
      }
    }
  }

  return { errors, titleToFamily, titleToSubpattern };
}

// ── Question intelligence (scripts/data/question-intelligence.json) ────────────────────
// The per-question educational layer: what the problem tests, what kind of practice it is,
// how long a first attempt realistically takes, and the intended complexity. Same closed-world
// rule as everything else — the key set must be EXACTLY the SECTIONS titles, so a renamed or
// newly added question can never ship without its teaching content, and a stale key can never
// linger unnoticed.
//
// `minutes` replaces the old flat per-difficulty constant. The bands below are the editorial
// contract: an estimate must stay inside its difficulty's band, and the whole dataset must
// actually use the band's range (VARIETY_MIN distinct values), because a band collapsed to one
// value carries no information and silently reverts to the flat table this replaced.
const QUESTION_TYPES = new Set([
  'foundation',      // the base technique in its clearest form
  'recognition',     // spotting a known technique under a disguise
  'implementation',  // approach is obvious; the work is bookkeeping and edge cases
  'optimization',    // a brute force exists; the skill is beating its bound
  'variant',         // one changed constraint breaks the standard solution
  'design',          // build a structure that answers queries, not one answer
]);
const MINUTE_BANDS = { easy: [8, 20], medium: [20, 35], hard: [35, 60] };
const VARIETY_MIN = 4; // distinct minute values required per difficulty
const TESTS_WORDS = [8, 45];
// A Big-O clause, optionally qualified ("O(1) amortized"); a complexity may carry two of them
// ("O(log n) average, O(n) worst") for problems whose bound genuinely depends on the case.
// Nesting is checked by counting rather than by pattern, because real bounds nest arbitrarily
// deep — O(log(max(tx, ty))) and O((n + m) log(n + m)) are both legitimate and neither fits a
// fixed-depth regex.
const O_QUALIFIER = /^(amortized|average|expected|worst)$/;

function isBigOClause(text) {
  if (!text.startsWith('O(')) return false;
  let depth = 0;
  let end = -1;
  for (let i = 1; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return false;              // unbalanced
  if (end === 2) return false;               // empty "O()"
  const rest = text.slice(end + 1).trim();
  return rest === '' || O_QUALIFIER.test(rest);
}

function isBigO(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  // Split on the comma that separates two case-qualified clauses — but only at depth 0, so
  // commas inside a bound like O(log(max(tx, ty))) do not split it.
  const clauses = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    else if (value[i] === ',' && depth === 0) {
      clauses.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  clauses.push(value.slice(start).trim());
  return clauses.length <= 2 && clauses.every(isBigOClause);
}
// `tests` is shown BEFORE the attempt, so it must describe the skill, not restate the prompt.
const TESTS_BAD_OPENERS = /^(this (problem|question)|the problem|it |asks )/i;

function validateIntelligence(intel, titlesByPattern, difficultyByTitle) {
  const errors = [];
  const allTitles = new Set([...titlesByPattern.values()].flatMap((s) => [...s]));

  for (const title of Object.keys(intel)) {
    if (!allTitles.has(title)) errors.push(`intelligence: "${title}" is not a SECTIONS title`);
  }
  for (const title of allTitles) {
    if (!(title in intel)) errors.push(`intelligence: missing entry for "${title}"`);
  }

  const minutesByDifficulty = { easy: new Set(), medium: new Set(), hard: new Set() };

  for (const [title, entry] of Object.entries(intel)) {
    const where = `intelligence "${title}"`;
    const difficulty = difficultyByTitle.get(title);
    if (!difficulty) continue; // already reported as an unknown title

    if (!QUESTION_TYPES.has(entry.type)) {
      errors.push(`${where}: invalid type "${entry.type}"`);
    }

    if (typeof entry.tests !== 'string' || entry.tests.trim() === '') {
      errors.push(`${where}: empty tests`);
    } else {
      const words = entry.tests.trim().split(/\s+/).length;
      if (words < TESTS_WORDS[0] || words > TESTS_WORDS[1]) {
        errors.push(`${where}: tests must be ${TESTS_WORDS[0]}-${TESTS_WORDS[1]} words, got ${words}`);
      }
      if (TESTS_BAD_OPENERS.test(entry.tests.trim())) {
        errors.push(`${where}: tests restates the prompt instead of naming the skill`);
      }
    }

    const [lo, hi] = MINUTE_BANDS[difficulty];
    if (typeof entry.minutes !== 'number' || !Number.isInteger(entry.minutes) || entry.minutes < lo || entry.minutes > hi) {
      errors.push(`${where}: minutes must be an integer in ${lo}..${hi} for ${difficulty}, got ${entry.minutes}`);
    } else {
      minutesByDifficulty[difficulty].add(entry.minutes);
    }

    if (entry.complexity !== undefined) {
      const { time, space } = entry.complexity ?? {};
      if (!isBigO(time)) errors.push(`${where}: complexity.time "${time}" is not Big-O form`);
      if (!isBigO(space)) errors.push(`${where}: complexity.space "${space}" is not Big-O form`);
    }

    for (const key of Object.keys(entry)) {
      if (!['type', 'tests', 'minutes', 'complexity'].includes(key)) {
        errors.push(`${where}: unknown field "${key}"`);
      }
    }
  }

  for (const [difficulty, values] of Object.entries(minutesByDifficulty)) {
    if (values.size > 0 && values.size < VARIETY_MIN) {
      errors.push(
        `intelligence: ${difficulty} estimates collapsed to ${values.size} distinct value(s) — ` +
          `the band exists to carry information, not to be a renamed constant`,
      );
    }
  }

  return errors;
}

// ── Company interview evidence (scripts/data/companies.json) ───────────────────────────
// Same closed-world discipline as everything else, aimed at the one failure mode that matters
// here: claiming more than the source says. The rules below are the whole integrity model.
//
//  - Every entry needs a live first-party URL, a verbatim quote, and the date it was checked.
//  - `patterns` may be non-empty ONLY when `evidence === 'topics'` — i.e. only when the company's
//    own page actually enumerates data structures or algorithms. A page that says "data
//    structures and algorithms" and stops has no pattern-level content to map, and the schema
//    refuses to let one be invented for it.
//  - There is no per-problem field anywhere. See the file's own _readme for why.
//  - `namedProblems` is the one place a source's own problem wording may be recorded, and it is
//    NOT a mapping: the strings are shown exactly as the page phrases them. Because that field is
//    the closest this dataset comes to a per-problem claim, it may only exist alongside a
//    substantial `namedProblemsNote` bounding what is being claimed — enforced below.
const EVIDENCE_TIERS = new Set(['topics', 'categories', 'avoids-puzzles']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_QUOTE_CHARS = 40;
// A caveat short enough to fit in a tweet is not a caveat. The LinkedIn entry — 2016, one
// specialist role, explicitly the warm-up tier — needs all three of those facts to be read
// correctly, and any future entry here will need something similar.
const MIN_PROBLEM_NOTE_CHARS = 120;
const COMPANY_FIELDS = [
  'id', 'name', 'sourceLabel', 'url', 'checkedAt', 'evidence', 'quote',
  'namedTopics', 'patterns', 'namedProblems', 'namedProblemsNote', 'note',
];

function validateCompanies(companies, patternIds) {
  const errors = [];
  const ids = new Set();

  for (const c of companies) {
    const where = `company "${c.id}"`;
    if (!KEBAB.test(c.id ?? '')) errors.push(`${where}: id must be kebab-case`);
    if (ids.has(c.id)) errors.push(`${where}: duplicate id`);
    ids.add(c.id);

    if (typeof c.name !== 'string' || c.name.trim() === '') errors.push(`${where}: empty name`);
    // The UI attributes the quote to a named page, not just to a company — "Google Careers —
    // Software Engineer interview prep guide" is a checkable citation, "Google" is a brand.
    if (typeof c.sourceLabel !== 'string' || c.sourceLabel.trim() === '') {
      errors.push(`${where}: sourceLabel must name the specific page being quoted`);
    }
    if (typeof c.url !== 'string' || !c.url.startsWith('https://')) {
      errors.push(`${where}: url must be an https first-party link`);
    }
    if (!ISO_DATE.test(c.checkedAt ?? '')) errors.push(`${where}: checkedAt must be yyyy-MM-dd`);
    if (!EVIDENCE_TIERS.has(c.evidence)) errors.push(`${where}: unknown evidence tier "${c.evidence}"`);
    if (typeof c.quote !== 'string' || c.quote.trim().length < MIN_QUOTE_CHARS) {
      errors.push(`${where}: quote must be a real verbatim excerpt (${MIN_QUOTE_CHARS}+ chars)`);
    }
    if (!Array.isArray(c.namedTopics) || c.namedTopics.some((t) => typeof t !== 'string' || !t.trim())) {
      errors.push(`${where}: namedTopics must be an array of non-empty strings`);
    }

    if (!Array.isArray(c.patterns)) {
      errors.push(`${where}: patterns must be an array`);
      continue;
    }
    for (const p of c.patterns) {
      if (!patternIds.has(p)) errors.push(`${where}: unknown pattern "${p}"`);
    }
    if (new Set(c.patterns).size !== c.patterns.length) errors.push(`${where}: duplicate pattern`);
    // The load-bearing rule.
    if (c.evidence !== 'topics' && c.patterns.length > 0) {
      errors.push(
        `${where}: evidence is "${c.evidence}" but ${c.patterns.length} pattern(s) are claimed — ` +
          `only a source that enumerates topics can support pattern-level relevance`,
      );
    }
    if (c.evidence === 'topics' && c.patterns.length === 0) {
      errors.push(`${where}: evidence is "topics" but no patterns were mapped`);
    }

    if (c.namedProblems !== undefined) {
      if (!Array.isArray(c.namedProblems) || c.namedProblems.some((p) => typeof p !== 'string' || !p.trim())) {
        errors.push(`${where}: namedProblems must be an array of non-empty verbatim strings`);
      } else if (c.namedProblems.length > 0) {
        if (typeof c.namedProblemsNote !== 'string' || c.namedProblemsNote.trim().length < MIN_PROBLEM_NOTE_CHARS) {
          errors.push(
            `${where}: namedProblems is populated but namedProblemsNote is missing or too short ` +
              `(${MIN_PROBLEM_NOTE_CHARS}+ chars) — a problem-level claim must carry its own scope and limits`,
          );
        }
      }
    }
    if (c.namedProblemsNote !== undefined && (c.namedProblems ?? []).length === 0) {
      errors.push(`${where}: namedProblemsNote without namedProblems`);
    }

    for (const key of Object.keys(c)) {
      if (!COMPANY_FIELDS.includes(key)) {
        errors.push(`${where}: unknown field "${key}"`);
      }
    }
  }

  return errors;
}

// ── ML implementation tracks & project ladder ──────────────────────────────────────────
// scripts/data/ml-implementation.json → src/data/mlTracks.json
// scripts/data/ml-projects.json       → src/data/mlProjects.json
//
// Same closed-world discipline as everything else, against two reference sets that live
// outside these files:
//
//  - `weekId` must be a real week id from src/data/aimlCourse.ts, or an EXPLICIT null. Many are
//    null on purpose: the 26-week course runs orientation → neural networks → transformers →
//    PyTorch → agents → RAG → fine-tuning → RL → evals, so it contains no classical-ML week and
//    k-means, PCA, decision trees and naive Bayes have nowhere honest to attach. A missing key
//    is a failure; a stated null is a fact. That distinction is the whole rule — inventing a
//    mapping would be a false claim about the curriculum, and so would quietly dropping the field.
//  - `prereqs` / `prereqTracks` must resolve to a real track id, and the prereq graph must be
//    acyclic. At eleven nodes a cycle is invisible to the eye and would make the ladder
//    unorderable, so it is checked rather than trusted.
//
// Every track carries all five stages (math → scratch → library → experiment → failure), each
// non-empty, and `failure` needs at least two entries: by the file's own _readme the failure list
// is its highest-value content, and one entry is a caveat rather than a failure analysis.
//
// Two content gates worth naming, because they guard the claim this data makes about itself:
// an experiment's `expect` and a stated `baseline.score` must both contain a digit. Both fields
// exist to carry a measured number; prose where a number belongs is exactly how a "measured"
// dataset turns into a remembered one. And where `baseline.score` is null — the honest answer
// when the figure is a property of the learner's own system — a substantial `note` is mandatory,
// because a null without a note reads as a gap in the research rather than a refusal to invent.
const ML_STAGE_ORDER = ['math', 'scratch', 'library', 'experiment', 'failure'];
const ML_TRACK_FIELDS = ['id', 'title', 'weekId', 'prereqs', 'minutes', 'tests', 'stages'];
const ML_TRACK_MINUTES = [30, 300];
const ML_MIN_FAILURES = 2;
const ML_FAILURE_FIELDS = ['symptom', 'cause', 'fix'];
// [required text fields, {listField: minimumLength}]
const ML_STAGE_SCHEMA = {
  math: { text: ['summary', 'detail'], objectLists: { symbols: [4, ['symbol', 'meaning']] } },
  scratch: { text: ['summary'], lists: { checklist: 5, shapes: 3 } },
  library: { text: ['summary', 'version', 'detail'], lists: { api: 3 } },
  experiment: { text: ['summary', 'dataset', 'metric', 'expect'] },
};

const ML_TIERS = ['beginner', 'intermediate', 'advanced', 'deep-learning', 'nlp', 'modern-ai', 'production'];
const ML_PROJECT_FIELDS = [
  'id', 'tier', 'order', 'title', 'objective', 'dataset', 'baseline', 'metric',
  'experiments', 'errorAnalysis', 'iteration', 'deployment', 'retrospective', 'hours',
  'prereqTracks', 'weekId',
];
const ML_DATASET_FIELDS = ['name', 'source', 'size', 'license', 'checkedAt', 'note'];
const ML_BASELINE_FIELDS = ['model', 'score', 'metric', 'note'];
const ML_METRIC_FIELDS = ['name', 'why'];
// A `why` that only praises the chosen metric is not a justification. The length floor is a
// proxy for "argues against the obvious alternative in one sentence" — the shortest one on file
// is 263 chars, so this catches a field being emptied out, not honest brevity.
const ML_MIN_WHY_CHARS = 120;
const ML_MIN_NULL_BASELINE_NOTE = 120;
const ML_PROJECT_HOURS = [2, 60];
const ML_EXPERIMENTS = [2, 4];
// The two fields the projects file exists to refuse. Answers shipped alongside the retrospective
// turn the ladder back into a tutorial, and they are properties of the learner's own runs.
const ML_FORBIDDEN_PROJECT_FIELDS = ['solution', 'walkthrough', 'answers'];

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isTextList = (v, min) => Array.isArray(v) && v.length >= min && v.every(isText);
const hasDigit = (v) => typeof v === 'string' && /\d/.test(v);

/** Course week ids, read straight out of the hand-maintained TS module — one source of truth. */
function courseWeekIds() {
  const source = readFileSync(join(root, 'src', 'data', 'aimlCourse.ts'), 'utf8');
  return new Set([...source.matchAll(/\bid: '([^']+)'/g)].map((m) => m[1]));
}

/** First cycle in a prereq graph, as a readable path, or null. Missing edges are ignored here. */
function findCycle(edges) {
  const state = new Map();
  const stack = [];
  let cycle = null;
  const visit = (id) => {
    if (cycle) return;
    const seen = state.get(id);
    if (seen === 'done') return;
    if (seen === 'open') {
      cycle = [...stack.slice(stack.indexOf(id)), id];
      return;
    }
    state.set(id, 'open');
    stack.push(id);
    for (const next of edges.get(id) ?? []) visit(next);
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of edges.keys()) visit(id);
  return cycle;
}

function validateStage(where, name, stage, errors) {
  if (name === 'failure') {
    if (!Array.isArray(stage) || stage.length < ML_MIN_FAILURES) {
      errors.push(
        `${where}: the failure stage needs ${ML_MIN_FAILURES}+ entries — one entry is a caveat, ` +
          `not a failure analysis, and this is the field the dataset exists for`,
      );
      return;
    }
    stage.forEach((f, i) => {
      for (const field of ML_FAILURE_FIELDS) {
        if (!isText(f?.[field])) errors.push(`${where}: failure[${i}] has an empty ${field}`);
      }
      for (const key of Object.keys(f ?? {})) {
        if (!ML_FAILURE_FIELDS.includes(key)) errors.push(`${where}: failure[${i}] unknown field "${key}"`);
      }
    });
    return;
  }

  const schema = ML_STAGE_SCHEMA[name];
  if (typeof stage !== 'object' || stage === null || Array.isArray(stage)) {
    errors.push(`${where}: the ${name} stage must be an object`);
    return;
  }
  for (const field of schema.text) {
    if (!isText(stage[field])) errors.push(`${where}: ${name}.${field} is empty`);
  }
  for (const [field, min] of Object.entries(schema.lists ?? {})) {
    if (!isTextList(stage[field], min)) {
      errors.push(`${where}: ${name}.${field} must be ${min}+ non-empty strings`);
    }
  }
  for (const [field, [min, keys]] of Object.entries(schema.objectLists ?? {})) {
    const list = stage[field];
    if (!Array.isArray(list) || list.length < min) {
      errors.push(`${where}: ${name}.${field} must have ${min}+ entries`);
    } else {
      list.forEach((entry, i) => {
        for (const key of keys) {
          if (!isText(entry?.[key])) errors.push(`${where}: ${name}.${field}[${i}].${key} is empty`);
        }
      });
    }
  }
  const known = [...schema.text, ...Object.keys(schema.lists ?? {}), ...Object.keys(schema.objectLists ?? {})];
  for (const key of Object.keys(stage)) {
    if (!known.includes(key)) errors.push(`${where}: ${name} has unknown field "${key}"`);
  }
  // A stated expectation with no figure in it is a recollection wearing a measurement's clothes.
  if (name === 'experiment' && isText(stage.expect) && !hasDigit(stage.expect)) {
    errors.push(`${where}: experiment.expect states no number — every expectation here is a measured run`);
  }
}

function validateMlTracks(source, weekIds) {
  const errors = [];
  const tracks = source.tracks;
  if (!Array.isArray(tracks) || tracks.length === 0) return { errors: ['ml-tracks: no tracks in the source file'], trackIds: new Set() };

  const trackIds = new Set();
  for (const t of tracks) {
    const where = `track "${t.id}"`;
    if (!KEBAB.test(t.id ?? '')) errors.push(`${where}: id must be kebab-case`);
    if (trackIds.has(t.id)) errors.push(`${where}: duplicate id`);
    trackIds.add(t.id);

    if (!isText(t.title)) errors.push(`${where}: empty title`);
    if (!isText(t.tests)) errors.push(`${where}: empty tests — a track must say what it tests`);
    const [lo, hi] = ML_TRACK_MINUTES;
    if (!Number.isInteger(t.minutes) || t.minutes < lo || t.minutes > hi) {
      errors.push(`${where}: minutes must be an integer in ${lo}..${hi}, got ${t.minutes}`);
    }

    if (!('weekId' in t)) {
      errors.push(`${where}: weekId is missing — write an explicit null where the course has no week`);
    } else if (t.weekId !== null && !weekIds.has(t.weekId)) {
      errors.push(`${where}: weekId "${t.weekId}" is not a week in aimlCourse.ts (use null, never a near miss)`);
    }

    if (!Array.isArray(t.prereqs)) {
      errors.push(`${where}: prereqs must be an array`);
    } else {
      if (new Set(t.prereqs).size !== t.prereqs.length) errors.push(`${where}: duplicate prereq`);
      if (t.prereqs.includes(t.id)) errors.push(`${where}: lists itself as a prereq`);
    }

    if (typeof t.stages !== 'object' || t.stages === null || Array.isArray(t.stages)) {
      errors.push(`${where}: stages must be an object with all five stages`);
    } else {
      for (const stage of ML_STAGE_ORDER) {
        if (!(stage in t.stages)) errors.push(`${where}: missing the "${stage}" stage`);
        else validateStage(where, stage, t.stages[stage], errors);
      }
      for (const key of Object.keys(t.stages)) {
        if (!ML_STAGE_ORDER.includes(key)) errors.push(`${where}: unknown stage "${key}"`);
      }
    }

    for (const key of Object.keys(t)) {
      if (!ML_TRACK_FIELDS.includes(key)) errors.push(`${where}: unknown field "${key}"`);
    }
  }

  // Reference + cycle checks once every id is known.
  const edges = new Map();
  for (const t of tracks) {
    const resolved = (Array.isArray(t.prereqs) ? t.prereqs : []).filter((p) => {
      if (!trackIds.has(p)) {
        errors.push(`track "${t.id}": prereq "${p}" is not a track id`);
        return false;
      }
      return true;
    });
    edges.set(t.id, resolved);
  }
  const cycle = findCycle(edges);
  if (cycle) errors.push(`ml-tracks: prereq cycle ${cycle.join(' → ')} — the ladder cannot be ordered`);

  return { errors, trackIds };
}

function validateMlProjects(source, trackIds, weekIds) {
  const errors = [];
  const projects = source.projects;
  if (!Array.isArray(projects) || projects.length === 0) return ['ml-projects: no projects in the source file'];

  const ids = new Set();
  const slots = new Set();
  for (const p of projects) {
    const where = `project "${p.id}"`;
    if (!KEBAB.test(p.id ?? '')) errors.push(`${where}: id must be kebab-case`);
    if (ids.has(p.id)) errors.push(`${where}: duplicate id`);
    ids.add(p.id);

    if (!ML_TIERS.includes(p.tier)) errors.push(`${where}: unknown tier "${p.tier}"`);
    if (!Number.isInteger(p.order) || p.order < 1) errors.push(`${where}: order must be a positive integer`);
    const slot = `${p.tier}#${p.order}`;
    if (slots.has(slot)) errors.push(`${where}: tier slot ${slot} is already taken — order is the reading sequence`);
    slots.add(slot);

    for (const field of ['title', 'objective', 'iteration']) {
      if (!isText(p[field])) errors.push(`${where}: empty ${field}`);
    }
    if (!isTextList(p.experiments, ML_EXPERIMENTS[0]) || p.experiments.length > ML_EXPERIMENTS[1]) {
      errors.push(`${where}: experiments must be ${ML_EXPERIMENTS[0]}-${ML_EXPERIMENTS[1]} non-empty strings`);
    }
    if (!isTextList(p.errorAnalysis, 3)) errors.push(`${where}: errorAnalysis must be 3+ non-empty strings`);
    if (!isTextList(p.retrospective, 3)) errors.push(`${where}: retrospective must be 3+ non-empty questions`);
    if (p.deployment !== null && !isText(p.deployment)) {
      errors.push(`${where}: deployment must be a string or an explicit null`);
    }
    const [hlo, hhi] = ML_PROJECT_HOURS;
    if (!Number.isInteger(p.hours) || p.hours < hlo || p.hours > hhi) {
      errors.push(`${where}: hours must be an integer in ${hlo}..${hhi}, got ${p.hours}`);
    }

    // --- dataset ---
    const d = p.dataset ?? {};
    for (const field of ['name', 'source', 'size', 'license']) {
      if (!isText(d[field])) errors.push(`${where}: dataset.${field} is empty`);
    }
    if (!ISO_DATE.test(d.checkedAt ?? '')) errors.push(`${where}: dataset.checkedAt must be yyyy-MM-dd`);
    if (d.note !== undefined && !isText(d.note)) errors.push(`${where}: dataset.note is present but empty`);
    for (const key of Object.keys(d)) {
      if (!ML_DATASET_FIELDS.includes(key)) errors.push(`${where}: dataset has unknown field "${key}"`);
    }

    // --- baseline: the field the file exists for ---
    const b = p.baseline ?? {};
    if (!isText(b.model)) errors.push(`${where}: baseline.model is empty — name the dumb model`);
    if (!isText(b.metric)) errors.push(`${where}: baseline.metric is empty — a score means nothing unlabelled`);
    if (b.score === null) {
      if (!isText(b.note) || b.note.trim().length < ML_MIN_NULL_BASELINE_NOTE) {
        errors.push(
          `${where}: baseline.score is null but the note is missing or under ${ML_MIN_NULL_BASELINE_NOTE} ` +
            `chars — a null is a refusal to invent a number, and must say who establishes it`,
        );
      }
    } else if (!isText(b.score)) {
      errors.push(`${where}: baseline.score must be a stated string or an explicit null`);
    } else if (!hasDigit(b.score)) {
      errors.push(`${where}: baseline.score "${b.score}" contains no figure`);
    }
    if (b.note !== undefined && !isText(b.note)) errors.push(`${where}: baseline.note is present but empty`);
    for (const key of Object.keys(b)) {
      if (!ML_BASELINE_FIELDS.includes(key)) errors.push(`${where}: baseline has unknown field "${key}"`);
    }

    // --- metric: name plus the argument against the obvious alternative ---
    const m = p.metric ?? {};
    if (!isText(m.name)) errors.push(`${where}: metric.name is empty`);
    if (!isText(m.why) || m.why.trim().length < ML_MIN_WHY_CHARS) {
      errors.push(
        `${where}: metric.why must be ${ML_MIN_WHY_CHARS}+ chars arguing against the obvious ` +
          `alternative — accuracy-by-default is the habit this field exists to break`,
      );
    }
    for (const key of Object.keys(m)) {
      if (!ML_METRIC_FIELDS.includes(key)) errors.push(`${where}: metric has unknown field "${key}"`);
    }

    // --- references ---
    if (!Array.isArray(p.prereqTracks) || p.prereqTracks.length === 0) {
      errors.push(`${where}: prereqTracks must name at least one implementation track`);
    } else {
      if (new Set(p.prereqTracks).size !== p.prereqTracks.length) errors.push(`${where}: duplicate prereqTrack`);
      for (const t of p.prereqTracks) {
        if (!trackIds.has(t)) errors.push(`${where}: prereqTrack "${t}" is not a track id`);
      }
    }
    if (!('weekId' in p)) {
      errors.push(`${where}: weekId is missing — write an explicit null where the course has no week`);
    } else if (p.weekId !== null && !weekIds.has(p.weekId)) {
      errors.push(`${where}: weekId "${p.weekId}" is not a week in aimlCourse.ts (use null, never a near miss)`);
    }

    for (const key of Object.keys(p)) {
      if (ML_FORBIDDEN_PROJECT_FIELDS.includes(key)) {
        errors.push(`${where}: "${key}" is not supported — a project that ships its answers is a tutorial`);
      } else if (!ML_PROJECT_FIELDS.includes(key)) {
        errors.push(`${where}: unknown field "${key}"`);
      }
    }
  }

  return errors;
}

// Case/punctuation-insensitive title key — LeetCode uses backticks, apostrophes, and
// spelling variants ("Zeroes") that must not defeat an otherwise-exact match.
const normalizeTitle = (t) =>
  t
    .toLowerCase()
    .replace(/[‘’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const catalog = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'leetcode-catalog.json'), 'utf8'));
const catalogBySlug = new Map(catalog.problems.map((p) => [p.slug, p]));
const catalogByTitleKey = new Map();
for (const p of catalog.problems) {
  const key = normalizeTitle(p.title);
  // First occurrence wins; the dry run confirmed zero collisions among roadmap titles.
  if (!catalogByTitleKey.has(key)) catalogByTitleKey.set(key, p);
}

function resolveLeetCode(title) {
  if (NOT_ON_LEETCODE.has(title)) return null;
  const aliasSlug = LEETCODE_ALIASES[title];
  const problem = aliasSlug ? catalogBySlug.get(aliasSlug) : catalogByTitleKey.get(normalizeTitle(title));
  if (!problem) {
    console.error(
      `UNRESOLVED: "${title}" — not an exact catalog match, not aliased, not declared NOT_ON_LEETCODE. ` +
        `Fix the title, add a verified alias, or declare it unresolved.`,
    );
    process.exitCode = 1;
    return null;
  }
  return problem;
}

const curriculum = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'curriculum.json'), 'utf8'));
const titlesByPattern = new Map(SECTIONS.map(([pid, , items]) => [pid, new Set(items.map(([t]) => t))]));
const {
  errors: curriculumErrors,
  titleToFamily,
  titleToSubpattern,
} = validateCurriculum(curriculum, titlesByPattern);
if (curriculumErrors.length > 0) {
  for (const e of curriculumErrors) console.error(`CURRICULUM: ${e}`);
  process.exitCode = 1;
}

const intelligence = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'question-intelligence.json'), 'utf8'));
const difficultyByTitle = new Map(SECTIONS.flatMap(([, , items]) => items.map(([t, d]) => [t, D[d]])));
const intelligenceErrors = validateIntelligence(intelligence, titlesByPattern, difficultyByTitle);
if (intelligenceErrors.length > 0) {
  for (const e of intelligenceErrors) console.error(`INTELLIGENCE: ${e}`);
  process.exitCode = 1;
}

const companiesSource = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'companies.json'), 'utf8'));
const companyErrors = validateCompanies(companiesSource.companies, new Set(titlesByPattern.keys()));
if (companyErrors.length > 0) {
  for (const e of companyErrors) console.error(`COMPANIES: ${e}`);
  process.exitCode = 1;
}

const mlTracksSource = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'ml-implementation.json'), 'utf8'));
const mlProjectsSource = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'ml-projects.json'), 'utf8'));
const weekIds = courseWeekIds();
const { errors: mlTrackErrors, trackIds } = validateMlTracks(mlTracksSource, weekIds);
if (mlTrackErrors.length > 0) {
  for (const e of mlTrackErrors) console.error(`ML-TRACKS: ${e}`);
  process.exitCode = 1;
}
const mlProjectErrors = validateMlProjects(mlProjectsSource, trackIds, weekIds);
if (mlProjectErrors.length > 0) {
  for (const e of mlProjectErrors) console.error(`ML-PROJECTS: ${e}`);
  process.exitCode = 1;
}

// Abort BEFORE writing anything. Setting exitCode alone let the run continue to the write step,
// where a missing intelligence entry became `estimatedTime: undefined` — dropped by
// JSON.stringify — shipping a question with three required fields absent. A failed closed-world
// check must leave the previous artifact untouched, not corrupt it and report failure afterwards.
if (process.exitCode === 1) {
  console.error('Aborting before write: validation failed above. src/data/ left unchanged.');
  process.exit(1);
}

let id = 0;
const questions = [];
const patterns = [];
const difficultyMismatches = [];
for (const [patternId, patternName, items] of SECTIONS) {
  patterns.push({ id: patternId, name: patternName, count: items.length });
  for (const [title, d] of items) {
    const difficulty = D[d];
    const problem = resolveLeetCode(title);
    const familyId = titleToFamily.get(title);
    const subpattern = titleToSubpattern.get(`${patternId}::${title}`);
    // Validation above guarantees an entry exists for every title (or the build already failed).
    const intel = intelligence[title] ?? {};
    questions.push({
      id: ++id,
      title,
      pattern: patternId,
      difficulty,
      // Authored per question, band-checked against difficulty — not a per-difficulty constant.
      estimatedTime: intel.minutes,
      type: intel.type,
      tests: intel.tests,
      ...(intel.complexity ? { complexity: intel.complexity } : {}),
      ...(subpattern ? { subpattern } : {}),
      ...(familyId ? { familyId } : {}),
      // Present only when the exact LeetCode problem is verified: the URL is constructed
      // from the catalog's own slug, never guessed. `premium` marks paywalled problems so
      // the UI can say so before the user clicks into a wall.
      ...(problem
        ? {
            url: `https://leetcode.com/problems/${problem.slug}/`,
            leetcodeId: problem.id,
            ...(problem.paid ? { premium: true } : {}),
          }
        : {}),
    });
    // Informational only: the roadmap's difficulty is its own editorial pacing judgment
    // (and feeds locked XP values), so LeetCode disagreement is reported, never applied.
    if (problem && problem.difficulty !== difficulty) {
      difficultyMismatches.push(`  #${id} ${title}: roadmap ${difficulty} vs LeetCode ${problem.difficulty}`);
    }
  }
}

if (process.exitCode === 1) {
  console.error('Aborting: unresolved titles above.');
  process.exit(1);
}

mkdirSync(join(root, 'src', 'data'), { recursive: true });
writeFileSync(join(root, 'src', 'data', 'questions.json'), JSON.stringify(questions, null, 2) + '\n');

// Families and subpatterns resolved to question ids — the app never joins on titles.
const idByTitle = new Map(questions.map((q) => [q.title, q.id]));
const familiesOut = curriculum.families.map((f) => ({
  id: f.id,
  pattern: f.pattern,
  name: f.name,
  idea: f.idea,
  signals: f.signals,
  trap: f.trap,
  members: f.members.map(([title, role]) => ({ questionId: idByTitle.get(title), role })),
}));
writeFileSync(join(root, 'src', 'data', 'families.json'), JSON.stringify(familiesOut, null, 2) + '\n');

const subpatternsOut = {};
for (const [patternId, groups] of Object.entries(curriculum.subpatterns)) {
  subpatternsOut[patternId] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    questionIds: g.titles.map((t) => idByTitle.get(t)),
  }));
}
writeFileSync(join(root, 'src', 'data', 'subpatterns.json'), JSON.stringify(subpatternsOut, null, 2) + '\n');

// Companies pass through unchanged apart from dropping the source file's _readme — the app
// reads exactly what was validated above, with no derived or inferred fields added.
writeFileSync(
  join(root, 'src', 'data', 'companies.json'),
  JSON.stringify(companiesSource.companies, null, 2) + '\n',
);

// ML tracks and projects pass through unchanged apart from dropping each source file's _readme
// (which is written for the editor of the source, not for the app). Nothing is derived here: the
// app reads exactly the content that was validated above.
writeFileSync(
  join(root, 'src', 'data', 'mlTracks.json'),
  JSON.stringify(mlTracksSource.tracks, null, 2) + '\n',
);
writeFileSync(
  join(root, 'src', 'data', 'mlProjects.json'),
  JSON.stringify(mlProjectsSource.projects, null, 2) + '\n',
);

const byDiff = questions.reduce((a, q) => ((a[q.difficulty] = (a[q.difficulty] ?? 0) + 1), a), {});
const linked = questions.filter((q) => q.url).length;
const inFamily = questions.filter((q) => q.familyId).length;
const inSubpattern = questions.filter((q) => q.subpattern).length;
console.log(`total: ${questions.length}`);
console.log('difficulties:', byDiff);
console.log(`leetcode-linked: ${linked} (${questions.length - linked} declared not-on-leetcode)`);
console.log(`families: ${familiesOut.length} (${inFamily} member questions); subpatterned: ${inSubpattern}`);
const byType = questions.reduce((a, q) => ((a[q.type] = (a[q.type] ?? 0) + 1), a), {});
const withComplexity = questions.filter((q) => q.complexity).length;
const estMinutes = questions.reduce((s, q) => s + q.estimatedTime, 0);
console.log('question types:', byType);
console.log(`complexity stated: ${withComplexity}/${questions.length}; total estimated ${Math.round(estMinutes / 60)}h`);
const mlTracks = mlTracksSource.tracks;
const mlProjects = mlProjectsSource.projects;
const failureCount = mlTracks.reduce((s, t) => s + t.stages.failure.length, 0);
console.log(
  `ml tracks: ${mlTracks.length} (${mlTracks.filter((t) => t.weekId !== null).length} attached to a course week, ` +
    `${mlTracks.filter((t) => t.weekId === null).length} deliberately unattached); ` +
    `${failureCount} documented failure modes`,
);
console.log(
  `ml projects: ${mlProjects.length} across ${new Set(mlProjects.map((p) => p.tier)).size} tiers, ` +
    `${mlProjects.filter((p) => p.baseline.score !== null).length} with a stated baseline score, ` +
    `${mlProjects.filter((p) => p.baseline.score === null).length} the learner must establish; ` +
    `${mlProjects.reduce((s, p) => s + p.hours, 0)}h of work`,
);
if (difficultyMismatches.length > 0) {
  console.log(`difficulty disagreements vs LeetCode (informational, not applied): ${difficultyMismatches.length}`);
  for (const m of difficultyMismatches) console.log(m);
}
for (const p of patterns) console.log(`${p.id}: ${p.count}`);
