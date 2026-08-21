# The Topic-Wise Revision Sheet — resolution report

**Generated** by `scripts/report-revision-sheet.mjs` from `scripts/data/revision-sheet.txt`.
Never hand-edit this file; fix the sheet or the resolver and re-run.

> This is **not** `report.md` (the repository audit). It is a separate document answering one
> question: of the problems on this sheet, which are on LeetCode, what are their IDs and
> links, and which does this repository already have?

## How this was produced, and what it is worth

Every fact below comes from files already committed to this repository — **no network was**
**used**, which is the same rule the app itself lives by:

| Source | What it supplied |
|---|---|
| `scripts/data/leetcode-topics.json` | 4,029 LeetCode problems: frontend id, slug, official difficulty, paid flag, topic tags |
| `scripts/data/leetcode-catalog.json` | the title/slug catalog the 539 curriculum questions resolve against |
| `src/data/questions.json` | the 539-question curriculum — "is this already on my roadmap?" |
| `src/data/contestLibrary.json` | the 2,561 rated contest problems — "is this contest-rated, and at what rating?" |

**Matching is closed-world**, exactly like the question generator: a sheet title resolves only
by exact normalized title match or through a hand-verified alias that was checked against the
snapshot one by one. Nothing is fuzzy-matched and nothing is guessed. A wrong link in a
revision list is worse than a missing one — it sends you to the wrong problem and gives you no
way to notice. Where a title genuinely names more than one problem it is reported as
**ambiguous with its candidates**, not silently resolved.

## The headline

| | |
|---|---|
| Rows on the sheet | **1,210** across 23 topics and 99 sub-topics |
| Resolved to LeetCode | 1,075 rows → **1,016 unique problems** (rows repeat across sub-topics) |
| Not on LeetCode | 134 rows — GeeksforGeeks, CSES, Codeforces, AtCoder, or pure theory |
| Unresolved | **0** |
| Ambiguous | 1 (listed in full below) |
| Premium-gated | 3 |

### Every row's explicit state

The states partition the sheet — every row carries exactly one, and the row counts sum to
**1,210** by construction (the script fails if they do not). `DUPLICATE` marks a row
repeating an earlier row's identity; unique counts are first occurrences.

| State | Rows | Unique problems | Meaning |
|---|---:|---:|---|
| `ROADMAP_ALREADY_EXISTS` | 295 | 295 | On the 539 roadmap — referenced, never copied; excluded from draws by default |
| `CONTEST_LIBRARY_ALREADY_EXISTS` | 562 | 562 | In the 2,561 contest library — referenced by slug |
| `REVISION_ONLY_NEW` | 159 | 159 | In neither universe — one of the additions the sheet actually brings |
| `NON_LEETCODE_EXTERNAL` | 133 | 133 | Another platform — platform named, nothing linked, nothing tracked |
| `AMBIGUOUS` | 1 | 1 | Title names more than one problem — reported with candidates, never guessed |
| `UNRESOLVED` | 0 | 0 | Could not be resolved at all |
| `DUPLICATE` | 60 | — | Repeats an earlier row's identity — deliberate sheet design, counted here |
| **Total** | **1,210** | | |

### The finding that should shape the plan

**857 of the 1,016 unique LeetCode problems — 84% — are already in this repository.**

| Where it already lives | Count | What that means for revision |
|---|---:|---|
| In **both** the 539 roadmap and the contest library | 99 | Already tracked; one identity, one record |
| In the **539 roadmap** only | 196 | Already on your roadmap — **must be excluded from new revision draws** |
| In the **contest library** only | 562 | Already practisable at `/contest-practice`; rated |
| In **neither** | 159 | Genuinely new — the only problems that need adding |

So this sheet is not a third question universe. It is **a topic-wise ordering over problems you
mostly already have**, plus 159 additions. That is a far smaller and safer change than it looks,
and it is the whole basis of the integration plan at the end.

Of the 1,016 unique problems, **295** are on your 539 roadmap. Your rule —
*revision must not repeat what the roadmap already covers* — is therefore satisfiable by
construction, not by a filter you have to remember to apply.

---

## Coverage by topic — what you have, and what is missing

The table every plan should start from: per topic, how many distinct LeetCode problems the
sheet names, how many this repository already tracks, and how many would have to be added.

> **The topic counts deliberately do not sum to 1,016.** A problem the sheet lists under two
> topics is counted once in each, because for revision it genuinely belongs to both. The
> **Total** row is the de-duplicated truth across the whole sheet, which is why it is smaller
> than the column above it.

| Topic | Unique problems | Already have | on roadmap | in library | **Need to add** | Have |
|---|---:|---:|---:|---:|---:|---|
| 2 Pointers | 39 | 34 | 17 | 17 | **5** | 87% |
| Prefix Sum | 23 | 19 | 3 | 16 | **4** | 83% |
| Matrix | 44 | 44 | 12 | 32 | 0 | 100% |
| Hashing | 91 | 82 | 18 | 64 | **9** | 90% |
| Sliding Window | 37 | 36 | 17 | 19 | **1** | 97% |
| Linked List | 25 | 20 | 16 | 4 | **5** | 80% |
| Stack | 56 | 48 | 18 | 30 | **8** | 86% |
| Queue | 16 | 12 | 3 | 9 | **4** | 75% |
| Binary Search | 80 | 69 | 29 | 40 | **11** | 86% |
| Bit Manipulation | 39 | 28 | 9 | 19 | **11** | 72% |
| Recursion & Backtracking | 35 | 26 | 17 | 9 | **9** | 74% |
| Binary Tree | 36 | 20 | 14 | 6 | **16** | 56% |
| Binary Search Tree | 26 | 14 | 4 | 10 | **12** | 54% |
| Heap (Priority Queue) | 68 | 64 | 30 | 34 | **4** | 94% |
| Tries | 30 | 26 | 12 | 14 | **4** | 87% |
| Greedy | 54 | 49 | 11 | 38 | **5** | 91% |
| Dynamic Programming Level 1 | 156 | 116 | 35 | 81 | **40** | 74% |
| Graphs | 97 | 92 | 31 | 61 | **5** | 95% |
| Combinatorics & Geometry | 28 | 24 | 11 | 13 | **4** | 86% |
| Game Theory | 10 | 8 | 1 | 7 | **2** | 80% |
| Dynamic Programming Level 2 | 49 | 40 | 5 | 35 | **9** | 82% |
| String Matching Algos | 16 | 15 | 1 | 14 | **1** | 94% |
| Advance algorithm | 17 | 13 | 1 | 12 | **4** | 76% |
| *(sum of the column above — counts overlaps twice)* | *1072* | *899* | *315* | *584* | *173* | |
| **Total, de-duplicated** | **1,016** | **857** | **295** | **562** | **159** | **84%** |

**Where the gaps actually are.** 1 of the 23 topics needs **nothing added at all** (Matrix). The additions concentrate in a handful of topics: **Dynamic Programming Level 1** (40), **Binary Tree** (16), **Binary Search Tree** (12), **Binary Search** (11), **Bit Manipulation** (11).

Read the `on roadmap` column as the one that matters for your no-repeat rule: those are the
**295** problems a revision draw has to exclude by default, and the table shows exactly
which topics that thins out most.

## Reading the tables

| Column | Meaning |
|---|---|
| **#** | LeetCode's **frontend id** — the number LeetCode displays, and the one you can search. |
| **Difficulty** | LeetCode's official difficulty. Where the sheet disagrees, the sheet's value is shown in brackets and the row is listed again under *Difficulty disagreements*. |
| **Rating** | ZeroTrac's estimated contest rating, when the problem was a rated contest problem. An estimate for relative comparison — never an official LeetCode number. |
| **Contest** | The contest the problem premiered in, compact: `W333 · Q1` = Weekly Contest 333, first problem; `B71` = Biweekly 71. `—` = not a rated contest problem. |
| **Have it?** | `roadmap #N` = already question N of your 539. `library` = already in the 2,561 contest pool. `NEW` = in neither. |

---

## The sheet, topic by topic

### 2 Pointers

39 rows · 39 unique LeetCode problems · 17 already on your roadmap · 5 new

#### Two Pointer on Arrays

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 2570 | [Merge Two 2D Arrays by Summing Values](https://leetcode.com/problems/merge-two-2d-arrays-by-summing-values/) | Easy | 1281 | W333 · Q1 | library |
| 88 | [Merge Sorted Array](https://leetcode.com/problems/merge-sorted-array/) | Easy | — | — | roadmap #105 |
| 905 | [Sort Array by Parity](https://leetcode.com/problems/sort-array-by-parity/) | Easy | 1178 | W102 · Q1 | library |
| 922 | [Sort Array by Parity II](https://leetcode.com/problems/sort-array-by-parity-ii/) | Easy | 1174 | W106 · Q1 | roadmap #251 + library |
| 2149 | [Rearrange Array Elements by Sign](https://leetcode.com/problems/rearrange-array-elements-by-sign/) | Medium | 1236 | W277 · Q2 | library |
| 26 | [Remove Duplicates from Sorted Array](https://leetcode.com/problems/remove-duplicates-from-sorted-array/) | Easy | — | — | roadmap #25 |
| 27 | [Remove Element](https://leetcode.com/problems/remove-element/) | Easy | — | — | roadmap #21 |
| 2161 | [Partition Array According to Given Pivot](https://leetcode.com/problems/partition-array-according-to-given-pivot/) | Medium | 1338 | B71 · Q2 | library |
| 189 | [Rotate Array](https://leetcode.com/problems/rotate-array/) | Medium | — | — | roadmap #23 |
| 2460 | [Apply Operations to an Array](https://leetcode.com/problems/apply-operations-to-an-array/) | Easy | 1224 | W318 · Q1 | library |
| 2200 | [Find All K-Distant Indices in an Array](https://leetcode.com/problems/find-all-k-distant-indices-in-an-array/) | Easy | 1266 | W284 · Q1 | library |
| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | — | — | **NEW** |
| 15 | [3Sum](https://leetcode.com/problems/3sum/) | Medium | — | — | roadmap #2 |
| 16 | [3Sum Closest](https://leetcode.com/problems/3sum-closest/) | Medium | — | — | **NEW** |
| 18 | [4Sum](https://leetcode.com/problems/4sum/) | Medium | — | — | **NEW** |
| 75 | [Sort Colors](https://leetcode.com/problems/sort-colors/) | Medium | — | — | roadmap #4 |
| 11 | [Container With Most Water](https://leetcode.com/problems/container-with-most-water/) | Medium | — | — | **NEW** |
| 2105 | [Watering Plants II](https://leetcode.com/problems/watering-plants-ii/) | Medium | 1507 | W271 · Q3 | library |
| 31 | [Next Permutation](https://leetcode.com/problems/next-permutation/) | Medium | — | — | roadmap #24 |
| 556 | [Next Greater Element III](https://leetcode.com/problems/next-greater-element-iii/) | Medium | — | — | roadmap #33 |

#### Two Pointer on Strings

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 344 | [Reverse String](https://leetcode.com/problems/reverse-string/) | Easy | — | — | roadmap #18 |
| 2000 | [Reverse Prefix of Word](https://leetcode.com/problems/reverse-prefix-of-word/) | Easy | 1199 | W258 · Q1 | library |
| 345 | [Reverse Vowels of a String](https://leetcode.com/problems/reverse-vowels-of-a-string/) | Easy | — | — | roadmap #26 |
| 151 | [Reverse Words in a String](https://leetcode.com/problems/reverse-words-in-a-string/) | Medium | — | — | roadmap #5 |
| 557 | [Reverse Words in a String III](https://leetcode.com/problems/reverse-words-in-a-string-iii/) | Easy | — | — | **NEW** |
| 125 | [Valid Palindrome](https://leetcode.com/problems/valid-palindrome/) | Easy | — | — | roadmap #1 |
| 680 | [Valid Palindrome II](https://leetcode.com/problems/valid-palindrome-ii/) | Easy | — | — | roadmap #7 |
| 2697 | [Lexicographically Smallest Palindrome](https://leetcode.com/problems/lexicographically-smallest-palindrome/) | Easy | 1304 | W346 · Q2 | library |
| 1768 | [Merge Strings Alternately](https://leetcode.com/problems/merge-strings-alternately/) | Easy | 1167 | W229 · Q1 | roadmap #28 + library |
| 1754 | [Largest Merge of Two Strings](https://leetcode.com/problems/largest-merge-of-two-strings/) | Medium | 1829 | W227 · Q3 | library |
| 821 | [Shortest Distance to a Character](https://leetcode.com/problems/shortest-distance-to-a-character/) | Easy | 1266 | W81 · Q1 | library |
| 942 | [DI String Match](https://leetcode.com/problems/di-string-match/) | Easy | 1444 | W111 · Q3 | library |
| 2825 | [Make String a Subsequence Using Cyclic Increments](https://leetcode.com/problems/make-string-a-subsequence-using-cyclic-increments/) | Medium | 1415 | B111 · Q2 | library |
| 696 | [Count Binary Substrings](https://leetcode.com/problems/count-binary-substrings/) | Easy | — | — | roadmap #448 |
| 1750 | [Minimum Length of String After Deleting Similar Ends](https://leetcode.com/problems/minimum-length-of-string-after-deleting-similar-ends/) | Medium | 1502 | B45 · Q3 | library |
| 443 | [String Compression](https://leetcode.com/problems/string-compression/) | Medium | — | — | roadmap #22 |
| 2938 | [Separate Black and White Balls](https://leetcode.com/problems/separate-black-and-white-balls/) | Medium | 1423 | W372 · Q2 | library |
| 2337 | [Move Pieces to Obtain a String](https://leetcode.com/problems/move-pieces-to-obtain-a-string/) | Medium | 1693 | W301 · Q3 | library |
| 1813 | [Sentence Similarity III](https://leetcode.com/problems/sentence-similarity-iii/) | Medium | 1589 | B49 · Q2 | library |

### Prefix Sum

24 rows · 23 unique LeetCode problems · 3 already on your roadmap · 4 new

#### Prefix Sum

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 303 | [Range Sum Query - Immutable](https://leetcode.com/problems/range-sum-query-immutable/) | Easy | — | — | roadmap #473 |
| 2574 | [Left and Right Sum Differences](https://leetcode.com/problems/left-and-right-sum-differences/) | Easy | 1206 | W334 · Q1 | library |
| 2559 | [Count Vowel Strings in Ranges](https://leetcode.com/problems/count-vowel-strings-in-ranges/) | Medium | 1435 | W331 · Q2 | library |
| 2483 | [Minimum Penalty for a Shop](https://leetcode.com/problems/minimum-penalty-for-a-shop/) | Medium | 1495 | B92 · Q3 | library |
| 2100 | [Find Good Days to Rob the Bank](https://leetcode.com/problems/find-good-days-to-rob-the-bank/) | Medium | 1702 | B67 · Q2 | library |
| 1685 | [Sum of Absolute Differences in a Sorted Array](https://leetcode.com/problems/sum-of-absolute-differences-in-a-sorted-array/) | Medium | 1496 | B41 · Q2 | library |
| 238 | [Product of Array Except Self](https://leetcode.com/problems/product-of-array-except-self/) | Medium | — | — | **NEW** |
| 1352 | [Product of the Last K Numbers](https://leetcode.com/problems/product-of-the-last-k-numbers/) | Medium | 1474 | W176 · Q2 | library |
| 2171 | [Removing Minimum Number of Magic Beans](https://leetcode.com/problems/removing-minimum-number-of-magic-beans/) | Medium | 1748 | W280 · Q3 | library |
| 2420 | [Find All Good Indices](https://leetcode.com/problems/find-all-good-indices/) | Medium | 1695 | W312 · Q3 | library |
| 2731 | [Movement of Robots](https://leetcode.com/problems/movement-of-robots/) | Medium | 1923 | B106 · Q3 | library |
| 304 | [Range Sum Query 2D - Immutable](https://leetcode.com/problems/range-sum-query-2d-immutable/) | Medium | — | — | **NEW** |
| 2536 | [Increment Submatrices by One](https://leetcode.com/problems/increment-submatrices-by-one/) | Medium | 1583 | W328 · Q2 | library |
| 2681 | [Power of Heroes](https://leetcode.com/problems/power-of-heroes/) | Hard | 2060 | B104 · Q4 | library |
| 2448 | [Minimum Cost to Make Array Equal](https://leetcode.com/problems/minimum-cost-to-make-array-equal/) | Hard | 2005 | W316 · Q3 | library |

#### Line Sweep

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1854 | [Maximum Population Year](https://leetcode.com/problems/maximum-population-year/) | Easy | 1370 | W240 · Q1 | library |
| 2848 | [Points That Intersect With Cars](https://leetcode.com/problems/points-that-intersect-with-cars/) | Easy | 1230 | W362 · Q1 | library |
| — | Pongal Bunk | Medium | — | — | not on LeetCode · Codeforces |
| 1094 | [Car Pooling](https://leetcode.com/problems/car-pooling/) | Medium | 1441 | W142 · Q2 | roadmap #76 + library |
| 731 | [My Calendar II](https://leetcode.com/problems/my-calendar-ii/) | Medium | — | — | **NEW** |
| 2381 | [Shifting Letters II](https://leetcode.com/problems/shifting-letters-ii/) | Medium | 1793 | B85 · Q3 | library |
| 391 | [Perfect Rectangle](https://leetcode.com/problems/perfect-rectangle/) | Hard | — | — | **NEW** |
| 850 | [Rectangle Area II](https://leetcode.com/problems/rectangle-area-ii/) | Hard | 2236 | W88 · Q4 | library |
| 2251 | [Number of Flowers in Full Bloom](https://leetcode.com/problems/number-of-flowers-in-full-bloom/) | Hard | 2022 | W290 · Q4 | roadmap #145 + library |

### Matrix

44 rows · 44 unique LeetCode problems · 12 already on your roadmap · 0 new

#### Matrix Transformation and Modification

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 2022 | [Convert 1D Array Into 2D Array](https://leetcode.com/problems/convert-1d-array-into-2d-array/) | Easy | 1307 | B62 · Q1 | roadmap #289 + library |
| 3033 | [Modify the Matrix](https://leetcode.com/problems/modify-the-matrix/) | Easy | 1181 | W384 · Q1 | library |
| 73 | [Set Matrix Zeroes](https://leetcode.com/problems/set-matrix-zeroes/) | Medium | — | — | roadmap #284 |
| 1329 | [Sort the Matrix Diagonally](https://leetcode.com/problems/sort-the-matrix-diagonally/) | Medium | 1548 | B18 · Q3 | library |
| 3071 | [Minimum Operations to Write the Letter Y on a Grid](https://leetcode.com/problems/minimum-operations-to-write-the-letter-y-on-a-grid/) | Medium | 1690 | W387 · Q3 | library |
| 1260 | [Shift 2D Grid](https://leetcode.com/problems/shift-2d-grid/) | Easy | 1337 | W163 · Q1 | library |
| 2946 | [Matrix Similarity After Cyclic Shifts](https://leetcode.com/problems/matrix-similarity-after-cyclic-shifts/) | Easy | 1406 | W373 · Q1 | library |
| 867 | [Transpose Matrix](https://leetcode.com/problems/transpose-matrix/) | Easy | 1259 | W92 · Q1 | roadmap #293 + library |
| 48 | [Rotate Image](https://leetcode.com/problems/rotate-image/) | Medium | — | — | roadmap #285 |
| 1861 | [Rotating the Box](https://leetcode.com/problems/rotating-the-box/) | Medium | 1537 | B52 · Q3 | roadmap #34 + library |
| 1914 | [Cyclically Rotating a Grid](https://leetcode.com/problems/cyclically-rotating-a-grid/) | Medium | 1766 | W247 · Q2 | library |
| 289 | [Game of Life](https://leetcode.com/problems/game-of-life/) | Medium | — | — | roadmap #301 |
| 1030 | [Matrix Cells in Distance Order](https://leetcode.com/problems/matrix-cells-in-distance-order/) | Easy | 1586 | W133 · Q2 | library |

#### Matrix Patterns and Validity Checks

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1605 | [Find Valid Matrix Given Row and Column Sums](https://leetcode.com/problems/find-valid-matrix-given-row-and-column-sums/) | Medium | 1868 | B36 · Q3 | library |
| 2319 | [Check if Matrix is X-Matrix](https://leetcode.com/problems/check-if-matrix-is-x-matrix/) | Easy | 1201 | W299 · Q1 | library |
| 1222 | [Queens That Can Attack the King](https://leetcode.com/problems/queens-that-can-attack-the-king/) | Medium | 1392 | W158 · Q2 | library |
| 807 | [Max Increase to Keep City Skyline](https://leetcode.com/problems/max-increase-to-keep-city-skyline/) | Medium | 1376 | W77 · Q3 | library |
| 3127 | [Make a Square with the Same Color](https://leetcode.com/problems/make-a-square-with-the-same-color/) | Easy | 1338 | B129 · Q1 | library |
| 1476 | [Subrectangle Queries](https://leetcode.com/problems/subrectangle-queries/) | Medium *(sheet: Easy)* | 1326 | B28 · Q2 | library |
| 3070 | [Count Submatrices with Top-Left Element and Sum Less Than k](https://leetcode.com/problems/count-submatrices-with-top-left-element-and-sum-less-than-k/) | Medium | 1499 | W387 · Q2 | library |
| 3195 | [Find the Minimum Area to Cover All Ones I](https://leetcode.com/problems/find-the-minimum-area-to-cover-all-ones-i/) | Medium | 1348 | W403 · Q2 | library |
| 3197 | [Find the Minimum Area to Cover All Ones II](https://leetcode.com/problems/find-the-minimum-area-to-cover-all-ones-ii/) | Hard | 2541 | W403 · Q4 | library |
| 36 | [Valid Sudoku](https://leetcode.com/problems/valid-sudoku/) | Medium | — | — | roadmap #413 |
| 1958 | [Check if Move is Legal](https://leetcode.com/problems/check-if-move-is-legal/) | Medium | 1659 | B58 · Q2 | library |
| 794 | [Valid Tic-Tac-Toe State](https://leetcode.com/problems/valid-tic-tac-toe-state/) | Medium | 1545 | W74 · Q1 | library |
| 2125 | [Number of Laser Beams in a Bank](https://leetcode.com/problems/number-of-laser-beams-in-a-bank/) | Medium | 1280 | W274 · Q2 | library |
| 1706 | [Where Will the Ball Fall](https://leetcode.com/problems/where-will-the-ball-fall/) | Medium | 1765 | W221 · Q3 | roadmap #287 + library |
| 835 | [Image Overlap](https://leetcode.com/problems/image-overlap/) | Medium | 1970 | W84 · Q3 | library |
| 2033 | [Minimum Operations to Make a Uni-Value Grid](https://leetcode.com/problems/minimum-operations-to-make-a-uni-value-grid/) | Medium | 1672 | W262 · Q2 | library |

#### Matrix Traversal and Summation

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 2643 | [Row With Maximum Ones](https://leetcode.com/problems/row-with-maximum-ones/) | Easy | 1174 | W341 · Q1 | library |
| 1672 | [Richest Customer Wealth](https://leetcode.com/problems/richest-customer-wealth/) | Easy | 1183 | W217 · Q1 | library |
| 1380 | [Lucky Numbers in a Matrix](https://leetcode.com/problems/lucky-numbers-in-a-matrix/) | Easy | 1208 | W180 · Q1 | roadmap #330 + library |
| 2352 | [Equal Row and Column Pairs](https://leetcode.com/problems/equal-row-and-column-pairs/) | Medium | 1286 | W303 · Q2 | library |
| 2482 | [Difference Between Ones and Zeros in Row and Column](https://leetcode.com/problems/difference-between-ones-and-zeros-in-row-and-column/) | Medium | 1373 | B92 · Q2 | library |
| 1572 | [Matrix Diagonal Sum](https://leetcode.com/problems/matrix-diagonal-sum/) | Easy | 1280 | B34 · Q1 | library |
| 2614 | [Prime in Diagonal](https://leetcode.com/problems/prime-in-diagonal/) | Easy | 1375 | W340 · Q1 | library |
| 498 | [Diagonal Traverse](https://leetcode.com/problems/diagonal-traverse/) | Medium | — | — | roadmap #303 |
| 1314 | [Matrix Block Sum](https://leetcode.com/problems/matrix-block-sum/) | Medium | 1484 | B17 · Q2 | library |
| 2373 | [Largest Local Values in a Matrix](https://leetcode.com/problems/largest-local-values-in-a-matrix/) | Easy | 1331 | W306 · Q1 | library |
| 2428 | [Maximum Sum of an Hourglass](https://leetcode.com/problems/maximum-sum-of-an-hourglass/) | Medium | 1290 | W313 · Q2 | library |
| 1975 | [Maximum Matrix Sum](https://leetcode.com/problems/maximum-matrix-sum/) | Medium | 1648 | B59 · Q2 | library |
| 3030 | [Find the Grid of Region Average](https://leetcode.com/problems/find-the-grid-of-region-average/) | Medium | 1896 | W383 · Q3 | library |
| 54 | [Spiral Matrix](https://leetcode.com/problems/spiral-matrix/) | Medium | — | — | roadmap #286 |
| 59 | [Spiral Matrix II](https://leetcode.com/problems/spiral-matrix-ii/) | Medium | — | — | roadmap #290 |

### Hashing

92 rows · 91 unique LeetCode problems · 18 already on your roadmap · 9 new

#### Implementary Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 2956 | [Find Common Elements Between Two Arrays](https://leetcode.com/problems/find-common-elements-between-two-arrays/) | Easy | 1215 | B119 · Q1 | library |
| 217 | [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/) | Easy | — | — | **NEW** |
| 1748 | [Sum of Unique Elements](https://leetcode.com/problems/sum-of-unique-elements/) | Easy | 1228 | B45 · Q1 | library |
| 442 | [Find All Duplicates in an Array](https://leetcode.com/problems/find-all-duplicates-in-an-array/) | Medium | — | — | **NEW** |
| 1941 | [Check if All Characters Have Equal Number of Occurrences](https://leetcode.com/problems/check-if-all-characters-have-equal-number-of-occurrences/) | Easy | 1243 | B57 · Q1 | library |
| 1207 | [Unique Number of Occurrences](https://leetcode.com/problems/unique-number-of-occurrences/) | Easy | 1196 | W156 · Q1 | roadmap #401 + library |
| 1002 | [Find Common Characters](https://leetcode.com/problems/find-common-characters/) | Easy | 1280 | W126 · Q1 | library |
| 1512 | [Number of Good Pairs](https://leetcode.com/problems/number-of-good-pairs/) | Easy | 1161 | W197 · Q1 | library |
| 3146 | [Permutation Difference Between Two Strings](https://leetcode.com/problems/permutation-difference-between-two-strings/) | Easy | 1152 | W397 · Q1 | library |
| 1832 | [Check if the Sentence is Pangram](https://leetcode.com/problems/check-if-the-sentence-is-pangram/) | Easy | 1167 | W237 · Q1 | library |
| 2325 | [Decode the Message](https://leetcode.com/problems/decode-the-message/) | Easy | 1268 | W300 · Q1 | library |
| 2295 | [Replace Elements in an Array](https://leetcode.com/problems/replace-elements-in-an-array/) | Medium | 1445 | W296 · Q3 | library |
| 3121 | [Count the Number of Special Characters II](https://leetcode.com/problems/count-the-number-of-special-characters-ii/) | Medium | 1412 | W394 · Q2 | library |
| 423 | [Reconstruct Original Digits from English](https://leetcode.com/problems/reconstruct-original-digits-from-english/) | Medium | — | — | **NEW** |
| 12 | [Integer to Roman](https://leetcode.com/problems/integer-to-roman/) | Medium | — | — | roadmap #185 |
| 1160 | [Find Words That Can Be Formed by Characters](https://leetcode.com/problems/find-words-that-can-be-formed-by-characters/) | Easy | 1206 | W150 · Q1 | roadmap #441 + library |
| 3158 | [Find the XOR of Numbers Which Appear Twice](https://leetcode.com/problems/find-the-xor-of-numbers-which-appear-twice/) | Easy | 1172 | B131 · Q1 | library |
| 2418 | [Sort the People](https://leetcode.com/problems/sort-the-people/) | Easy | 1193 | W312 · Q1 | library |
| 2605 | [Form Smallest Number from Two-Digit Arrays](https://leetcode.com/problems/form-smallest-number-from-two-digit-arrays/) | Easy | 1242 | B101 · Q1 | library |
| 1370 | [Increasing Decreasing String](https://leetcode.com/problems/increasing-decreasing-string/) | Easy | 1369 | B21 · Q1 | library |
| 1636 | [Sort Array by Increasing Frequency](https://leetcode.com/problems/sort-array-by-increasing-frequency/) | Easy | 1430 | B38 · Q1 | roadmap #444 + library |
| 451 | [Sort Characters by Frequency](https://leetcode.com/problems/sort-characters-by-frequency/) | Medium | — | — | **NEW** |
| 2363 | [Merge Similar Items](https://leetcode.com/problems/merge-similar-items/) | Easy | 1271 | B84 · Q1 | library |
| 1876 | [Substrings of Size Three with Distinct Characters](https://leetcode.com/problems/substrings-of-size-three-with-distinct-characters/) | Easy | 1249 | B53 · Q1 | library |
| 3174 | [Clear Digits](https://leetcode.com/problems/clear-digits/) | Easy | 1255 | B132 · Q1 | library |
| 1410 | [HTML Entity Parser](https://leetcode.com/problems/html-entity-parser/) | Medium | 1405 | W184 · Q3 | library |
| 1624 | [Largest Substring Between Two Equal Characters](https://leetcode.com/problems/largest-substring-between-two-equal-characters/) | Easy | 1282 | W211 · Q1 | library |
| 2423 | [Remove Letter to Equalize Frequency](https://leetcode.com/problems/remove-letter-to-equalize-frequency/) | Easy | 1648 | B88 · Q1 | library |
| 575 | [Distribute Candies](https://leetcode.com/problems/distribute-candies/) | Easy | — | — | **NEW** |
| 1496 | [Path Crossing](https://leetcode.com/problems/path-crossing/) | Easy | 1508 | W195 · Q1 | library |
| 859 | [Buddy Strings](https://leetcode.com/problems/buddy-strings/) | Easy | 1341 | W90 · Q1 | library |
| 290 | [Word Pattern](https://leetcode.com/problems/word-pattern/) | Easy | — | — | roadmap #412 |
| 242 | [Valid Anagram](https://leetcode.com/problems/valid-anagram/) | Easy | — | — | roadmap #426 |
| 2273 | [Find Resultant Array After Removing Anagrams](https://leetcode.com/problems/find-resultant-array-after-removing-anagrams/) | Easy | 1295 | W293 · Q1 | library |
| 49 | [Group Anagrams](https://leetcode.com/problems/group-anagrams/) | Medium | — | — | roadmap #428 |
| 169 | [Majority Element](https://leetcode.com/problems/majority-element/) | Easy | — | — | **NEW** |
| 229 | [Majority Element II](https://leetcode.com/problems/majority-element-ii/) | Medium | — | — | **NEW** |
| 2150 | [Find All Lonely Numbers in the Array](https://leetcode.com/problems/find-all-lonely-numbers-in-the-array/) | Medium | 1276 | W277 · Q3 | library |
| 2996 | [Smallest Missing Integer Greater Than Sequential Prefix Sum](https://leetcode.com/problems/smallest-missing-integer-greater-than-sequential-prefix-sum/) | Easy | 1406 | B121 · Q1 | library |
| 41 | [First Missing Positive](https://leetcode.com/problems/first-missing-positive/) | Hard | — | — | roadmap #248 |
| 2350 | [Shortest Impossible Sequence of Rolls](https://leetcode.com/problems/shortest-impossible-sequence-of-rolls/) | Hard | 1961 | B83 · Q4 | library |
| 3159 | [Find Occurrences of an Element in an Array](https://leetcode.com/problems/find-occurrences-of-an-element-in-an-array/) | Medium | 1263 | B131 · Q2 | library |
| 1897 | [Redistribute Characters to Make All Strings Equal](https://leetcode.com/problems/redistribute-characters-to-make-all-strings-equal/) | Easy | 1309 | W245 · Q1 | library |
| 205 | [Isomorphic Strings](https://leetcode.com/problems/isomorphic-strings/) | Easy | — | — | roadmap #397 |
| 893 | [Groups of Special Equivalent Strings](https://leetcode.com/problems/groups-of-special-equivalent-strings/) | Medium | 1590 | W99 · Q2 | library |
| 916 | [Word Subsets](https://leetcode.com/problems/word-subsets/) | Medium | 1624 | W104 · Q3 | library |
| 3020 | [Find the Maximum Number of Elements in Subset](https://leetcode.com/problems/find-the-maximum-number-of-elements-in-subset/) | Medium | 1741 | W382 · Q2 | library |
| 1452 | [People Whose List of Favorite Companies is Not a Subset of Another List](https://leetcode.com/problems/people-whose-list-of-favorite-companies-is-not-a-subset-of-another-list/) | Medium | 1563 | W189 · Q3 | library |
| 2963 | [Count the Number of Good Partitions](https://leetcode.com/problems/count-the-number-of-good-partitions/) | Hard | 1985 | W375 · Q4 | library |
| 2405 | [Optimal Partition of String](https://leetcode.com/problems/optimal-partition-of-string/) | Medium | 1355 | W310 · Q2 | library |
| 791 | [Custom Sort String](https://leetcode.com/problems/custom-sort-string/) | Medium | 1424 | W73 · Q3 | roadmap #406 + library |
| 1817 | [Finding the Users Active Minutes](https://leetcode.com/problems/finding-the-users-active-minutes/) | Medium | 1360 | W235 · Q2 | library |
| 2610 | [Convert an Array into a 2D Array with Conditions](https://leetcode.com/problems/convert-an-array-into-a-2d-array-with-conditions/) | Medium | 1374 | W339 · Q2 | library |
| 1282 | [Group the People Given the Group Size They Belong To](https://leetcode.com/problems/group-the-people-given-the-group-size-they-belong-to/) | Medium | 1267 | W166 · Q2 | library |
| 1807 | [Evaluate the Bracket Pairs of a String](https://leetcode.com/problems/evaluate-the-bracket-pairs-of-a-string/) | Medium | 1482 | W234 · Q3 | library |
| 3137 | [Minimum Number of Operations to Make Word K-Periodic](https://leetcode.com/problems/minimum-number-of-operations-to-make-word-k-periodic/) | Medium | 1491 | W396 · Q2 | library |
| 1540 | [Can Convert String in K Moves](https://leetcode.com/problems/can-convert-string-in-k-moves/) | Medium | 1631 | B32 · Q2 | library |
| 1743 | [Restore the Array from Adjacent Pairs](https://leetcode.com/problems/restore-the-array-from-adjacent-pairs/) | Medium | 1579 | W226 · Q2 | library |
| 1726 | [Tuple with Same Product](https://leetcode.com/problems/tuple-with-same-product/) | Medium | 1530 | W224 · Q2 | library |
| 2584 | [Split the Array to Make Coprime Products](https://leetcode.com/problems/split-the-array-to-make-coprime-products/) | Hard | 2159 | W335 · Q3 | library |
| 454 | [4Sum II](https://leetcode.com/problems/4sum-ii/) | Medium | — | — | **NEW** |
| 2201 | [Count Artifacts That Can Be Extracted](https://leetcode.com/problems/count-artifacts-that-can-be-extracted/) | Medium | 1525 | W284 · Q2 | library |
| 554 | [Brick Wall](https://leetcode.com/problems/brick-wall/) | Medium | — | — | **NEW** |
| 1010 | [Pairs of Songs with Total Durations Divisible by 60](https://leetcode.com/problems/pairs-of-songs-with-total-durations-divisible-by-60/) | Medium | 1377 | W128 · Q2 | roadmap #436 + library |
| 1138 | [Alphabet Board Path](https://leetcode.com/problems/alphabet-board-path/) | Medium | 1411 | W147 · Q2 | library |
| 966 | [Vowel Spellchecker](https://leetcode.com/problems/vowel-spellchecker/) | Medium | 1795 | W117 · Q3 | roadmap #417 + library |
| 299 | [Bulls and Cows](https://leetcode.com/problems/bulls-and-cows/) | Medium | — | — | roadmap #403 |
| 822 | [Card Flipping Game](https://leetcode.com/problems/card-flipping-game/) | Medium | 1594 | W81 · Q2 | library |
| 3002 | [Maximum Size of a Set After Removals](https://leetcode.com/problems/maximum-size-of-a-set-after-removals/) | Medium | 1917 | W379 · Q3 | library |
| 1906 | [Minimum Absolute Difference Queries](https://leetcode.com/problems/minimum-absolute-difference-queries/) | Medium | 2147 | W246 · Q4 | library |
| 1497 | [Check if Array Pairs are Divisible by K](https://leetcode.com/problems/check-if-array-pairs-are-divisible-by-k/) | Medium | 1787 | W195 · Q2 | library |
| 3185 | [Count Pairs That Form a Complete Day II](https://leetcode.com/problems/count-pairs-that-form-a-complete-day-ii/) | Medium | 1385 | W402 · Q2 | library |
| 2364 | [Count Number of Bad Pairs](https://leetcode.com/problems/count-number-of-bad-pairs/) | Medium | 1622 | B84 · Q2 | library |
| 2808 | [Minimum Seconds to Equalize a Circular Array](https://leetcode.com/problems/minimum-seconds-to-equalize-a-circular-array/) | Medium | 1875 | B110 · Q3 | library |
| 2763 | [Sum of Imbalance Numbers of All Subarrays](https://leetcode.com/problems/sum-of-imbalance-numbers-of-all-subarrays/) | Hard | 2278 | W352 · Q4 | library |
| 1001 | [Grid Illumination](https://leetcode.com/problems/grid-illumination/) | Hard | 1873 | W125 · Q4 | library |
| 1224 | [Maximum Equal Frequency](https://leetcode.com/problems/maximum-equal-frequency/) | Hard | 2051 | W158 · Q4 | library |
| 2561 | [Rearranging Fruits](https://leetcode.com/problems/rearranging-fruits/) | Hard | 2222 | W331 · Q4 | roadmap #170 + library |

#### Hashing With Prefix Sum

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 560 | [Subarray Sum Equals K](https://leetcode.com/problems/subarray-sum-equals-k/) | Medium | — | — | roadmap #422 |
| 974 | [Subarray Sums Divisible by K](https://leetcode.com/problems/subarray-sums-divisible-by-k/) | Medium | 1676 | W119 · Q3 | library |
| 1590 | [Make Sum Divisible by P](https://leetcode.com/problems/make-sum-divisible-by-p/) | Medium | 2039 | B35 · Q3 | library |
| 2364 | [Count Number of Bad Pairs](https://leetcode.com/problems/count-number-of-bad-pairs/) | Medium | 1622 | B84 · Q2 | library |
| 523 | [Continuous Subarray Sum](https://leetcode.com/problems/continuous-subarray-sum/) | Medium | — | — | roadmap #400 |
| 2845 | [Count of Interesting Subarrays](https://leetcode.com/problems/count-of-interesting-subarrays/) | Medium | 2073 | W361 · Q3 | library |
| 1248 | [Count Number of Nice Subarrays](https://leetcode.com/problems/count-number-of-nice-subarrays/) | Medium | 1624 | W161 · Q2 | library |
| 2949 | [Count Beautiful Substrings II](https://leetcode.com/problems/count-beautiful-substrings-ii/) | Hard | 2445 | W373 · Q4 | library |
| 3153 | [Sum of Digit Differences of All Pairs](https://leetcode.com/problems/sum-of-digit-differences-of-all-pairs/) | Medium | 1645 | W398 · Q3 | library |
| 930 | [Binary Subarrays with Sum](https://leetcode.com/problems/binary-subarrays-with-sum/) | Medium | 1592 | W108 · Q2 | roadmap #61 + library |
| 1915 | [Number of Wonderful Substrings](https://leetcode.com/problems/number-of-wonderful-substrings/) | Medium | 2235 | W247 · Q3 | roadmap #404 + library |
| 2588 | [Count the Number of Beautiful Subarrays](https://leetcode.com/problems/count-the-number-of-beautiful-subarrays/) | Medium | 1697 | W336 · Q3 | library |
| 1074 | [Number of Submatrices That Sum to Target](https://leetcode.com/problems/number-of-submatrices-that-sum-to-target/) | Hard | 2189 | W139 · Q4 | library |
| 2488 | [Count Subarrays with Median K](https://leetcode.com/problems/count-subarrays-with-median-k/) | Hard | 1999 | W321 · Q4 | library |

### Sliding Window

37 rows · 37 unique LeetCode problems · 17 already on your roadmap · 1 new

#### Fixed Size Sliding-Window

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1876 | [Substrings of Size Three with Distinct Characters](https://leetcode.com/problems/substrings-of-size-three-with-distinct-characters/) | Easy | 1249 | B53 · Q1 | library |
| 438 | [Find All Anagrams in a String](https://leetcode.com/problems/find-all-anagrams-in-a-string/) | Medium | — | — | roadmap #431 |
| 567 | [Permutation in String](https://leetcode.com/problems/permutation-in-string/) | Medium | — | — | roadmap #62 |
| 1461 | [Check If a String Contains All Binary Codes of Size K](https://leetcode.com/problems/check-if-a-string-contains-all-binary-codes-of-size-k/) | Medium | 1504 | B27 · Q2 | library |
| 1456 | [Maximum Number of Vowels in a Substring of Given Length](https://leetcode.com/problems/maximum-number-of-vowels-in-a-substring-of-given-length/) | Medium | 1263 | W190 · Q2 | library |
| 643 | [Maximum Average Subarray I](https://leetcode.com/problems/maximum-average-subarray-i/) | Easy | — | — | roadmap #55 |
| 1343 | [Number of Sub-arrays of Size K and Average Greater than or Equal to Threshold](https://leetcode.com/problems/number-of-sub-arrays-of-size-k-and-average-greater-than-or-equal-to-threshold/) | Medium | 1317 | B19 · Q2 | library |
| 2090 | [K Radius Subarray Averages](https://leetcode.com/problems/k-radius-subarray-averages/) | Medium | 1358 | W269 · Q2 | library |
| 2461 | [Maximum Sum of Distinct Subarrays With Length K](https://leetcode.com/problems/maximum-sum-of-distinct-subarrays-with-length-k/) | Medium | 1553 | W318 · Q2 | library |
| 2653 | [Sliding Subarray Beauty](https://leetcode.com/problems/sliding-subarray-beauty/) | Medium | 1786 | W342 · Q3 | library |
| 1423 | [Maximum Points You Can Obtain from Cards](https://leetcode.com/problems/maximum-points-you-can-obtain-from-cards/) | Medium | 1574 | W186 · Q2 | library |
| 480 | [Sliding Window Median](https://leetcode.com/problems/sliding-window-median/) | Hard | — | — | roadmap #95 |
| 239 | [Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/) | Hard | — | — | roadmap #46 |
| 1499 | [Max Value of Equation](https://leetcode.com/problems/max-value-of-equation/) | Hard | 2456 | W195 · Q4 | library |
| 689 | [Maximum Sum of 3 Non-Overlapping Subarrays](https://leetcode.com/problems/maximum-sum-of-3-non-overlapping-subarrays/) | Hard | — | — | **NEW** |

#### Dynamic Size Sliding-Window

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 3 | [Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/) | Medium | — | — | roadmap #50 |
| 424 | [Longest Repeating Character Replacement](https://leetcode.com/problems/longest-repeating-character-replacement/) | Medium | — | — | roadmap #48 |
| 1297 | [Maximum Number of Occurrences of a Substring](https://leetcode.com/problems/maximum-number-of-occurrences-of-a-substring/) | Medium | 1748 | W168 · Q3 | library |
| 1004 | [Max Consecutive Ones III](https://leetcode.com/problems/max-consecutive-ones-iii/) | Medium | 1656 | W126 · Q3 | roadmap #65 + library |
| 3234 | [Count the Number of Substrings With Dominant Ones](https://leetcode.com/problems/count-the-number-of-substrings-with-dominant-ones/) | Medium | 2557 | W408 · Q3 | library |
| 76 | [Minimum Window Substring](https://leetcode.com/problems/minimum-window-substring/) | Hard | — | — | roadmap #49 |
| 30 | [Substring with Concatenation of All Words](https://leetcode.com/problems/substring-with-concatenation-of-all-words/) | Hard | — | — | roadmap #60 |
| 209 | [Minimum Size Subarray Sum](https://leetcode.com/problems/minimum-size-subarray-sum/) | Medium | — | — | roadmap #51 |
| 1438 | [Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit](https://leetcode.com/problems/longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit/) | Medium | 1672 | W187 · Q3 | roadmap #66 + library |
| 904 | [Fruit Into Baskets](https://leetcode.com/problems/fruit-into-baskets/) | Medium | 1516 | W102 · Q2 | roadmap #53 + library |
| 713 | [Subarray Product Less Than K](https://leetcode.com/problems/subarray-product-less-than-k/) | Medium | — | — | roadmap #67 |
| 1052 | [Grumpy Bookstore Owner](https://leetcode.com/problems/grumpy-bookstore-owner/) | Medium | 1418 | W138 · Q2 | library |
| 1040 | [Moving Stones Until Consecutive II](https://leetcode.com/problems/moving-stones-until-consecutive-ii/) | Medium | 2456 | W135 · Q4 | library |
| 1248 | [Count Number of Nice Subarrays](https://leetcode.com/problems/count-number-of-nice-subarrays/) | Medium | 1624 | W161 · Q2 | library |
| 795 | [Number of Subarrays with Bounded Maximum](https://leetcode.com/problems/number-of-subarrays-with-bounded-maximum/) | Medium | 1817 | W74 · Q3 | library |
| 1695 | [Maximum Erasure Value](https://leetcode.com/problems/maximum-erasure-value/) | Medium | 1529 | W220 · Q2 | library |
| 1493 | [Longest Subarray of 1's After Deleting One Element](https://leetcode.com/problems/longest-subarray-of-1s-after-deleting-one-element/) | Medium | 1423 | B29 · Q3 | roadmap #31 + library |
| 2537 | [Count the Number of Good Subarrays](https://leetcode.com/problems/count-the-number-of-good-subarrays/) | Medium | 1892 | W328 · Q3 | library |
| 2260 | [Minimum Consecutive Cards to Pick Up](https://leetcode.com/problems/minimum-consecutive-cards-to-pick-up/) | Medium | 1365 | W291 · Q2 | library |
| 1658 | [Minimum Operations to Reduce X to Zero](https://leetcode.com/problems/minimum-operations-to-reduce-x-to-zero/) | Medium | 1817 | W215 · Q3 | library |
| 1838 | [Frequency of the Most Frequent Element](https://leetcode.com/problems/frequency-of-the-most-frequent-element/) | Medium | 1876 | W238 · Q2 | roadmap #54 + library |
| 992 | [Subarrays with K Different Integers](https://leetcode.com/problems/subarrays-with-k-different-integers/) | Hard | 2210 | W123 · Q4 | roadmap #57 + library |

### Linked List

29 rows · 25 unique LeetCode problems · 16 already on your roadmap · 5 new

#### Linked List (Part 1)

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1290 | [Convert Binary Number in a Linked List to Integer](https://leetcode.com/problems/convert-binary-number-in-a-linked-list-to-integer/) | Easy | 1151 | W167 · Q1 | library |
| 160 | [Intersection of Two Linked Lists](https://leetcode.com/problems/intersection-of-two-linked-lists/) | Easy | — | — | roadmap #19 |
| 876 | [Middle of the Linked List](https://leetcode.com/problems/middle-of-the-linked-list/) | Easy | 1232 | W95 · Q1 | roadmap #37 + library |
| 141 | [Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/) | Easy | — | — | roadmap #36 |
| 142 | [Linked List Cycle II](https://leetcode.com/problems/linked-list-cycle-ii/) | Medium | — | — | **NEW** |
| — | Find Length of Loop | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 206 | [Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/) | Easy | — | — | roadmap #79 |
| 234 | [Palindrome Linked List](https://leetcode.com/problems/palindrome-linked-list/) | Easy | — | — | roadmap #40 |
| 25 | [Reverse Nodes in k-Group](https://leetcode.com/problems/reverse-nodes-in-k-group/) | Hard | — | — | roadmap #80 |
| 328 | [Odd Even Linked List](https://leetcode.com/problems/odd-even-linked-list/) | Medium *(sheet: Easy)* | — | — | roadmap #91 |
| 83 | [Remove Duplicates from Sorted List](https://leetcode.com/problems/remove-duplicates-from-sorted-list/) | Easy | — | — | roadmap #89 |
| 19 | [Remove Nth Node From End of List](https://leetcode.com/problems/remove-nth-node-from-end-of-list/) | Medium | — | — | roadmap #3 |
| 2095 | [Delete the Middle Node of a Linked List](https://leetcode.com/problems/delete-the-middle-node-of-a-linked-list/) | Medium | 1324 | W270 · Q2 | library |
| — | Add 1 to a Linked List Number | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 2 | [Add Two Numbers](https://leetcode.com/problems/add-two-numbers/) | Medium | — | — | roadmap #521 |
| — | Sort a Linked List of 0s, 1s, and 2s | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 148 | [Sort List](https://leetcode.com/problems/sort-list/) | Medium | — | — | **NEW** |
| 382 | [Linked List Random Node](https://leetcode.com/problems/linked-list-random-node/) | Medium | — | — | **NEW** |
| 138 | [Copy List with Random Pointer](https://leetcode.com/problems/copy-list-with-random-pointer/) | Medium | — | — | **NEW** |
| — | Flattening a Linked List | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 21 | [Merge Two Sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/) | Easy | — | — | **NEW** |
| 23 | [Merge k Sorted Lists](https://leetcode.com/problems/merge-k-sorted-lists/) | Hard | — | — | roadmap #108 |

#### Linked List (Part 2) : Design Pattern

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 705 | [Design HashSet](https://leetcode.com/problems/design-hashset/) | Easy | — | — | roadmap #474 |
| 706 | [Design HashMap](https://leetcode.com/problems/design-hashmap/) | Easy | — | — | roadmap #393 |
| 1472 | [Design Browser History](https://leetcode.com/problems/design-browser-history/) | Medium | 1454 | W192 · Q3 | library |
| 2296 | [Design a Text Editor](https://leetcode.com/problems/design-a-text-editor/) | Hard | 1912 | W296 · Q4 | library |
| 432 | [All O'one Data Structure](https://leetcode.com/problems/all-oone-data-structure/) | Hard | — | — | roadmap #477 |
| 146 | [LRU Cache](https://leetcode.com/problems/lru-cache/) | Medium | — | — | roadmap #465 |
| 460 | [LFU Cache](https://leetcode.com/problems/lfu-cache/) | Hard | — | — | roadmap #470 |

### Stack

57 rows · 56 unique LeetCode problems · 18 already on your roadmap · 8 new

#### Parentheses Problem

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 20 | [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/) | Easy | — | — | roadmap #310 |
| 1614 | [Maximum Nesting Depth of the Parentheses](https://leetcode.com/problems/maximum-nesting-depth-of-the-parentheses/) | Easy | 1323 | W210 · Q1 | library |
| 1021 | [Remove Outermost Parentheses](https://leetcode.com/problems/remove-outermost-parentheses/) | Easy | 1311 | W131 · Q1 | library |
| 921 | [Minimum Add to Make Parentheses Valid](https://leetcode.com/problems/minimum-add-to-make-parentheses-valid/) | Medium | 1242 | W106 · Q2 | library |
| 1249 | [Minimum Remove to Make Valid Parentheses](https://leetcode.com/problems/minimum-remove-to-make-valid-parentheses/) | Medium | 1657 | W161 · Q3 | roadmap #306 + library |
| 1111 | [Maximum Nesting Depth of Two Valid Parentheses Strings](https://leetcode.com/problems/maximum-nesting-depth-of-two-valid-parentheses-strings/) | Medium | 1749 | W144 · Q4 | library |
| 2116 | [Check if a Parentheses String Can Be Valid](https://leetcode.com/problems/check-if-a-parentheses-string-can-be-valid/) | Medium | 2038 | B68 · Q3 | library |
| 1190 | [Reverse Substrings Between Each Pair of Parentheses](https://leetcode.com/problems/reverse-substrings-between-each-pair-of-parentheses/) | Medium | 1486 | W154 · Q2 | library |
| 856 | [Score of Parentheses](https://leetcode.com/problems/score-of-parentheses/) | Medium | 1563 | W90 · Q2 | library |
| 1541 | [Minimum Insertions to Balance a Parentheses String](https://leetcode.com/problems/minimum-insertions-to-balance-a-parentheses-string/) | Medium | 1759 | B32 · Q3 | library |
| 32 | [Longest Valid Parentheses](https://leetcode.com/problems/longest-valid-parentheses/) | Hard | — | — | roadmap #318 |
| — | Redundant Parenthesis | Hard | — | — | not on LeetCode · GeeksforGeeks / InterviewBit |

#### Design Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 155 | [Min Stack](https://leetcode.com/problems/min-stack/) | Medium | — | — | roadmap #467 |
| 895 | [Maximum Frequency Stack](https://leetcode.com/problems/maximum-frequency-stack/) | Hard | 2028 | W99 · Q4 | roadmap #429 + library |
| 1381 | [Design a Stack With Increment Operation](https://leetcode.com/problems/design-a-stack-with-increment-operation/) | Medium | 1286 | W180 · Q2 | library |
| 1172 | [Dinner Plate Stacks](https://leetcode.com/problems/dinner-plate-stacks/) | Hard | 2110 | W151 · Q4 | library |

#### Advance Stack Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 56 | [Merge Intervals](https://leetcode.com/problems/merge-intervals/) | Medium | — | — | roadmap #68 |
| 57 | [Insert Intervals](https://leetcode.com/problems/insert-interval/) | Medium | — | — | roadmap #69 |
| 735 | [Asteroid Collision](https://leetcode.com/problems/asteroid-collision/) | Medium | — | — | **NEW** |
| 2375 | [Construct Smallest Number From DI String](https://leetcode.com/problems/construct-smallest-number-from-di-string/) | Medium | 1642 | W306 · Q3 | library |
| 150 | [Evaluate Reverse Polish Notation](https://leetcode.com/problems/evaluate-reverse-polish-notation/) | Medium | — | — | **NEW** |
| 71 | [Simplify Path](https://leetcode.com/problems/simplify-path/) | Medium | — | — | roadmap #323 |
| 224 | [Basic Calculator](https://leetcode.com/problems/basic-calculator/) | Hard | — | — | roadmap #304 |
| 227 | [Basic Calculator II](https://leetcode.com/problems/basic-calculator-ii/) | Medium | — | — | roadmap #321 |
| 770 | [Basic Calculator IV](https://leetcode.com/problems/basic-calculator-iv/) | Hard | 2863 | W68 · Q5 | library |
| 2197 | [Replace Non-Coprime Numbers in Array](https://leetcode.com/problems/replace-non-coprime-numbers-in-array/) | Hard | 2057 | W283 · Q4 | library |
| 2751 | [Robot Collisons](https://leetcode.com/problems/robot-collisions/) | Hard | 2092 | W351 · Q4 | library |
| 726 | [Number of atoms](https://leetcode.com/problems/number-of-atoms/) | Hard | — | — | **NEW** |

#### Monotonic Stack

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1475 | [Final Prices With a Special Discount in a Shop](https://leetcode.com/problems/final-prices-with-a-special-discount-in-a-shop/) | Easy | 1212 | B28 · Q1 | library |
| 496 | [Next Greater Element I](https://leetcode.com/problems/next-greater-element-i/) | Easy | — | — | roadmap #396 |
| 503 | [Next Greater Element II](https://leetcode.com/problems/next-greater-element-ii/) | Medium | — | — | **NEW** |
| 2454 | [Next Greater Element IV](https://leetcode.com/problems/next-greater-element-iv/) | Hard | 2175 | B90 · Q4 | roadmap #319 + library |
| 739 | [Daily Temperatures](https://leetcode.com/problems/daily-temperatures/) | Medium | — | — | roadmap #312 |
| 853 | [Car Fleet](https://leetcode.com/problems/car-fleet/) | Medium | 1678 | W89 · Q2 | library |
| 1776 | [Car Fleet II](https://leetcode.com/problems/car-fleet-ii/) | Hard | 2531 | W230 · Q4 | library |
| 456 | [132 Pattern](https://leetcode.com/problems/132-pattern/) | Medium | — | — | **NEW** |
| 1081 | [Smallest Subsequence of Distinct Characters](https://leetcode.com/problems/smallest-subsequence-of-distinct-characters/) | Medium | 2185 | W140 · Q4 | library |
| 1504 | [Count Submatrices With All Ones](https://leetcode.com/problems/count-submatrices-with-all-ones/) | Medium | 1845 | W196 · Q3 | library |
| 316 | [Remove Duplicate Letters](https://leetcode.com/problems/remove-duplicate-letters/) | Medium | — | — | roadmap #317 |
| 1996 | [The Number of Weak Characters in the Game](https://leetcode.com/problems/the-number-of-weak-characters-in-the-game/) | Medium | 1861 | W257 · Q2 | library |
| 1856 | [Maximum Subarray Min-Product](https://leetcode.com/problems/maximum-subarray-min-product/) | Medium | 2051 | W240 · Q3 | library |
| 907 | [Sum of Subarray Minimums](https://leetcode.com/problems/sum-of-subarray-minimums/) | Medium | 1976 | W102 · Q3 | library |
| 581 | [Shortest Unsorted Continuous Subarray](https://leetcode.com/problems/shortest-unsorted-continuous-subarray/) | Medium | — | — | **NEW** |
| 402 | [Remove K Digits](https://leetcode.com/problems/remove-k-digits/) | Medium | — | — | roadmap #181 |
| 2865 | [Beautiful Towers I](https://leetcode.com/problems/beautiful-towers-i/) | Medium | 1519 | W364 · Q2 | library |
| 2866 | [Beautiful Towers II](https://leetcode.com/problems/beautiful-towers-ii/) | Medium | 2072 | W364 · Q3 | library |
| 901 | [Online Stock Span](https://leetcode.com/problems/online-stock-span/) | Medium | 1709 | W101 · Q2 | library |
| 1526 | [Minimum Number of Increments on Subarrays to Form a Target Array](https://leetcode.com/problems/minimum-number-of-increments-on-subarrays-to-form-a-target-array/) | Hard | 1872 | B31 · Q4 | library |
| 1793 | [Maximum Score of a Good Subarray](https://leetcode.com/problems/maximum-score-of-a-good-subarray/) | Hard | 1946 | W232 · Q4 | library |
| 1944 | [Number of Visible People in a Queue](https://leetcode.com/problems/number-of-visible-people-in-a-queue/) | Hard | 2105 | B57 · Q4 | roadmap #315 + library |
| 42 | [Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/) | Hard | — | — | **NEW** |
| 85 | [Maximal Rectangle](https://leetcode.com/problems/maximal-rectangle/) | Hard | — | — | roadmap #233 |
| 84 | [Largest Rectangle in Histogram](https://leetcode.com/problems/largest-rectangle-in-histogram/) | Hard | — | — | **NEW** |
| 321 | [Create Maximum Number](https://leetcode.com/problems/create-maximum-number/) | Hard | — | — | roadmap #15 |
| 2940 | [Find Building Where Alice And Bob Can Meet](https://leetcode.com/problems/find-building-where-alice-and-bob-can-meet/) | Hard | 2327 | W372 · Q4 | library |
| 2281 | [Sum Of Total Strength Of Wizards](https://leetcode.com/problems/sum-of-total-strength-of-wizards/) | Hard | 2621 | W294 · Q4 | library |
| 3113 | [Find the Number of Subarrays Where Boundary Elements Are Maximum](https://leetcode.com/problems/find-the-number-of-subarrays-where-boundary-elements-are-maximum/) | Hard | 2046 | B128 · Q4 | library |

### Queue

25 rows · 16 unique LeetCode problems · 3 already on your roadmap · 4 new

#### Implementation Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | C++ STL (queue) | Easy | — | — | not on LeetCode · Reference (C++ STL) |
| — | Implement Queue using Array | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 225 | [Implement Stack using Queues](https://leetcode.com/problems/implement-stack-using-queues/) | Easy | — | — | **NEW** |
| 232 | [Implement Queue using Stacks](https://leetcode.com/problems/implement-queue-using-stacks/) | Easy | — | — | roadmap #309 |
| — | Queue using Two Stacks | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | Implement Queue using Linked List | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 622 | [Design Circular Queue](https://leetcode.com/problems/design-circular-queue/) | Medium | — | — | **NEW** |
| 1670 | [Design Front Middle Back Queue](https://leetcode.com/problems/design-front-middle-back-queue/) | Medium | 1610 | B40 · Q3 | library |
| — | N-Queue using Array | Hard | — | — | not on LeetCode · GeeksforGeeks |

#### Singly-Ended Queue

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Reverse First K Elements of Queue | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | First Non-Repeating Character in a Stream | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | First Negative Integer in Every Window of Size K | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 649 | [Dota2 Senate](https://leetcode.com/problems/dota2-senate/) | Medium | — | — | **NEW** |
| 1823 | [Find the Winner of the Circular Game](https://leetcode.com/problems/find-the-winner-of-the-circular-game/) | Medium | 1412 | W236 · Q2 | library |
| 950 | [Reveal Cards in Increasing Order](https://leetcode.com/problems/reveal-cards-in-increasing-order/) | Medium | 1686 | W113 · Q3 | library |
| 995 | [Minimum Number of K Consecutive Bit Flips](https://leetcode.com/problems/minimum-number-of-k-consecutive-bit-flips/) | Hard | 1835 | W124 · Q3 | roadmap #491 + library |
| 936 | [Stamping the Sequence](https://leetcode.com/problems/stamping-the-sequence/) | Hard | 2583 | W109 · Q4 | library |

#### Doubly-Ended Queue

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Deque Implementations | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 641 | [Design Circular Deque](https://leetcode.com/problems/design-circular-deque/) | Medium | — | — | **NEW** |
| 1696 | [Jump Game VI](https://leetcode.com/problems/jump-game-vi/) | Medium | 1954 | W220 · Q3 | library |
| 2762 | [Continuous Subarrays](https://leetcode.com/problems/continuous-subarrays/) | Medium | 1940 | W352 · Q3 | library |
| 1499 | [Max Value of Equation](https://leetcode.com/problems/max-value-of-equation/) | Hard | 2456 | W195 · Q4 | library |
| 239 | [Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/) | Hard | — | — | roadmap #46 |
| 862 | [Shortest Subarray with Sum at Least K](https://leetcode.com/problems/shortest-subarray-with-sum-at-least-k/) | Hard | 2307 | W91 · Q4 | library |
| 1425 | [Constrained Subsequence Sum](https://leetcode.com/problems/constrained-subsequence-sum/) | Hard | 2032 | W186 · Q4 | library |

### Binary Search

83 rows · 80 unique LeetCode problems · 29 already on your roadmap · 11 new

#### Introductory Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 704 | [Binary Search](https://leetcode.com/problems/binary-search/) | Easy | — | — | roadmap #130 |
| 374 | [Guess Number Higher or Lower](https://leetcode.com/problems/guess-number-higher-or-lower/) | Easy | — | — | **NEW** |
| 275 | [H-Index II](https://leetcode.com/problems/h-index-ii/) | Medium | — | — | **NEW** |

#### Upper Bound and Lower Bound

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 34 | [Find First and Last Position of Element in Sorted Array](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/) | Medium | — | — | roadmap #149 |
| 1608 | [Special Array With X Elements Greater Than or Equal X](https://leetcode.com/problems/special-array-with-x-elements-greater-than-or-equal-x/) | Easy | 1370 | W209 · Q1 | library |
| 744 | [Find Smallest Letter Greater Than Target](https://leetcode.com/problems/find-smallest-letter-greater-than-target/) | Easy | — | — | **NEW** |
| 2389 | [Longest Subsequence With Limited Sum](https://leetcode.com/problems/longest-subsequence-with-limited-sum/) | Easy | 1388 | W308 · Q1 | roadmap #273 + library |
| 278 | [First Bad Version](https://leetcode.com/problems/first-bad-version/) | Easy | — | — | roadmap #132 |
| 441 | [Arranging Coins](https://leetcode.com/problems/arranging-coins/) | Easy | — | — | **NEW** |
| 1385 | [Find the Distance Value Between Two Arrays](https://leetcode.com/problems/find-the-distance-value-between-two-arrays/) | Easy | 1235 | B22 · Q1 | roadmap #269 + library |
| 35 | [Search Insert Position](https://leetcode.com/problems/search-insert-position/) | Easy | — | — | roadmap #147 |
| 2089 | [Find Target Indices After Sorting Array](https://leetcode.com/problems/find-target-indices-after-sorting-array/) | Easy | 1152 | W269 · Q1 | roadmap #270 + library |
| 436 | [Find Right Interval](https://leetcode.com/problems/find-right-interval/) | Medium | — | — | roadmap #103 |
| 911 | [Online Election](https://leetcode.com/problems/online-election/) | Medium | 2001 | W103 · Q4 | library |
| 2070 | [Most Beautiful Item for Each Query](https://leetcode.com/problems/most-beautiful-item-for-each-query/) | Medium | 1724 | B65 · Q3 | library |
| 981 | [Time Based Key-Value Store](https://leetcode.com/problems/time-based-key-value-store/) | Medium | 1575 | W121 · Q2 | roadmap #464 + library |
| 528 | [Random Pick with Weight](https://leetcode.com/problems/random-pick-with-weight/) | Medium | — | — | **NEW** |
| 2055 | [Plates Between Candles](https://leetcode.com/problems/plates-between-candles/) | Medium | 1819 | B64 · Q3 | library |
| 2300 | [Successful Pairs of Spells and Potions](https://leetcode.com/problems/successful-pairs-of-spells-and-potions/) | Medium | 1477 | B80 · Q2 | library |
| 2080 | [Range Frequency Queries](https://leetcode.com/problems/range-frequency-queries/) | Medium | 1702 | W268 · Q3 | library |
| 2602 | [Minimum Operations to Make All Array Elements Equal](https://leetcode.com/problems/minimum-operations-to-make-all-array-elements-equal/) | Medium | 1903 | W338 · Q3 | roadmap #272 + library |
| 2250 | [Count Number of Rectangles Containing Each Point](https://leetcode.com/problems/count-number-of-rectangles-containing-each-point/) | Medium | 1998 | W290 · Q3 | library |
| 2563 | [Count the Number of Fair Pairs](https://leetcode.com/problems/count-the-number-of-fair-pairs/) | Medium | 1721 | W332 · Q2 | library |
| 1818 | [Minimum Absolute Sum Difference](https://leetcode.com/problems/minimum-absolute-sum-difference/) | Medium | 1934 | W235 · Q3 | library |
| 1964 | [Find the Longest Valid Obstacle Course at Each Position](https://leetcode.com/problems/find-the-longest-valid-obstacle-course-at-each-position/) | Hard | 1933 | W253 · Q4 | library |
| 3113 | [Find the Number of Subarrays Where Boundary Elements Are Maximum](https://leetcode.com/problems/find-the-number-of-subarrays-where-boundary-elements-are-maximum/) | Hard | 2046 | B128 · Q4 | library |

#### Search on Matrix

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1351 | [Count Negative Numbers in a Sorted Matrix](https://leetcode.com/problems/count-negative-numbers-in-a-sorted-matrix/) | Easy | 1139 | W176 · Q1 | roadmap #294 + library |
| 74 | [Search a 2D Matrix](https://leetcode.com/problems/search-a-2d-matrix/) | Medium | — | — | **NEW** |
| 240 | [Search a 2D Matrix II](https://leetcode.com/problems/search-a-2d-matrix-ii/) | Medium | — | — | **NEW** |
| — | Median in a Row-wise Sorted Matrix | Hard | — | — | not on LeetCode · GeeksforGeeks |

#### Missing and Repeating Number

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 268 | [Missing Number](https://leetcode.com/problems/missing-number/) | Easy | — | — | roadmap #247 |
| 1539 | [Kth Missing Positive Number](https://leetcode.com/problems/kth-missing-positive-number/) | Easy | 1295 | B32 · Q1 | roadmap #153 + library |
| 540 | [Single Element in a Sorted Array](https://leetcode.com/problems/single-element-in-a-sorted-array/) | Medium | — | — | roadmap #134 |
| 2540 | [Minimum Common Value](https://leetcode.com/problems/minimum-common-value/) | Easy | 1250 | B96 · Q1 | library |
| 287 | [Find the Duplicate Number](https://leetcode.com/problems/find-the-duplicate-number/) | Medium | — | — | roadmap #39 |

#### Binary Search on Semi-Sorted Space

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 162 | [Find Peak Element](https://leetcode.com/problems/find-peak-element/) | Medium | — | — | roadmap #148 |
| 1901 | [Find a Peak Element II](https://leetcode.com/problems/find-a-peak-element-ii/) | Medium | — | — | **NEW** |
| 153 | [Find Minimum in Rotated Sorted Array](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) | Medium | — | — | **NEW** |
| 852 | [Peak Index in a Mountain Array](https://leetcode.com/problems/peak-index-in-a-mountain-array/) | Medium | 1182 | W89 · Q1 | library |
| 33 | [Search in Rotated Sorted Array](https://leetcode.com/problems/search-in-rotated-sorted-array/) | Medium | — | — | roadmap #131 |
| 81 | [Search in Rotated Sorted Array II](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/) | Medium | — | — | roadmap #138 |
| — | Rotation | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 154 | [Find Minimum in Rotated Sorted Array II](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/) | Hard | — | — | roadmap #140 |
| 1095 | [Find in Mountain Array](https://leetcode.com/problems/find-in-mountain-array/) | Hard | 1827 | W142 · Q3 | library |

#### Binary Search On Answer

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 69 | [Sqrt(x)](https://leetcode.com/problems/sqrtx/) | Easy | — | — | roadmap #151 |
| 1011 | [Capacity to Ship Packages Within D Days](https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/) | Medium | 1725 | W128 · Q3 | library |
| 875 | [Koko Eating Bananas](https://leetcode.com/problems/koko-eating-bananas/) | Medium | 1766 | W94 · Q3 | roadmap #146 + library |
| 1283 | [Find the Smallest Divisor Given a Threshold](https://leetcode.com/problems/find-the-smallest-divisor-given-a-threshold/) | Medium | 1542 | W166 · Q3 | library |
| 1482 | [Minimum Number of Days to Make M Bouquets](https://leetcode.com/problems/minimum-number-of-days-to-make-m-bouquets/) | Medium | 1946 | W193 · Q3 | library |
| — | Aggressive Cows | Medium | — | — | not on LeetCode · GeeksforGeeks / SPOJ |
| 2226 | [Maximum Candies Allocated to K Children](https://leetcode.com/problems/maximum-candies-allocated-to-k-children/) | Medium | 1646 | W287 · Q3 | library |
| 826 | [Most Profit Assigning Work](https://leetcode.com/problems/most-profit-assigning-work/) | Medium | 1709 | W82 · Q3 | library |
| 1802 | [Maximum Value at a Given Index in a Bounded Array](https://leetcode.com/problems/maximum-value-at-a-given-index-in-a-bounded-array/) | Medium | 1929 | W233 · Q3 | roadmap #137 + library |
| 1292 | [Maximum Side Length of a Square With Sum Less Than or Equal to Threshold](https://leetcode.com/problems/maximum-side-length-of-a-square-with-sum-less-than-or-equal-to-threshold/) | Medium | 1735 | W167 · Q3 | library |
| 1870 | [Minimum Speed to Arrive on Time](https://leetcode.com/problems/minimum-speed-to-arrive-on-time/) | Medium | 1676 | W242 · Q2 | library |
| 2594 | [Minimum Time to Repair Cars](https://leetcode.com/problems/minimum-time-to-repair-cars/) | Medium | 1915 | B100 · Q4 | library |
| 1898 | [Maximum Number of Removable Characters](https://leetcode.com/problems/maximum-number-of-removable-characters/) | Medium | 1913 | W245 · Q2 | library |
| 475 | [Heaters](https://leetcode.com/problems/heaters/) | Medium | — | — | **NEW** |
| 3048 | [Earliest Second to Mark Indices I](https://leetcode.com/problems/earliest-second-to-mark-indices-i/) | Medium | 2263 | W386 · Q3 | library |
| 2271 | [Maximum White Tiles Covered by a Carpet](https://leetcode.com/problems/maximum-white-tiles-covered-by-a-carpet/) | Medium | 2022 | B78 · Q3 | library |
| 2817 | [Minimum Absolute Difference Between Elements with Constraint](https://leetcode.com/problems/minimum-absolute-difference-between-elements-with-constraint/) | Medium | 1889 | W358 · Q3 | library |
| 1648 | [Sell Diminishing-Valued Colored Balls](https://leetcode.com/problems/sell-diminishing-valued-colored-balls/) | Medium | 2050 | W214 · Q3 | library |
| 1201 | [Ugly Number III](https://leetcode.com/problems/ugly-number-iii/) | Medium | 2039 | W155 · Q2 | library |
| 2513 | [Minimize the Maximum of Two Arrays](https://leetcode.com/problems/minimize-the-maximum-of-two-arrays/) | Medium | 2302 | B94 · Q3 | library |
| 410 | [Split Array Largest Sum](https://leetcode.com/problems/split-array-largest-sum/) | Hard *(sheet: Medium)* | — | — | roadmap #135 |
| 2141 | [Maximum Running Time of N Computers](https://leetcode.com/problems/maximum-running-time-of-n-computers/) | Hard *(sheet: Medium)* | 2265 | W276 · Q4 | roadmap #141 + library |
| 2398 | [Maximum Number of Robots Within Budget](https://leetcode.com/problems/maximum-number-of-robots-within-budget/) | Hard | 1917 | B86 · Q4 | library |
| 2790 | [Maximum Number of Groups With Increasing Length](https://leetcode.com/problems/maximum-number-of-groups-with-increasing-length/) | Hard | 2620 | W355 · Q3 | library |
| 2071 | [Maximum Number of Tasks You Can Assign](https://leetcode.com/problems/maximum-number-of-tasks-you-can-assign/) | Hard | 2648 | B65 · Q4 | library |
| 4 | [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/) | Hard | — | — | **NEW** |

#### Minmax Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1552 | [Magnetic Force Between Two Balls](https://leetcode.com/problems/magnetic-force-between-two-balls/) | Medium | 1920 | W202 · Q3 | roadmap #275 + library |
| 2517 | [Maximum Tastiness of Candy Basket](https://leetcode.com/problems/maximum-tastiness-of-candy-basket/) | Medium | 2021 | W325 · Q3 | library |
| 1760 | [Minimum Limit of Balls in a Bag](https://leetcode.com/problems/minimum-limit-of-balls-in-a-bag/) | Medium | 1940 | W228 · Q3 | library |
| 2064 | [Minimized Maximum of Products Distributed to Any Store](https://leetcode.com/problems/minimized-maximum-of-products-distributed-to-any-store/) | Medium | 1886 | W266 · Q3 | library |
| 2616 | [Minimize the Maximum Difference of Pairs](https://leetcode.com/problems/minimize-the-maximum-difference-of-pairs/) | Medium | 2155 | W340 · Q3 | library |
| 2528 | [Maximize the Minimum Powered City](https://leetcode.com/problems/maximize-the-minimum-powered-city/) | Hard | 2236 | B95 · Q4 | library |

#### Finding the K-th Element

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 668 | [Kth Smallest Number in Multiplication Table](https://leetcode.com/problems/kth-smallest-number-in-multiplication-table/) | Hard | — | — | roadmap #298 |
| 719 | [Find K-th Smallest Pair Distance](https://leetcode.com/problems/find-k-th-smallest-pair-distance/) | Hard | — | — | roadmap #267 |
| 378 | [Kth Smallest Element in a Sorted Matrix](https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/) | Medium *(sheet: Hard)* | — | — | roadmap #109 |
| 3134 | [Find the Median of the Uniqueness Array](https://leetcode.com/problems/find-the-median-of-the-uniqueness-array/) | Hard | 2451 | W395 · Q4 | library |
| 2040 | [Kth Smallest Product of Two Sorted Arrays](https://leetcode.com/problems/kth-smallest-product-of-two-sorted-arrays/) | Hard | 2518 | B63 · Q4 | roadmap #150 + library |
| 3116 | [Kth Smallest Amount With Single Denomination Combination](https://leetcode.com/problems/kth-smallest-amount-with-single-denomination-combination/) | Hard | 2388 | W393 · Q3 | library |
| 1439 | [Find the Kth Smallest Sum of a Matrix With Sorted Rows](https://leetcode.com/problems/find-the-kth-smallest-sum-of-a-matrix-with-sorted-rows/) | Hard | 2134 | W187 · Q4 | library |

### Bit Manipulation

47 rows · 39 unique LeetCode problems · 9 already on your roadmap · 11 new

#### Basic Bit Concepts

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Decimal to Binary | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | Get, Set, Clear ith Bit | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | Kth Bit is Set or Not | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | Check Odd or Even | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | Set the Rightmost Unset Bit | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 476 | [Number Complement](https://leetcode.com/problems/number-complement/) | Easy | — | — | **NEW** |
| 191 | [Number of 1 Bits](https://leetcode.com/problems/number-of-1-bits/) | Easy | — | — | **NEW** |
| 338 | [Counting Bits](https://leetcode.com/problems/counting-bits/) | Easy | — | — | roadmap #210 |
| — | Count Total Set Bits | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 190 | [Reverse Bits](https://leetcode.com/problems/reverse-bits/) | Easy | — | — | roadmap #485 |
| 231 | [Power of Two](https://leetcode.com/problems/power-of-two/) | Easy | — | — | roadmap #494 |
| 342 | [Power of Four](https://leetcode.com/problems/power-of-four/) | Easy | — | — | **NEW** |
| 461 | [Hamming Distance](https://leetcode.com/problems/hamming-distance/) | Easy | — | — | roadmap #495 |
| 67 | [Add Binary](https://leetcode.com/problems/add-binary/) | Easy | — | — | **NEW** |
| 477 | [Total Hamming Distance](https://leetcode.com/problems/total-hamming-distance/) | Medium | — | — | **NEW** |
| 393 | [UTF-8 Validation](https://leetcode.com/problems/utf-8-validation/) | Medium *(sheet: Easy)* | — | — | **NEW** |
| 137 | [Single Number II](https://leetcode.com/problems/single-number-ii/) | Medium | — | — | roadmap #483 |
| 29 | [Divide Two Integers](https://leetcode.com/problems/divide-two-integers/) | Medium | — | — | **NEW** |

#### Bitwise XOR operator

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1720 | [Decode Xored Array](https://leetcode.com/problems/decode-xored-array/) | Easy | 1284 | W223 · Q1 | library |
| 136 | [Single Number](https://leetcode.com/problems/single-number/) | Easy | — | — | roadmap #482 |
| 260 | [Single Number III](https://leetcode.com/problems/single-number-iii/) | Medium | — | — | **NEW** |
| 371 | [Sum of Two Integers](https://leetcode.com/problems/sum-of-two-integers/) | Medium | — | — | **NEW** |
| — | Swap Two Numbers (with Temp Variable) | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 268 | [Missing Number](https://leetcode.com/problems/missing-number/) | Easy | — | — | roadmap #247 |
| 1734 | [Decode Xored Permutation](https://leetcode.com/problems/decode-xored-permutation/) | Medium *(sheet: Easy)* | 2024 | B44 · Q3 | library |
| 2433 | [Find the Original Array of Prefix XOR](https://leetcode.com/problems/find-the-original-array-of-prefix-xor/) | Medium | 1367 | W314 · Q2 | library |
| 89 | [Gray Code](https://leetcode.com/problems/gray-code/) | Medium | — | — | **NEW** |
| 1310 | [XOR Queries of a Subarray](https://leetcode.com/problems/xor-queries-of-a-subarray/) | Medium | 1460 | W170 · Q2 | library |
| — | XOR Sequences | Medium | — | — | not on LeetCode · Codeforces |
| 2997 | [Minimum Number of Operations to Make Array XOR Equal to K](https://leetcode.com/problems/minimum-number-of-operations-to-make-array-xor-equal-to-k/) | Medium | 1525 | B121 · Q2 | library |
| 2939 | [Maximum XOR Product](https://leetcode.com/problems/maximum-xor-product/) | Medium | 2128 | W372 · Q3 | library |
| 2683 | [Neighboring Bitwise XOR](https://leetcode.com/problems/neighboring-bitwise-xor/) | Medium | 1518 | W345 · Q2 | library |
| 1879 | [Minimum XOR Sum of Two Arrays](https://leetcode.com/problems/minimum-xor-sum-of-two-arrays/) | Hard | 2145 | B53 · Q4 | library |
| 1835 | [Find XOR Sum of All Pairs Bitwise AND](https://leetcode.com/problems/find-xor-sum-of-all-pairs-bitwise-and/) | Hard | 1825 | W237 · Q4 | library |
| 1542 | [Find Longest Awesome Substring](https://leetcode.com/problems/find-longest-awesome-substring/) | Hard | 2222 | B32 · Q4 | library |

#### Bitwise OR operator

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 3097 | [Shortest Subarray with OR at Least K](https://leetcode.com/problems/shortest-subarray-with-or-at-least-k-ii/) | Medium | 1891 | B127 · Q3 | library |
| 3133 | [Minimum Array End](https://leetcode.com/problems/minimum-array-end/) | Medium | 1935 | W395 · Q3 | library |
| 2680 | [Maximum OR](https://leetcode.com/problems/maximum-or/) | Medium | 1912 | B104 · Q3 | library |
| 3171 | [Find Subarray with Bitwise OR Closest to K](https://leetcode.com/problems/find-subarray-with-bitwise-or-closest-to-k/) | Hard | 2163 | W400 · Q4 | library |
| 3022 | [Minimize OR of Remaining Elements Using Operations](https://leetcode.com/problems/minimize-or-of-remaining-elements-using-operations/) | Hard | 2918 | W382 · Q4 | library |

#### Bitwise AND operator

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1318 | [Minimum Flips to Make A or B Equal to C](https://leetcode.com/problems/minimum-flips-to-make-a-or-b-equal-to-c/) | Medium | 1383 | W171 · Q2 | library |
| 2401 | [Longest Nice Subarray](https://leetcode.com/problems/longest-nice-subarray/) | Medium | 1750 | W309 · Q3 | library |
| 201 | [Bitwise AND of Numbers Range](https://leetcode.com/problems/bitwise-and-of-numbers-range/) | Medium | — | — | **NEW** |
| 2419 | [Longest Subarray with Maximum Bitwise AND](https://leetcode.com/problems/longest-subarray-with-maximum-bitwise-and/) | Medium | 1496 | W312 · Q2 | roadmap #487 + library |
| 3209 | [Number of Subarrays with AND Value of K](https://leetcode.com/problems/number-of-subarrays-with-and-value-of-k/) | Hard | 2050 | B134 · Q4 | library |
| 982 | [Triples with Bitwise AND Equal to Zero](https://leetcode.com/problems/triples-with-bitwise-and-equal-to-zero/) | Hard | 2085 | W121 · Q4 | roadmap #493 + library |
| 2835 | [Minimum Operations to Form Subsequence with Target Sum](https://leetcode.com/problems/minimum-operations-to-form-subsequence-with-target-sum/) | Hard | 2207 | W360 · Q3 | library |

### Recursion & Backtracking

40 rows · 35 unique LeetCode problems · 17 already on your roadmap · 9 new

#### Recursion Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 231 | [Power of Two](https://leetcode.com/problems/power-of-two/) | Easy | — | — | roadmap #494 |
| 326 | [Power of Three](https://leetcode.com/problems/power-of-three/) | Easy | — | — | roadmap #533 |
| 342 | [Power of Four](https://leetcode.com/problems/power-of-four/) | Easy | — | — | **NEW** |
| 509 | [Fibonacci Number](https://leetcode.com/problems/fibonacci-number/) | Easy | — | — | roadmap #519 |
| 50 | [Pow(x, n)](https://leetcode.com/problems/powx-n/) | Medium | — | — | roadmap #539 |
| 1922 | [Count Good Numbers](https://leetcode.com/problems/count-good-numbers/) | Medium *(sheet: Easy)* | 1675 | W248 · Q3 | library |
| 1969 | [Minimum Non-Zero Product of the Array Elements](https://leetcode.com/problems/minimum-non-zero-product-of-the-array-elements/) | Medium | 1967 | W254 · Q3 | library |
| — | Delete Middle Element of a Stack | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | Sort a Stack | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Josephus Problem | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 1823 | [Find the Winner of the Circular Game](https://leetcode.com/problems/find-the-winner-of-the-circular-game/) | Medium | 1412 | W236 · Q2 | library |
| 486 | [Predict the Winner](https://leetcode.com/problems/predict-the-winner/) | Medium | — | — | **NEW** |
| — | Tower of Hanoi | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 241 | [Different Ways to Add Parentheses](https://leetcode.com/problems/different-ways-to-add-parentheses/) | Medium | — | — | **NEW** |
| 224 | [Basic Calculator](https://leetcode.com/problems/basic-calculator/) | Hard | — | — | roadmap #304 |
| 60 | [Permutation Sequence](https://leetcode.com/problems/permutation-sequence/) | Hard | — | — | **NEW** |
| 10 | [Regular Expression Matching](https://leetcode.com/problems/regular-expression-matching/) | Hard | — | — | roadmap #228 |
| 44 | [Wildcard Matching](https://leetcode.com/problems/wildcard-matching/) | Hard | — | — | roadmap #180 |
| 273 | [Integer to English Words](https://leetcode.com/problems/integer-to-english-words/) | Hard | — | — | roadmap #520 |
| 761 | [Special Binary String](https://leetcode.com/problems/special-binary-string/) | Hard | 2292 | W66 · Q4 | library |

#### Permutation Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 46 | [Permutations](https://leetcode.com/problems/permutations/) | Medium | — | — | roadmap #155 |
| 2375 | [Construct Smallest Number from DI String](https://leetcode.com/problems/construct-smallest-number-from-di-string/) | Medium | 1642 | W306 · Q3 | library |
| 526 | [Beautiful Arrangement](https://leetcode.com/problems/beautiful-arrangement/) | Medium | — | — | **NEW** |

#### Combination Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 494 | [Target Sum](https://leetcode.com/problems/target-sum/) | Medium | — | — | **NEW** |
| 77 | [Combinations](https://leetcode.com/problems/combinations/) | Medium | — | — | roadmap #202 |
| 17 | [Letter Combinations of a Phone Number](https://leetcode.com/problems/letter-combinations-of-a-phone-number/) | Medium | — | — | roadmap #156 |
| 784 | [Letter Case Permutation](https://leetcode.com/problems/letter-case-permutation/) | Medium | 1342 | W72 · Q1 | roadmap #159 + library |
| 1415 | [K-th Lexicographical String of All Happy Strings of Length n](https://leetcode.com/problems/the-k-th-lexicographical-string-of-all-happy-strings-of-length-n/) | Medium | 1576 | B24 · Q3 | library |
| 39 | [Combination Sum](https://leetcode.com/problems/combination-sum/) | Medium | — | — | roadmap #214 |
| 40 | [Combination Sum II](https://leetcode.com/problems/combination-sum-ii/) | Medium | — | — | **NEW** |
| 216 | [Combination Sum III](https://leetcode.com/problems/combination-sum-iii/) | Medium | — | — | **NEW** |
| 1947 | [Maximum Compatibility Score Sum](https://leetcode.com/problems/maximum-compatibility-score-sum/) | Medium | 1704 | W251 · Q3 | library |
| 967 | [Numbers with Same Consecutive Differences](https://leetcode.com/problems/numbers-with-same-consecutive-differences/) | Medium | 1433 | W117 · Q2 | library |
| 51 | [N-Queens](https://leetcode.com/problems/n-queens/) | Hard | — | — | roadmap #201 |

#### Subsets Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 78 | [Subsets](https://leetcode.com/problems/subsets/) | Medium | — | — | roadmap #154 |
| 90 | [Subsets II](https://leetcode.com/problems/subsets-ii/) | Medium | — | — | roadmap #161 |
| 491 | [Non-Decreasing Subsequences](https://leetcode.com/problems/non-decreasing-subsequences/) | Medium | — | — | **NEW** |
| 2597 | [Number of Beautiful Subsets](https://leetcode.com/problems/the-number-of-beautiful-subsets/) | Medium | 2023 | W337 · Q3 | library |

#### Path on Grid Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Rat in a Maze Problem | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 37 | [Sudoku Solver](https://leetcode.com/problems/sudoku-solver/) | Hard | — | — | roadmap #192 |

### Binary Tree

50 rows · 36 unique LeetCode problems · 14 already on your roadmap · 16 new

#### Traversals

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 144 | [Binary Tree Preorder Traversal](https://leetcode.com/problems/binary-tree-preorder-traversal/) | Easy | — | — | roadmap #360 |
| 94 | [Binary Tree Inorder Traversal](https://leetcode.com/problems/binary-tree-inorder-traversal/) | Easy | — | — | **NEW** |
| 145 | [Binary Tree Postorder Traversal](https://leetcode.com/problems/binary-tree-postorder-traversal/) | Easy | — | — | **NEW** |
| — | Preorder, Postorder, Inorder in a Single Traversal | Easy | — | — | not on LeetCode · GeeksforGeeks |

#### Properties of trees

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Remove Half Nodes | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 110 | [Balanced Binary Tree](https://leetcode.com/problems/balanced-binary-tree/) | Easy | — | — | **NEW** |
| 104 | [Maximum Depth of Binary Tree](https://leetcode.com/problems/maximum-depth-of-binary-tree/) | Easy | — | — | roadmap #355 |
| 543 | [Diameter of Binary Tree](https://leetcode.com/problems/diameter-of-binary-tree/) | Easy | — | — | roadmap #343 |
| 222 | [Count Complete Tree Nodes](https://leetcode.com/problems/count-complete-tree-nodes/) | Medium *(sheet: Easy)* | — | — | **NEW** |
| 111 | [Minimum Depth of Binary Tree](https://leetcode.com/problems/minimum-depth-of-binary-tree/) | Easy | — | — | **NEW** |
| 958 | [Check Completeness of a Binary Tree](https://leetcode.com/problems/check-completeness-of-a-binary-tree/) | Medium | 1703 | W115 · Q2 | library |

#### Construction of Tree

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Construct Binary Tree from Parent Array | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Linked List to Binary Tree | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 105 | [Construct Binary Tree from Preorder and Inorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/) | Medium | — | — | roadmap #348 |
| 106 | [Construct Binary Tree from Inorder and Postorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-inorder-and-postorder-traversal/) | Medium | — | — | **NEW** |
| 889 | [Construct Binary Tree from Preorder and Postorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-preorder-and-postorder-traversal/) | Medium | 1732 | W98 · Q3 | library |
| — | Construct Binary Tree from String with Bracket Representation | Medium | — | — | not on LeetCode · GeeksforGeeks |

#### Two tree Validation

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 100 | [Same Tree](https://leetcode.com/problems/same-tree/) | Easy | — | — | **NEW** |
| — | Two Mirror Trees | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 617 | [Merge Two Binary Trees](https://leetcode.com/problems/merge-two-binary-trees/) | Easy | — | — | **NEW** |
| 572 | [Subtree of Another Tree](https://leetcode.com/problems/subtree-of-another-tree/) | Easy | — | — | **NEW** |
| — | Check if Tree is Isomorphic | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 872 | [Leaf-Similar Trees](https://leetcode.com/problems/leaf-similar-trees/) | Easy | 1288 | W94 · Q1 | library |
| — | Check if Subtree | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Mirror Tree | Medium | — | — | not on LeetCode · GeeksforGeeks |

#### Level Order Traversal

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 102 | [Binary Tree Level Order Traversal](https://leetcode.com/problems/binary-tree-level-order-traversal/) | Medium | — | — | roadmap #364 |
| 107 | [Binary Tree Level Order Traversal II](https://leetcode.com/problems/binary-tree-level-order-traversal-ii/) | Medium | — | — | **NEW** |
| 993 | [Cousins in Binary Tree](https://leetcode.com/problems/cousins-in-binary-tree/) | Easy | 1288 | W124 · Q1 | library |
| 637 | [Average of Levels in Binary Tree](https://leetcode.com/problems/average-of-levels-in-binary-tree/) | Easy | — | — | roadmap #375 |
| 2471 | [Minimum Number of Operations to Sort a Binary Tree by Level](https://leetcode.com/problems/minimum-number-of-operations-to-sort-a-binary-tree-by-level/) | Medium | 1635 | W319 · Q3 | library |
| 199 | [Binary Tree Right Side View](https://leetcode.com/problems/binary-tree-right-side-view/) | Medium *(sheet: Easy)* | — | — | roadmap #349 |
| — | Left View of Binary Tree | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | Top View of Binary Tree | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 987 | [Vertical Order Traversal of a Binary Tree](https://leetcode.com/problems/vertical-order-traversal-of-a-binary-tree/) | Hard | 1676 | W122 · Q4 | roadmap #367 + library |
| 297 | [Serialize and Deserialize Binary Tree](https://leetcode.com/problems/serialize-and-deserialize-binary-tree/) | Hard | — | — | roadmap #344 |
| 863 | [All Nodes Distance K in Binary Tree](https://leetcode.com/problems/all-nodes-distance-k-in-binary-tree/) | Medium | 1663 | W91 · Q2 | library |
| — | Burning Tree | Hard | — | — | not on LeetCode · GeeksforGeeks |
| 116 | [Populating Next Right Pointers in Each Node](https://leetcode.com/problems/populating-next-right-pointers-in-each-node/) | Medium | — | — | roadmap #366 |

#### Binary Tree Path

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 257 | [Binary Tree Paths](https://leetcode.com/problems/binary-tree-paths/) | Easy | — | — | roadmap #197 |
| 112 | [Path Sum](https://leetcode.com/problems/path-sum/) | Easy | — | — | roadmap #362 |
| — | Children Sum in a Binary Tree | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 113 | [Path Sum II](https://leetcode.com/problems/path-sum-ii/) | Medium | — | — | **NEW** |
| 129 | [Sum Root to Leaf Numbers](https://leetcode.com/problems/sum-root-to-leaf-numbers/) | Medium | — | — | **NEW** |
| 124 | [Binary Tree Maximum Path Sum](https://leetcode.com/problems/binary-tree-maximum-path-sum/) | Hard | — | — | roadmap #346 |
| 437 | [Path Sum III](https://leetcode.com/problems/path-sum-iii/) | Medium | — | — | **NEW** |
| 236 | [Lowest Common Ancestor of a Binary Tree](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/) | Medium | — | — | roadmap #350 |

#### N-ary Tree

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | N-ary Tree | Theory | — | — | not on LeetCode · Theory |
| 590 | [N-ary Tree Postorder Traversal](https://leetcode.com/problems/n-ary-tree-postorder-traversal/) | Easy | — | — | **NEW** |
| 589 | [N-ary Tree Preorder Traversal](https://leetcode.com/problems/n-ary-tree-preorder-traversal/) | Easy | — | — | **NEW** |
| 559 | [Maximum Depth of N-ary Tree](https://leetcode.com/problems/maximum-depth-of-n-ary-tree/) | Easy | — | — | **NEW** |

### Binary Search Tree

28 rows · 26 unique LeetCode problems · 4 already on your roadmap · 12 new

#### Basic Operations

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 700 | [Search in a Binary Search Tree](https://leetcode.com/problems/search-in-a-binary-search-tree/) | Easy | — | — | **NEW** |
| 701 | [Insert into a Binary Search Tree](https://leetcode.com/problems/insert-into-a-binary-search-tree/) | Medium | — | — | **NEW** |
| 450 | [Delete Node in a BST](https://leetcode.com/problems/delete-node-in-a-bst/) | Medium | — | — | **NEW** |

#### Construction of BST

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 108 | [Convert Sorted Array to Binary Search Tree](https://leetcode.com/problems/convert-sorted-array-to-binary-search-tree/) | Easy | — | — | roadmap #347 |
| 109 | [Convert Sorted List to Binary Search Tree](https://leetcode.com/problems/convert-sorted-list-to-binary-search-tree/) | Medium | — | — | **NEW** |
| 538 | [Convert BST to Greater Tree](https://leetcode.com/problems/convert-bst-to-greater-tree/) | Medium | — | — | **NEW** |
| 669 | [Trim a Binary Search Tree](https://leetcode.com/problems/trim-a-binary-search-tree/) | Medium | — | — | **NEW** |
| 449 | [Serialize and Deserialize BST](https://leetcode.com/problems/serialize-and-deserialize-bst/) | Medium | — | — | **NEW** |
| 1008 | [Construct Binary Search Tree from Preorder Traversal](https://leetcode.com/problems/construct-binary-search-tree-from-preorder-traversal/) | Medium | 1563 | W127 · Q4 | library |
| — | Construct BST from Postorder | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 1382 | [Balance a Binary Search Tree](https://leetcode.com/problems/balance-a-binary-search-tree/) | Medium | 1541 | W180 · Q3 | library |
| 1038 | [Binary Search Tree to Greater Sum Tree](https://leetcode.com/problems/binary-search-tree-to-greater-sum-tree/) | Medium | 1375 | W135 · Q2 | library |

#### Validation and Property

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 501 | [Find Mode in Binary Search Tree](https://leetcode.com/problems/find-mode-in-binary-search-tree/) | Easy | — | — | **NEW** |
| 938 | [Range Sum of BST](https://leetcode.com/problems/range-sum-of-bst/) | Easy | 1335 | W110 · Q2 | library |
| 98 | [Validate Binary Search Tree](https://leetcode.com/problems/validate-binary-search-tree/) | Medium | — | — | roadmap #351 |
| 783 | [Minimum Distance Between BST Nodes](https://leetcode.com/problems/minimum-distance-between-bst-nodes/) | Easy | 1303 | W71 · Q1 | library |
| 230 | [Kth Smallest Element in a BST](https://leetcode.com/problems/kth-smallest-element-in-a-bst/) | Medium | — | — | roadmap #356 |
| 897 | [Increasing Order Search Tree](https://leetcode.com/problems/increasing-order-search-tree/) | Easy | 1473 | W100 · Q2 | library |
| 653 | [Two Sum IV - Input is a BST](https://leetcode.com/problems/two-sum-iv-input-is-a-bst/) | Easy | — | — | roadmap #371 |
| 1373 | [Maximum Sum BST in Binary Tree](https://leetcode.com/problems/maximum-sum-bst-in-binary-tree/) | Hard | 1914 | B21 · Q4 | library |
| — | Find Common Nodes in two BSTs | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 1305 | [All Elements in Two Binary Search Trees](https://leetcode.com/problems/all-elements-in-two-binary-search-trees/) | Medium | 1260 | W169 · Q2 | library |
| 96 | [Unique Binary Search Trees](https://leetcode.com/problems/unique-binary-search-trees/) | Medium | — | — | **NEW** |
| 99 | [Recover Binary Search Tree](https://leetcode.com/problems/recover-binary-search-tree/) | Medium | — | — | **NEW** |
| 1569 | [Number of Ways to Reorder Array to Get Same BST](https://leetcode.com/problems/number-of-ways-to-reorder-array-to-get-same-bst/) | Hard | 2288 | W204 · Q4 | library |
| 173 | [Binary Search Tree Iterator](https://leetcode.com/problems/binary-search-tree-iterator/) | Medium | — | — | **NEW** |
| 235 | [Lowest Common Ancestor of a Binary Search Tree](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/) | Medium | — | — | **NEW** |
| 2476 | [Closest Nodes Queries in a Binary Search Tree](https://leetcode.com/problems/closest-nodes-queries-in-a-binary-search-tree/) | Medium | 1597 | W320 · Q2 | library |

### Heap (Priority Queue)

75 rows · 68 unique LeetCode problems · 30 already on your roadmap · 4 new

#### Introductory Questions

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Implementation of Priority Queue using Binary Heap | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | Heap Sort | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Does Array Represent Heap? | Easy | — | — | not on LeetCode · GeeksforGeeks |
| — | Is Binary Tree Heap? | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Operations on Binary Min Heap | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Convert Min Heap to Max Heap | Medium | — | — | not on LeetCode · GeeksforGeeks |

#### Implementary Questions

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 506 | [Relative Ranks](https://leetcode.com/problems/relative-ranks/) | Easy | — | — | **NEW** |
| 2558 | [Take Gifts From the Richest Pile](https://leetcode.com/problems/take-gifts-from-the-richest-pile/) | Easy | 1277 | W331 · Q1 | library |
| 1046 | [Last Stone Weight](https://leetcode.com/problems/last-stone-weight/) | Easy | 1173 | W137 · Q1 | library |
| 2231 | [Largest Number After Digit Swaps by Parity](https://leetcode.com/problems/largest-number-after-digit-swaps-by-parity/) | Easy | 1365 | W288 · Q1 | roadmap #102 + library |
| 2335 | [Minimum Amount of Time to Fill Cups](https://leetcode.com/problems/minimum-amount-of-time-to-fill-cups/) | Easy | 1360 | W301 · Q1 | library |
| 1845 | [Seat Reservation Manager](https://leetcode.com/problems/seat-reservation-manager/) | Medium | 1429 | B51 · Q2 | library |
| 451 | [Sort Characters By Frequency](https://leetcode.com/problems/sort-characters-by-frequency/) | Medium | — | — | **NEW** |
| 1338 | [Reduce Array Size to The Half](https://leetcode.com/problems/reduce-array-size-to-the-half/) | Medium | 1303 | W174 · Q2 | library |
| 1405 | [Longest Happy String](https://leetcode.com/problems/longest-happy-string/) | Medium | 1821 | W183 · Q3 | roadmap #99 + library |
| 767 | [Reorganize String](https://leetcode.com/problems/reorganize-string/) | Medium | 1681 | W68 · Q2 | roadmap #113 + library |
| 1792 | [Maximum Average Pass Ratio](https://leetcode.com/problems/maximum-average-pass-ratio/) | Medium | 1818 | W232 · Q3 | roadmap #100 + library |
| 2593 | [Find Score of an Array After Marking All Elements](https://leetcode.com/problems/find-score-of-an-array-after-marking-all-elements/) | Medium | 1665 | B100 · Q3 | library |
| 1642 | [Furthest Building You Can Reach](https://leetcode.com/problems/furthest-building-you-can-reach/) | Medium | 1962 | W213 · Q3 | library |
| 1054 | [Distant Barcodes](https://leetcode.com/problems/distant-barcodes/) | Medium | 1702 | W138 · Q4 | library |
| 621 | [Task Scheduler](https://leetcode.com/problems/task-scheduler/) | Medium | — | — | roadmap #72 |
| 2530 | [Maximal Score After Applying K Operations](https://leetcode.com/problems/maximal-score-after-applying-k-operations/) | Medium | 1386 | W327 · Q2 | roadmap #117 + library |
| 1834 | [Single Threaded CPU](https://leetcode.com/problems/single-threaded-cpu/) | Medium | 1798 | W237 · Q3 | library |
| 2456 | [Most Popular Video Creator](https://leetcode.com/problems/most-popular-video-creator/) | Medium | 1548 | W317 · Q2 | library |
| 2462 | [Total Cost to Hire K Workers](https://leetcode.com/problems/total-cost-to-hire-k-workers/) | Medium | 1764 | W318 · Q3 | library |
| 3092 | [Most Frequent IDs](https://leetcode.com/problems/most-frequent-ids/) | Medium | 1793 | W390 · Q3 | library |
| 1882 | [Process Tasks Using Servers](https://leetcode.com/problems/process-tasks-using-servers/) | Medium | 1979 | W243 · Q3 | library |
| 1705 | [Maximum Number of Eaten Apples](https://leetcode.com/problems/maximum-number-of-eaten-apples/) | Medium | 1930 | W221 · Q2 | library |
| 1353 | [Maximum Number of Events That Can Be Attended](https://leetcode.com/problems/maximum-number-of-events-that-can-be-attended/) | Medium | 2016 | W176 · Q3 | library |
| 3066 | [Minimum Operations to Exceed Threshold Value II](https://leetcode.com/problems/minimum-operations-to-exceed-threshold-value-ii/) | Medium | 1400 | B125 · Q2 | library |
| 2551 | [Put Marbles in Bags](https://leetcode.com/problems/put-marbles-in-bags/) | Hard | 2042 | W330 · Q3 | roadmap #280 + library |
| 2931 | [Maximum Spending After Buying Items](https://leetcode.com/problems/maximum-spending-after-buying-items/) | Hard | 1822 | B117 · Q4 | library |
| 407 | [Trapping Rain Water II](https://leetcode.com/problems/trapping-rain-water-ii/) | Hard | — | — | **NEW** |
| 2542 | [Maximum Subsequence Score](https://leetcode.com/problems/maximum-subsequence-score/) | Medium | 2056 | B96 · Q3 | library |
| 1383 | [Maximum Performance of a Team](https://leetcode.com/problems/maximum-performance-of-a-team/) | Hard | 2091 | W180 · Q4 | roadmap #123 + library |
| 1499 | [Max Value of Equation](https://leetcode.com/problems/max-value-of-equation/) | Hard | 2456 | W195 · Q4 | library |
| 218 | [The Skyline Problem](https://leetcode.com/problems/the-skyline-problem/) | Hard | — | — | roadmap #459 |
| 2813 | [Maximum Elegance of a K-Length Subsequence](https://leetcode.com/problems/maximum-elegance-of-a-k-length-subsequence/) | Hard | 2582 | W357 · Q4 | library |

#### Kth Pattern Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1337 | [The K Weakest Rows in a Matrix](https://leetcode.com/problems/the-k-weakest-rows-in-a-matrix/) | Easy | 1225 | W174 · Q1 | roadmap #136 + library |
| 215 | [Kth Largest Element in an Array](https://leetcode.com/problems/kth-largest-element-in-an-array/) | Medium | — | — | roadmap #116 |
| 703 | [Kth Largest Element in a Stream](https://leetcode.com/problems/kth-largest-element-in-a-stream/) | Easy | — | — | roadmap #112 |
| 2099 | [Find Subsequence of Length K With the Largest Sum](https://leetcode.com/problems/find-subsequence-of-length-k-with-the-largest-sum/) | Easy | 1447 | B67 · Q1 | roadmap #120 + library |
| 786 | [K-th Smallest Prime Fraction](https://leetcode.com/problems/k-th-smallest-prime-fraction/) | Medium | 2169 | W72 · Q4 | roadmap #110 + library |
| 973 | [K Closest Points to Origin](https://leetcode.com/problems/k-closest-points-to-origin/) | Medium | 1214 | W119 · Q1 | roadmap #114 + library |
| 347 | [Top K Frequent Elements](https://leetcode.com/problems/top-k-frequent-elements/) | Medium | — | — | roadmap #115 |
| 378 | [Kth Smallest Element in a Sorted Matrix](https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/) | Medium | — | — | roadmap #109 |
| 1738 | [Find Kth Largest XOR Coordinate Value](https://leetcode.com/problems/find-kth-largest-xor-coordinate-value/) | Medium | 1671 | W225 · Q3 | library |
| 692 | [Top K Frequent Words](https://leetcode.com/problems/top-k-frequent-words/) | Medium | — | — | roadmap #383 |
| 658 | [Find K Closest Elements](https://leetcode.com/problems/find-k-closest-elements/) | Medium | — | — | roadmap #133 |
| 264 | [Ugly Number II](https://leetcode.com/problems/ugly-number-ii/) | Medium | — | — | **NEW** |
| 1985 | [Find the Kth Largest Integer in the Array](https://leetcode.com/problems/find-the-kth-largest-integer-in-the-array/) | Medium | 1414 | W256 · Q2 | roadmap #118 + library |
| 2512 | [Reward Top K Students](https://leetcode.com/problems/reward-top-k-students/) | Medium | 1637 | B94 · Q2 | library |
| 2343 | [Query Kth Smallest Trimmed Number](https://leetcode.com/problems/query-kth-smallest-trimmed-number/) | Medium | 1652 | W302 · Q3 | library |
| 2146 | [K Highest Ranked Items Within a Price Range](https://leetcode.com/problems/k-highest-ranked-items-within-a-price-range/) | Medium | 1837 | B70 · Q3 | library |
| 1439 | [Find the Kth Smallest Sum of a Matrix With Sorted Rows](https://leetcode.com/problems/find-the-kth-smallest-sum-of-a-matrix-with-sorted-rows/) | Hard | 2134 | W187 · Q4 | library |
| 2386 | [Find the K-Sum of an Array](https://leetcode.com/problems/find-the-k-sum-of-an-array/) | Hard | 2648 | W307 · Q4 | roadmap #126 + library |

#### Minimize Operations

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1962 | [Remove Stones to Minimize the Total](https://leetcode.com/problems/remove-stones-to-minimize-the-total/) | Medium | 1419 | W253 · Q2 | library |
| 2208 | [Minimum Operations to Halve Array Sum](https://leetcode.com/problems/minimum-operations-to-halve-array-sum/) | Medium | 1550 | B74 · Q3 | library |
| 1942 | [The Number of the Smallest Unoccupied Chair](https://leetcode.com/problems/the-number-of-the-smallest-unoccupied-chair/) | Medium | 1695 | B57 · Q2 | roadmap #101 + library |
| 3170 | [Lexicographically Minimum String After Removing Stars](https://leetcode.com/problems/lexicographically-minimum-string-after-removing-stars/) | Medium | 1772 | W400 · Q3 | library |
| 3081 | [Replace Question Marks in String to Minimize Its Value](https://leetcode.com/problems/replace-question-marks-in-string-to-minimize-its-value/) | Medium | 1905 | B126 · Q3 | library |
| 2333 | [Minimum Sum of Squared Difference](https://leetcode.com/problems/minimum-sum-of-squared-difference/) | Medium | 2011 | B82 · Q3 | library |
| 857 | [Minimum Cost to Hire K Workers](https://leetcode.com/problems/minimum-cost-to-hire-k-workers/) | Hard | 2260 | W90 · Q4 | roadmap #121 + library |
| 1675 | [Minimize Deviation in Array](https://leetcode.com/problems/minimize-deviation-in-array/) | Hard | 2533 | W217 · Q4 | library |
| 1263 | [Minimum Moves to Move a Box to Their Target Location](https://leetcode.com/problems/minimum-moves-to-move-a-box-to-their-target-location/) | Hard | 2297 | W163 · Q4 | library |
| 1851 | [Minimum Interval to Include Each Query](https://leetcode.com/problems/minimum-interval-to-include-each-query/) | Hard | 2286 | W239 · Q4 | roadmap #78 + library |

#### Merge K Sorted Patterns

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 23 | [Merge K Sorted Lists](https://leetcode.com/problems/merge-k-sorted-lists/) | Hard | — | — | roadmap #108 |
| 373 | [Find K Pairs with Smallest Sums](https://leetcode.com/problems/find-k-pairs-with-smallest-sums/) | Medium *(sheet: Hard)* | — | — | roadmap #107 |
| — | Merge K Sorted Arrays | Medium | — | — | not on LeetCode · GeeksforGeeks |

#### Two Heap Pattern

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1801 | [Number of Orders in the Backlog](https://leetcode.com/problems/number-of-orders-in-the-backlog/) | Medium | 1711 | W233 · Q2 | library |
| 480 | [Sliding Window Median](https://leetcode.com/problems/sliding-window-median/) | Hard | — | — | roadmap #95 |
| 502 | [IPO](https://leetcode.com/problems/ipo/) | Hard | — | — | roadmap #93 |
| 295 | [Find Median from Data Stream](https://leetcode.com/problems/find-median-from-data-stream/) | Hard | — | — | roadmap #94 |
| 2402 | [Meeting Rooms III](https://leetcode.com/problems/meeting-rooms-iii/) | Hard | 2093 | W309 · Q4 | roadmap #97 + library |
| 2532 | [Time to Cross a Bridge](https://leetcode.com/problems/time-to-cross-a-bridge/) | Hard | 2589 | W327 · Q4 | library |

### Tries

32 rows · 30 unique LeetCode problems · 12 already on your roadmap · 4 new

#### Introductory Questions

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 208 | [Implement Trie (Prefix Tree)](https://leetcode.com/problems/implement-trie-prefix-tree/) | Medium | — | — | roadmap #378 |
| — | Trie Delete | Hard | — | — | not on LeetCode · GeeksforGeeks |
| 211 | [Design Add and Search Words Data Structure](https://leetcode.com/problems/design-add-and-search-words-data-structure/) | Medium | — | — | roadmap #381 |
| 677 | [Map Sum Pairs](https://leetcode.com/problems/map-sum-pairs/) | Medium | — | — | roadmap #390 |

#### Trie with Bit Manipulation

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 421 | [Maximum XOR of Two Numbers in an Array](https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/) | Medium *(sheet: Hard)* | — | — | **NEW** |
| — | Minimum XOR Value Pair | Hard | — | — | not on LeetCode · GeeksforGeeks |
| 1707 | [Maximum XOR With an Element From Array](https://leetcode.com/problems/maximum-xor-with-an-element-from-array/) | Hard | 2359 | W221 · Q4 | library |
| 1803 | [Count Pairs With XOR in a Range](https://leetcode.com/problems/count-pairs-with-xor-in-a-range/) | Hard | 2479 | W233 · Q4 | library |
| 2935 | [Maximum Strong Pair XOR II](https://leetcode.com/problems/maximum-strong-pair-xor-ii/) | Hard | 2349 | W371 · Q4 | library |

#### Trie involving String

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 14 | [Longest Common Prefix](https://leetcode.com/problems/longest-common-prefix/) | Easy *(sheet: Medium)* | — | — | roadmap #385 |
| 3043 | [Find the Length of the Longest Common Prefix](https://leetcode.com/problems/find-the-length-of-the-longest-common-prefix/) | Medium | 1689 | W385 · Q2 | roadmap #424 + library |
| 1268 | [Search Suggestions System](https://leetcode.com/problems/search-suggestions-system/) | Medium | 1573 | W164 · Q3 | roadmap #379 + library |
| 2416 | [Sum of Prefix Scores of Strings](https://leetcode.com/problems/sum-of-prefix-scores-of-strings/) | Hard | 1725 | W311 · Q4 | library |
| 745 | [Prefix and Suffix Search](https://leetcode.com/problems/prefix-and-suffix-search/) | Hard | — | — | **NEW** |
| 3093 | [Longest Common Suffix Queries](https://leetcode.com/problems/longest-common-suffix-queries/) | Hard | 2118 | W390 · Q4 | roadmap #389 + library |
| 3045 | [Count Prefix and Suffix Pairs II](https://leetcode.com/problems/count-prefix-and-suffix-pairs-ii/) | Hard | 2328 | W385 · Q4 | library |
| 1032 | [Stream of Characters](https://leetcode.com/problems/stream-of-characters/) | Hard | 1970 | W133 · Q4 | roadmap #476 + library |
| 2707 | [Extra Characters in a String](https://leetcode.com/problems/extra-characters-in-a-string/) | Medium | 1736 | B105 · Q2 | library |
| 676 | [Implement Magic Dictionary](https://leetcode.com/problems/implement-magic-dictionary/) | Medium | — | — | **NEW** |
| 792 | [Number of Matching Subsequences](https://leetcode.com/problems/number-of-matching-subsequences/) | Medium | 1695 | W74 · Q2 | library |
| 1023 | [Camelcase Matching](https://leetcode.com/problems/camelcase-matching/) | Medium | 1537 | W131 · Q3 | library |
| 820 | [Short Encoding of Words](https://leetcode.com/problems/short-encoding-of-words/) | Medium | 1632 | W81 · Q3 | library |
| 2227 | [Encrypt and Decrypt Strings](https://leetcode.com/problems/encrypt-and-decrypt-strings/) | Hard | 1945 | W287 · Q4 | library |
| 720 | [Longest Word in Dictionary](https://leetcode.com/problems/longest-word-in-dictionary/) | Medium | — | — | **NEW** |
| 3213 | [Construct String With Minimum Cost](https://leetcode.com/problems/construct-string-with-minimum-cost/) | Hard | 2171 | W405 · Q4 | library |

#### Trie involving Recursion

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 3076 | [Shortest Uncommon Substring in an Array](https://leetcode.com/problems/shortest-uncommon-substring-in-an-array/) | Medium | 1635 | W388 · Q3 | library |
| 139 | [Word Break](https://leetcode.com/problems/word-break/) | Medium | — | — | roadmap #215 |
| 140 | [Word Break II](https://leetcode.com/problems/word-break-ii/) | Hard | — | — | roadmap #218 |
| 212 | [Word Search II](https://leetcode.com/problems/word-search-ii/) | Hard | — | — | roadmap #382 |
| 336 | [Palindrome Pairs](https://leetcode.com/problems/palindrome-pairs/) | Hard | — | — | roadmap #388 |

#### Trie involving File System

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1233 | [Remove Sub-Folders from the Filesystem](https://leetcode.com/problems/remove-sub-folders-from-the-filesystem/) | Medium *(sheet: Hard)* | 1545 | W159 · Q2 | library |
| 1948 | [Delete Duplicate Folders in System](https://leetcode.com/problems/delete-duplicate-folders-in-system/) | Hard *(sheet: Medium)* | 2534 | W251 · Q4 | library |

### Greedy

58 rows · 54 unique LeetCode problems · 11 already on your roadmap · 5 new

#### Part I

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1323 | [Maximum 69 Number](https://leetcode.com/problems/maximum-69-number/) | Easy | 1194 | W172 · Q1 | library |
| 2656 | [Maximum Sum with Exactly K Elements](https://leetcode.com/problems/maximum-sum-with-exactly-k-elements/) | Easy | 1213 | B103 · Q1 | library |
| 1974 | [Minimum Time to Type Word Using Special Typewriter](https://leetcode.com/problems/minimum-time-to-type-word-using-special-typewriter/) | Easy | 1364 | B59 · Q1 | library |
| 1827 | [Minimum Operations to Make the Array Increasing](https://leetcode.com/problems/minimum-operations-to-make-the-array-increasing/) | Easy | 1315 | B50 · Q1 | library |
| 2224 | [Minimum Number of Operations to Convert Time](https://leetcode.com/problems/minimum-number-of-operations-to-convert-time/) | Easy | 1296 | W287 · Q1 | library |
| 455 | [Assign Cookies](https://leetcode.com/problems/assign-cookies/) | Easy | — | — | roadmap #174 |
| 1217 | [Play with Chips](https://leetcode.com/problems/minimum-cost-to-move-chips-to-the-same-position/) | Easy | 1408 | W157 · Q1 | library |
| 55 | [Jump Game](https://leetcode.com/problems/jump-game/) | Medium | — | — | roadmap #162 |
| 45 | [Jump Game II](https://leetcode.com/problems/jump-game-ii/) | Medium | — | — | roadmap #168 |
| 376 | [Wiggle Subsequence](https://leetcode.com/problems/wiggle-subsequence/) | Medium | — | — | **NEW** |
| 1386 | [Cinema Seat Allocation](https://leetcode.com/problems/cinema-seat-allocation/) | Medium | 1637 | B22 · Q2 | library |
| 870 | [Advantage Shuffle](https://leetcode.com/problems/advantage-shuffle/) | Medium | 1648 | W93 · Q3 | library |
| 2567 | [Minimum Score by Changing Two Elements](https://leetcode.com/problems/minimum-score-by-changing-two-elements/) | Medium | 1609 | B98 · Q2 | library |
| 2541 | [Minimum Operations to Make Array Equal II](https://leetcode.com/problems/minimum-operations-to-make-array-equal-ii/) | Medium | 1620 | B96 · Q2 | library |
| 2611 | [Mice and Cheese](https://leetcode.com/problems/mice-and-cheese/) | Medium | 1663 | W339 · Q3 | library |
| 2808 | [Minimum Seconds to Equalize a Circular Array](https://leetcode.com/problems/minimum-seconds-to-equalize-a-circular-array/) | Medium | 1875 | B110 · Q3 | library |
| 2279 | [Maximum Bags with Full Capacity of Rocks](https://leetcode.com/problems/maximum-bags-with-full-capacity-of-rocks/) | Medium | 1249 | W294 · Q2 | library |
| 2439 | [Minimize Maximum of Array](https://leetcode.com/problems/minimize-maximum-of-array/) | Medium | 1965 | B89 · Q3 | library |
| — | Minimum Platforms | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Fractional Knapsack | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Activity Selection | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Job Sequencing Problem | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 435 | [Non-Overlapping Intervals](https://leetcode.com/problems/non-overlapping-intervals/) | Medium | — | — | **NEW** |
| 2406 | [Divide Intervals into Minimum Number of Groups](https://leetcode.com/problems/divide-intervals-into-minimum-number-of-groups/) | Medium | 1713 | W310 · Q3 | library |
| 621 | [Task Scheduler](https://leetcode.com/problems/task-scheduler/) | Medium | — | — | roadmap #72 |
| 2449 | [Minimum Number of Operations to Make Arrays Similar](https://leetcode.com/problems/minimum-number-of-operations-to-make-arrays-similar/) | Hard | 2076 | W316 · Q4 | library |
| 3219 | [Minimum Cost for Cutting Cake II](https://leetcode.com/problems/minimum-cost-for-cutting-cake-ii/) | Hard | 1789 | W406 · Q4 | library |
| 330 | [Patching Array](https://leetcode.com/problems/patching-array/) | Hard | — | — | **NEW** |
| 1330 | [Reverse Subarray to Maximize Array Value](https://leetcode.com/problems/reverse-subarray-to-maximize-array-value/) | Hard | 2482 | B18 · Q4 | library |
| 517 | [Super Washing Machines](https://leetcode.com/problems/super-washing-machines/) | Hard | — | — | **NEW** |
| 3139 | [Minimum Cost to Equalize Array](https://leetcode.com/problems/minimum-cost-to-equalize-array/) | Hard | 2666 | W396 · Q4 | library |
| 2405 | [Optimal Partition of String](https://leetcode.com/problems/optimal-partition-of-string/) | Medium | 1355 | W310 · Q2 | library |
| 1247 | [Minimum Swaps to Make Strings Equal](https://leetcode.com/problems/minimum-swaps-to-make-strings-equal/) | Medium | 1597 | W161 · Q1 | library |
| 1520 | [Maximum Number of Non-Overlapping Substrings](https://leetcode.com/problems/maximum-number-of-non-overlapping-substrings/) | Hard | 2363 | W198 · Q3 | library |
| 2663 | [Lexicographically Smallest Beautiful String](https://leetcode.com/problems/lexicographically-smallest-beautiful-string/) | Hard | 2416 | W343 · Q4 | library |
| 2842 | [Count K-Subsequences of a String with Maximum Beauty](https://leetcode.com/problems/count-k-subsequences-of-a-string-with-maximum-beauty/) | Hard | 2092 | B112 · Q4 | library |
| 948 | [Bag of Tokens](https://leetcode.com/problems/bag-of-tokens/) | Medium | 1762 | W112 · Q4 | library |
| 881 | [Boats to Save People](https://leetcode.com/problems/boats-to-save-people/) | Medium | 1530 | W96 · Q2 | roadmap #163 + library |
| 2410 | [Maximum Matching of Players with Trainers](https://leetcode.com/problems/maximum-matching-of-players-with-trainers/) | Medium | 1381 | B87 · Q2 | library |
| 135 | [Candy](https://leetcode.com/problems/candy/) | Hard | — | — | roadmap #175 |

#### Part II

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 860 | [Lemonade Change](https://leetcode.com/problems/lemonade-change/) | Easy | 1286 | W91 · Q1 | library |
| 134 | [Gas Station](https://leetcode.com/problems/gas-station/) | Medium | — | — | roadmap #164 |
| 1282 | [Group the People Given the Group Size They Belong To](https://leetcode.com/problems/group-the-people-given-the-group-size-they-belong-to/) | Medium | 1267 | W166 · Q2 | library |
| 1296 | [Divide Array in Sets of K Consecutive Numbers](https://leetcode.com/problems/divide-array-in-sets-of-k-consecutive-numbers/) | Medium | 1490 | W168 · Q2 | library |
| 1053 | [Previous Permutation with One Swap](https://leetcode.com/problems/previous-permutation-with-one-swap/) | Medium | 1633 | W138 · Q3 | library |
| 763 | [Partition Labels](https://leetcode.com/problems/partition-labels/) | Medium | 1443 | W67 · Q2 | roadmap #20 + library |
| 1400 | [Construct K Palindrome Strings](https://leetcode.com/problems/construct-k-palindrome-strings/) | Medium | 1530 | B23 · Q2 | library |
| 767 | [Reorganize String](https://leetcode.com/problems/reorganize-string/) | Medium | 1681 | W68 · Q2 | roadmap #113 + library |
| 984 | [String Without AAA or BBB](https://leetcode.com/problems/string-without-aaa-or-bbb/) | Medium | 1474 | W121 · Q1 | library |
| 1433 | [Check If a String Can Break Another String](https://leetcode.com/problems/check-if-a-string-can-break-another-string/) | Medium | 1436 | B25 · Q3 | library |
| 316 | [Remove Duplicate Letters](https://leetcode.com/problems/remove-duplicate-letters/) | Medium | — | — | roadmap #317 |
| 1754 | [Largest Merge of Two Strings](https://leetcode.com/problems/largest-merge-of-two-strings/) | Medium | 1829 | W227 · Q3 | library |
| 2800 | [Shortest String That Contains Three Strings](https://leetcode.com/problems/shortest-string-that-contains-three-strings/) | Medium | 1856 | W356 · Q3 | library |
| 2734 | [Lexicographically Smallest String After Substring Operation](https://leetcode.com/problems/lexicographically-smallest-string-after-substring-operation/) | Medium | 1405 | W349 · Q2 | library |
| 2244 | [Minimum Rounds to Complete All Tasks](https://leetcode.com/problems/minimum-rounds-to-complete-all-tasks/) | Medium | 1372 | W289 · Q2 | library |
| 1276 | [Number of Burgers with No Waste of Ingredients](https://leetcode.com/problems/number-of-burgers-with-no-waste-of-ingredients/) | Medium | 1386 | W165 · Q2 | library |
| 406 | [Queue Reconstruction by Height](https://leetcode.com/problems/queue-reconstruction-by-height/) | Medium | — | — | **NEW** |
| 1094 | [Car Pooling](https://leetcode.com/problems/car-pooling/) | Medium | 1441 | W142 · Q2 | roadmap #76 + library |

### Dynamic Programming Level 1

166 rows · 156 unique LeetCode problems · 35 already on your roadmap · 40 new

#### Linear DP

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 70 | [Climbing Stairs](https://leetcode.com/problems/climbing-stairs/) | Easy | — | — | roadmap #221 |
| 746 | [Min Cost Climbing Stairs](https://leetcode.com/problems/min-cost-climbing-stairs/) | Easy | 1358 | W63 · Q1 | roadmap #235 + library |
| 279 | [Perfect Squares](https://leetcode.com/problems/perfect-squares/) | Medium | — | — | roadmap #517 |
| 91 | [Decode Ways](https://leetcode.com/problems/decode-ways/) | Medium | — | — | roadmap #219 |
| 96 | [Unique Binary Search Trees](https://leetcode.com/problems/unique-binary-search-trees/) | Medium | — | — | **NEW** |
| 198 | [House Robber](https://leetcode.com/problems/house-robber/) | Medium | — | — | **NEW** |
| 322 | [Coin Change](https://leetcode.com/problems/coin-change/) | Medium | — | — | roadmap #207 |
| 121 | [Best Time to Buy and Sell Stock](https://leetcode.com/problems/best-time-to-buy-and-sell-stock/) | Easy | — | — | roadmap #52 |
| 983 | [Minimum Cost For Tickets](https://leetcode.com/problems/minimum-cost-for-tickets/) | Medium | 1786 | W121 · Q3 | library |
| 740 | [Delete and Earn](https://leetcode.com/problems/delete-and-earn/) | Medium | — | — | **NEW** |
| 3186 | [Maximum Total Damage With Spell Casting](https://leetcode.com/problems/maximum-total-damage-with-spell-casting/) | Medium | 1841 | W402 · Q3 | library |
| 413 | [Arithmetic Slices](https://leetcode.com/problems/arithmetic-slices/) | Medium | — | — | **NEW** |
| 1218 | [Longest Arithmetic Subsequence of Given Difference](https://leetcode.com/problems/longest-arithmetic-subsequence-of-given-difference/) | Medium | 1597 | W157 · Q2 | library |
| 1043 | [Partition Array for Maximum Sum](https://leetcode.com/problems/partition-array-for-maximum-sum/) | Medium | 1916 | W136 · Q3 | library |
| 3041 | [Maximize Consecutive Elements in an Array After Modification](https://leetcode.com/problems/maximize-consecutive-elements-in-an-array-after-modification/) | Hard | 2231 | B124 · Q4 | library |

#### 2 Dimensional DP

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 518 | [Coin Change II](https://leetcode.com/problems/coin-change-ii/) | Medium | — | — | **NEW** |
| 935 | [Knight Dialer](https://leetcode.com/problems/knight-dialer/) | Medium | 1690 | W109 · Q2 | library |
| 416 | [Partition Equal Subset Sum](https://leetcode.com/problems/partition-equal-subset-sum/) | Medium | — | — | roadmap #209 |
| 120 | [Triangle](https://leetcode.com/problems/triangle/) | Medium | — | — | roadmap #225 |
| 552 | [Student Attendance Record Leetcode](https://leetcode.com/problems/student-attendance-record-ii/) | Hard | — | — | **NEW** |
| 3177 | [Find the Maximum Length of a Good Subsequence II](https://leetcode.com/problems/find-the-maximum-length-of-a-good-subsequence-ii/) | Hard | 2365 | B132 · Q4 | library |
| 629 | [K Inverse Pairs Array](https://leetcode.com/problems/k-inverse-pairs-array/) | Hard | — | — | **NEW** |
| 377 | [Combination Sum IV](https://leetcode.com/problems/combination-sum-iv/) | Medium | — | — | **NEW** |
| 813 | [Largest Sum of Averages](https://leetcode.com/problems/largest-sum-of-averages/) | Medium | 1937 | W79 · Q3 | library |
| 1027 | [Longest Arithmetic Subsequence](https://leetcode.com/problems/longest-arithmetic-subsequence/) | Medium | 1759 | W132 · Q3 | library |
| 1155 | [Number of Dice Rolls With Target Sum](https://leetcode.com/problems/number-of-dice-rolls-with-target-sum/) | Medium | 1654 | W149 · Q2 | library |
| 1223 | [Dice Roll Simulation](https://leetcode.com/problems/dice-roll-simulation/) | Hard *(sheet: Medium)* | 2008 | W158 · Q3 | library |
| 2930 | [Number of Strings Which Can Be Rearranged to Contain Substring](https://leetcode.com/problems/number-of-strings-which-can-be-rearranged-to-contain-substring/) | Medium *(sheet: Hard)* | 2227 | B117 · Q3 | library |
| 403 | [Frog Jump](https://leetcode.com/problems/frog-jump/) | Hard | — | — | roadmap #226 |
| 122 | [Best Time to Buy and Sell Stock II](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-ii/) | Medium *(sheet: Hard)* | — | — | roadmap #179 |
| 123 | [Best Time to Buy and Sell Stock III](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iii/) | Hard | — | — | roadmap #240 |
| 188 | [Best Time to Buy and Sell Stock IV](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iv/) | Hard | — | — | **NEW** |
| 514 | [Freedom Trail](https://leetcode.com/problems/freedom-trail/) | Hard | — | — | roadmap #243 |
| 920 | [Number of Music Playlists](https://leetcode.com/problems/number-of-music-playlists/) | Hard | 2400 | W105 · Q4 | library |
| 1220 | [Count Vowels Permutation](https://leetcode.com/problems/count-vowels-permutation/) | Hard | 1730 | W157 · Q4 | library |
| 714 | [Best Time to Buy and Sell Stock with Transaction Fee](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-transaction-fee/) | Medium | — | — | **NEW** |
| 1320 | [Minimum Distance to Type a Word Using Two Fingers](https://leetcode.com/problems/minimum-distance-to-type-a-word-using-two-fingers/) | Hard | 2028 | W171 · Q4 | library |
| 1335 | [Minimum Difficulty of a Job Schedule](https://leetcode.com/problems/minimum-difficulty-of-a-job-schedule/) | Hard | 2035 | W173 · Q4 | library |
| 309 | [Best Time to Buy and Sell Stock with Cooldown](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/) | Medium | — | — | **NEW** |
| 1411 | [Number of Ways to Paint N x 3 Grid](https://leetcode.com/problems/number-of-ways-to-paint-n-3-grid/) | Hard | 1845 | W184 · Q4 | library |
| 1420 | [Build Array Where You Can Find The Maximum Exactly K Comparisons](https://leetcode.com/problems/build-array-where-you-can-find-the-maximum-exactly-k-comparisons/) | Hard | 2176 | W185 · Q4 | library |
| 1444 | [Number of Ways of Cutting a Pizza](https://leetcode.com/problems/number-of-ways-of-cutting-a-pizza/) | Hard | 2127 | W188 · Q4 | library |
| 1473 | [Paint House III](https://leetcode.com/problems/paint-house-iii/) | Hard | 2056 | W192 · Q4 | library |
| 1575 | [Count All Possible Routes](https://leetcode.com/problems/count-all-possible-routes/) | Hard | 2055 | B34 · Q4 | library |

#### DP On Grid

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Geek's Training | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 62 | [Unique Paths](https://leetcode.com/problems/unique-paths/) | Medium | — | — | **NEW** |
| 63 | [Unique Paths II](https://leetcode.com/problems/unique-paths-ii/) | Medium | — | — | **NEW** |
| 64 | [Minimum Path Sum](https://leetcode.com/problems/minimum-path-sum/) | Medium | — | — | roadmap #239 |
| 1594 | [Maximum Non Negative Product in a Matrix](https://leetcode.com/problems/maximum-non-negative-product-in-a-matrix/) | Medium | 1807 | W207 · Q3 | library |
| 3148 | [Maximum Difference Score in a Grid](https://leetcode.com/problems/maximum-difference-score-in-a-grid/) | Medium | 1820 | W397 · Q3 | library |
| 3122 | [Minimum Number of Operations to Satisfy Conditions](https://leetcode.com/problems/minimum-number-of-operations-to-satisfy-conditions/) | Medium | 1905 | W394 · Q3 | library |
| 2684 | [Maximum Number of Moves in a Grid](https://leetcode.com/problems/maximum-number-of-moves-in-a-grid/) | Medium | 1626 | W345 · Q3 | library |
| 1706 | [Where Will the Ball Fall](https://leetcode.com/problems/where-will-the-ball-fall/) | Medium | 1765 | W221 · Q3 | roadmap #287 + library |
| 174 | [Dungeon Game](https://leetcode.com/problems/dungeon-game/) | Hard | — | — | roadmap #229 |
| 741 | [Cherry Pickup](https://leetcode.com/problems/cherry-pickup/) | Hard | — | — | roadmap #227 |
| 1301 | [Number of Paths with Max Score](https://leetcode.com/problems/number-of-paths-with-max-score/) | Hard | 1853 | B16 · Q4 | library |
| 1463 | [Cherry Pickup II](https://leetcode.com/problems/cherry-pickup-ii/) | Hard | 1957 | B27 · Q4 | library |
| 1289 | [Minimum Falling Path Sum II](https://leetcode.com/problems/minimum-falling-path-sum-ii/) | Hard | 1697 | B15 · Q4 | library |
| 576 | [Out of Boundary Paths](https://leetcode.com/problems/out-of-boundary-paths/) | Medium | — | — | **NEW** |
| 931 | [Minimum Falling Path Sum](https://leetcode.com/problems/minimum-falling-path-sum/) | Medium | 1573 | W108 · Q3 | library |

#### Knapsack DP

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Knapsack - 1 | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Knapsack - 2 | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 474 | [Ones and Zeroes](https://leetcode.com/problems/ones-and-zeroes/) | Medium | — | — | **NEW** |
| 494 | [Target Sum](https://leetcode.com/problems/target-sum/) | Medium | — | — | **NEW** |
| 650 | [2 Keys Keyboard](https://leetcode.com/problems/2-keys-keyboard/) | Medium | — | — | **NEW** |
| 1626 | [Best Team With No Conflicts](https://leetcode.com/problems/best-team-with-no-conflicts/) | Medium | 2027 | W211 · Q3 | library |
| 638 | [Shopping Offers](https://leetcode.com/problems/shopping-offers/) | Medium | — | — | **NEW** |
| 2944 | [Minimum Number of Coins for Fruits](https://leetcode.com/problems/minimum-number-of-coins-for-fruits/) | Medium | 1709 | B118 · Q3 | library |
| 1049 | [Last Stone Weight II](https://leetcode.com/problems/last-stone-weight-ii/) | Medium | 2092 | W137 · Q4 | library |
| — | Rod Cutting | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 1105 | [Filling Bookcase Shelves](https://leetcode.com/problems/filling-bookcase-shelves/) | Medium | 2014 | W143 · Q3 | library |
| 1024 | [Video Stitching](https://leetcode.com/problems/video-stitching/) | Medium | 1746 | W131 · Q4 | library |
| 3196 | [Maximize Total Cost of Alternating Subarrays](https://leetcode.com/problems/maximize-total-cost-of-alternating-subarrays/) | Medium *(sheet: Hard)* | 1847 | W403 · Q3 | library |
| 1388 | [Pizza With 3n Slices](https://leetcode.com/problems/pizza-with-3n-slices/) | Hard | 2410 | B22 · Q4 | library |
| 801 | [Minimum Swaps To Make Sequences Increasing](https://leetcode.com/problems/minimum-swaps-to-make-sequences-increasing/) | Hard | 2066 | W76 · Q2 | library |
| 879 | [Profitable Schemes](https://leetcode.com/problems/profitable-schemes/) | Hard | 2204 | W95 · Q4 | library |
| 1402 | [Reducing Dishes](https://leetcode.com/problems/reducing-dishes/) | Hard | 1679 | B23 · Q4 | library |
| 3154 | [Find Number of Ways to Reach the K-th Stair](https://leetcode.com/problems/find-number-of-ways-to-reach-the-k-th-stair/) | Hard | 2071 | W398 · Q4 | library |
| 3098 | [Find the Sum of Subsequence Powers](https://leetcode.com/problems/find-the-sum-of-subsequence-powers/) | Hard | 2553 | B127 · Q4 | library |
| 2902 | [Count of Sub-Multisets With Bounded Sum](https://leetcode.com/problems/count-of-sub-multisets-with-bounded-sum/) | Hard | 2759 | B115 · Q4 | library |

#### Longest Increasing Subsequence

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 300 | [Longest Increasing Subsequence](https://leetcode.com/problems/longest-increasing-subsequence/) | Medium | — | — | **NEW** |
| — | Printing Longest Increasing Subsequence | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 673 | [Number of Longest Increasing Subsequence](https://leetcode.com/problems/number-of-longest-increasing-subsequence/) | Medium | — | — | roadmap #236 |
| 368 | [Largest Divisible Subset](https://leetcode.com/problems/largest-divisible-subset/) | Medium | — | — | **NEW** |
| 2901 | [Longest Unequal Adjacent Groups Subsequence II](https://leetcode.com/problems/longest-unequal-adjacent-groups-subsequence-ii/) | Medium | 1899 | B115 · Q3 | library |
| — | Max Sum Increasing Subsequence | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 3202 | [Find the Maximum Length of Valid Subsequence II](https://leetcode.com/problems/find-the-maximum-length-of-valid-subsequence-ii/) | Medium | 1974 | W404 · Q3 | library |
| 376 | [Wiggle Subsequence](https://leetcode.com/problems/wiggle-subsequence/) | Medium | — | — | **NEW** |
| 3250 | [Find the Count of Monotonic Pairs I](https://leetcode.com/problems/find-the-count-of-monotonic-pairs-i/) | Hard | 1898 | W410 · Q3 | library |
| 354 | [Russian Doll Envelopes](https://leetcode.com/problems/russian-doll-envelopes/) | Hard | — | — | roadmap #271 |
| 960 | [Delete Columns to Make Sorted III](https://leetcode.com/problems/delete-columns-to-make-sorted-iii/) | Hard | 2247 | W115 · Q4 | library |
| 1671 | [Minimum Number of Removals to Make Mountain Array](https://leetcode.com/problems/minimum-number-of-removals-to-make-mountain-array/) | Hard | 1913 | B40 · Q4 | library |
| 1691 | [Maximum Height by Stacking Cuboids](https://leetcode.com/problems/maximum-height-by-stacking-cuboids/) | Hard | 2172 | W219 · Q4 | library |
| 646 | [Maximum Length of Pair Chain](https://leetcode.com/problems/maximum-length-of-pair-chain/) | Medium *(sheet: Hard)* | — | — | **NEW** |
| 1187 | [Make Array Strictly Increasing](https://leetcode.com/problems/make-array-strictly-increasing/) | Hard | 2316 | W153 · Q4 | library |

#### Longest Common Subsequence

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1143 | [Longest Common Subsequence](https://leetcode.com/problems/longest-common-subsequence/) | Medium | — | — | roadmap #217 |
| — | Print all LCS sequences | Hard | — | — | not on LeetCode · GeeksforGeeks |
| — | Count Common Subsequence in Two Strings | Theory | — | — | not on LeetCode · GeeksforGeeks (theory) |
| 583 | [Delete operation for two strings](https://leetcode.com/problems/delete-operation-for-two-strings/) | Medium | — | — | **NEW** |
| 5 | [Longest Palindromic Substring](https://leetcode.com/problems/longest-palindromic-substring/) | Medium | — | — | **NEW** |
| 516 | [Longest Palindromic Subsequence](https://leetcode.com/problems/longest-palindromic-subsequence/) | Medium | — | — | **NEW** |
| 718 | [Maximum Length of Repeated Subarray](https://leetcode.com/problems/maximum-length-of-repeated-subarray/) | Medium | — | — | **NEW** |
| 72 | [Edit Distance](https://leetcode.com/problems/edit-distance/) | Medium | — | — | roadmap #246 |
| 97 | [Interleaving String](https://leetcode.com/problems/interleaving-string/) | Medium | — | — | roadmap #232 |
| 10 | [Regular Expression Matching](https://leetcode.com/problems/regular-expression-matching/) | Hard | — | — | roadmap #228 |
| 44 | [Wildcard Matching](https://leetcode.com/problems/wildcard-matching/) | Hard | — | — | roadmap #180 |
| 1092 | [Shortest Common Supersequence](https://leetcode.com/problems/shortest-common-supersequence/) | Hard | 1977 | W141 · Q4 | roadmap #231 + library |
| 1312 | [Minimum Insertion Steps to Make a String Palindrome](https://leetcode.com/problems/minimum-insertion-steps-to-make-a-string-palindrome/) | Hard | 1787 | W170 · Q4 | library |
| 1458 | [Max Dot Product of Two Subsequences](https://leetcode.com/problems/max-dot-product-of-two-subsequences/) | Hard | 1824 | W190 · Q4 | library |

#### DP on String

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 3144 | [Minimum Substring Partition of Equal Character Frequency](https://leetcode.com/problems/minimum-substring-partition-of-equal-character-frequency/) | Medium | 1917 | B130 · Q3 | library |
| 2896 | [Apply Operations to Make Two Strings Equal](https://leetcode.com/problems/apply-operations-to-make-two-strings-equal/) | Medium | 2172 | W366 · Q3 | library |
| 712 | [Minimum ASCII Delete Sum for Two Strings](https://leetcode.com/problems/minimum-ascii-delete-sum-for-two-strings/) | Medium | — | — | **NEW** |
| 139 | [Word Break](https://leetcode.com/problems/word-break/) | Medium | — | — | roadmap #215 |
| 1048 | [Longest String Chain](https://leetcode.com/problems/longest-string-chain/) | Medium | 1599 | W137 · Q3 | library |
| 467 | [Unique Substrings in Wraparound String](https://leetcode.com/problems/unique-substrings-in-wraparound-string/) | Medium | — | — | **NEW** |
| 32 | [Longest Valid Parentheses](https://leetcode.com/problems/longest-valid-parentheses/) | Hard | — | — | roadmap #318 |
| 115 | [Distinct Subsequences](https://leetcode.com/problems/distinct-subsequences/) | Hard | — | — | roadmap #237 |
| 140 | [Word Break II](https://leetcode.com/problems/word-break-ii/) | Hard | — | — | roadmap #218 |
| 912 | [Sort an Array](https://leetcode.com/problems/sort-an-array/) | Medium *(sheet: Hard)* | — | — | roadmap #177 |
| 472 | [Concatenated Words](https://leetcode.com/problems/concatenated-words/) | Hard | — | — | **NEW** |
| 730 | [Count Different Palindromic Subsequences](https://leetcode.com/problems/count-different-palindromic-subsequences/) | Hard | — | — | **NEW** |
| 940 | [Distinct Subsequences II](https://leetcode.com/problems/distinct-subsequences-ii/) | Hard | 1985 | W110 · Q4 | library |
| 1147 | [Longest Chunked Palindrome Decomposition](https://leetcode.com/problems/longest-chunked-palindrome-decomposition/) | Hard | 1912 | W148 · Q4 | library |
| 1531 | [String Compression II](https://leetcode.com/problems/string-compression-ii/) | Hard | 2576 | W199 · Q4 | library |
| 1639 | [Number of Ways to Form a Target String Given a Dictionary](https://leetcode.com/problems/number-of-ways-to-form-a-target-string-given-a-dictionary/) | Hard | 2082 | B38 · Q4 | roadmap #223 + library |
| 2911 | [Minimum Changes to Make K Semi-palindromes](https://leetcode.com/problems/minimum-changes-to-make-k-semi-palindromes/) | Hard | 2608 | W368 · Q4 | library |

#### Cummulative Sum

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 221 | [Maximal Square](https://leetcode.com/problems/maximal-square/) | Medium | — | — | roadmap #241 |
| 304 | [Range Sum Query 2D - Immutable](https://leetcode.com/problems/range-sum-query-2d-immutable/) | Medium | — | — | **NEW** |
| 764 | [Largest Plus Sign](https://leetcode.com/problems/largest-plus-sign/) | Medium | 1753 | W67 · Q3 | library |
| 1139 | [Largest 1-Bordered Square](https://leetcode.com/problems/largest-1-bordered-square/) | Medium | 1744 | W147 · Q3 | library |
| 1277 | [Count Square Submatrices with All Ones](https://leetcode.com/problems/count-square-submatrices-with-all-ones/) | Medium | 1613 | W165 · Q3 | library |
| 1314 | [Matrix Block Sum](https://leetcode.com/problems/matrix-block-sum/) | Medium | 1484 | B17 · Q2 | library |
| 1504 | [Count Submatrices With All Ones](https://leetcode.com/problems/count-submatrices-with-all-ones/) | Medium | 1845 | W196 · Q3 | library |
| 1664 | [Ways to Make a Fair Array](https://leetcode.com/problems/ways-to-make-a-fair-array/) | Medium | 1590 | W216 · Q3 | library |
| 85 | [Maximal Rectangle](https://leetcode.com/problems/maximal-rectangle/) | Hard | — | — | roadmap #233 |
| 363 | [Max Sum of Rectangle No Larger Than K](https://leetcode.com/problems/max-sum-of-rectangle-no-larger-than-k/) | Hard | — | — | **NEW** |
| 517 | [Super Washing Machines](https://leetcode.com/problems/super-washing-machines/) | Hard | — | — | **NEW** |
| 689 | [Maximum Sum of 3 Non-Overlapping Subarrays](https://leetcode.com/problems/maximum-sum-of-3-non-overlapping-subarrays/) | Hard | — | — | **NEW** |
| 1074 | [Number of Submatrices That Sum to Target](https://leetcode.com/problems/number-of-submatrices-that-sum-to-target/) | Hard | 2189 | W139 · Q4 | library |
| 3251 | [Find the Count of Monotonic Pairs II](https://leetcode.com/problems/find-the-count-of-monotonic-pairs-ii/) | Hard | 2323 | W410 · Q4 | library |
| 1537 | [Get the Maximum Score](https://leetcode.com/problems/get-the-maximum-score/) | Hard | 1961 | W200 · Q4 | roadmap #14 + library |

#### Matrix Chain Multiplication

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Matrix Chain Multiplication | Hard | — | — | not on LeetCode · GeeksforGeeks |
| 375 | [Guess Number Higher or Lower II](https://leetcode.com/problems/guess-number-higher-or-lower-ii/) | Medium | — | — | **NEW** |
| 486 | [Predict the Winner](https://leetcode.com/problems/predict-the-winner/) | Medium | — | — | **NEW** |
| 877 | [Stone Game](https://leetcode.com/problems/stone-game/) | Medium | 1590 | W95 · Q2 | library |
| 312 | [Burst Balloons](https://leetcode.com/problems/burst-balloons/) | Hard | — | — | roadmap #230 |
| 1039 | [Minimum Score Triangulation of Polygon](https://leetcode.com/problems/minimum-score-triangulation-of-polygon/) | Medium | 2130 | W135 · Q3 | library |
| 1130 | [Minimum Cost Tree From Leaf Values](https://leetcode.com/problems/minimum-cost-tree-from-leaf-values/) | Medium | 1919 | W146 · Q3 | library |
| 1043 | [Partition Array for Maximum Sum](https://leetcode.com/problems/partition-array-for-maximum-sum/) | Medium | 1916 | W136 · Q3 | library |
| 132 | [Palindrome Partitioning II](https://leetcode.com/problems/palindrome-partitioning-ii/) | Hard | — | — | **NEW** |
| 1690 | [Stone Game VII](https://leetcode.com/problems/stone-game-vii/) | Medium | 1951 | W219 · Q3 | library |
| 546 | [Remove Boxes](https://leetcode.com/problems/remove-boxes/) | Hard | — | — | **NEW** |
| 664 | [Strange Printer](https://leetcode.com/problems/strange-printer/) | Hard | — | — | **NEW** |
| 903 | [Valid Permutations for DI Sequence](https://leetcode.com/problems/valid-permutations-for-di-sequence/) | Hard | 2433 | W101 · Q4 | library |
| 1000 | [Minimum Cost to Merge Stones](https://leetcode.com/problems/minimum-cost-to-merge-stones/) | Hard | 2423 | W126 · Q4 | library |
| 1478 | [Allocate Mailboxes](https://leetcode.com/problems/allocate-mailboxes/) | Hard | 2190 | B28 · Q4 | library |
| 1547 | [Minimum Cost to Cut a Stick](https://leetcode.com/problems/minimum-cost-to-cut-a-stick/) | Hard | 2116 | W201 · Q4 | library |
| 1563 | [Stone Game V](https://leetcode.com/problems/stone-game-v/) | Hard | 2087 | W203 · Q4 | library |
| 1278 | [Palindrome Partitioning III](https://leetcode.com/problems/palindrome-partitioning-iii/) | Hard | 1979 | W165 · Q4 | library |

#### Kadane Algo

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 53 | [Maximum Subarray](https://leetcode.com/problems/maximum-subarray/) | Medium | — | — | **NEW** |
| 152 | [Maximum Product Subarray](https://leetcode.com/problems/maximum-product-subarray/) | Medium | — | — | roadmap #213 |
| 898 | [Bitwise ORs of Subarrays](https://leetcode.com/problems/bitwise-ors-of-subarrays/) | Medium | 2133 | W100 · Q3 | library |
| 978 | [Longest Turbulent Subarray](https://leetcode.com/problems/longest-turbulent-subarray/) | Medium | 1393 | W120 · Q2 | library |
| 1186 | [Maximum Subarray Sum with One Deletion](https://leetcode.com/problems/maximum-subarray-sum-with-one-deletion/) | Medium | 1799 | W153 · Q3 | library |
| 1191 | [K-Concatenation Maximum Sum](https://leetcode.com/problems/k-concatenation-maximum-sum/) | Medium | 1748 | W154 · Q3 | library |
| 873 | [Length of Longest Fibonacci Subsequence](https://leetcode.com/problems/length-of-longest-fibonacci-subsequence/) | Medium | 1911 | W94 · Q4 | library |

### Graphs

119 rows · 97 unique LeetCode problems · 31 already on your roadmap · 5 new

#### DFS and BFS on Graphs

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | DFS Traversal | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 1971 | [Find if Path Exists in Graph](https://leetcode.com/problems/find-if-path-exists-in-graph/) | Easy | — | — | roadmap #458 |
| 841 | [Keys and Rooms](https://leetcode.com/problems/keys-and-rooms/) | Medium | 1412 | W86 · Q2 | library |
| 547 | [Number of Provinces](https://leetcode.com/problems/number-of-provinces/) | Medium | — | — | **NEW** |
| 2685 | [Count the Number of Complete Components](https://leetcode.com/problems/count-the-number-of-complete-components/) | Medium | 1769 | W345 · Q4 | library |
| 1466 | [Reorder Routes to Make All Paths Lead to the City Zero](https://leetcode.com/problems/reorder-routes-to-make-all-paths-lead-to-the-city-zero/) | Medium | 1634 | W191 · Q3 | roadmap #332 + library |
| 2360 | [Longest Cycle in a Graph](https://leetcode.com/problems/longest-cycle-in-a-graph/) | Hard | 1897 | W304 · Q4 | roadmap #336 + library |
| — | BFS in Graph | Easy | — | — | not on LeetCode · GeeksforGeeks |
| 909 | [Snakes and Ladders](https://leetcode.com/problems/snakes-and-ladders/) | Medium | 2020 | W103 · Q2 | library |
| 752 | [Open the Lock](https://leetcode.com/problems/open-the-lock/) | Medium | 1878 | W64 · Q3 | roadmap #376 + library |
| — | Round Trip | Medium | — | — | not on LeetCode · CSES |
| 127 | [Word Ladder](https://leetcode.com/problems/word-ladder/) | Hard | — | — | roadmap #369 |
| — | Valid BFS? | Hard | — | — | not on LeetCode · Codeforces |
| 3015 | [Count the Number of Houses at a Certain Distance I](https://leetcode.com/problems/count-the-number-of-houses-at-a-certain-distance-i/) | Medium | 1658 | W381 · Q2 | library |
| 1162 | [As Far from Land as Possible](https://leetcode.com/problems/as-far-from-land-as-possible/) | Medium | 1666 | W150 · Q3 | library |
| 2059 | [Minimum Operations to Convert Number](https://leetcode.com/problems/minimum-operations-to-convert-number/) | Medium | 1850 | W265 · Q3 | library |
| 2492 | [Minimum Score of a Path Between Two Cities](https://leetcode.com/problems/minimum-score-of-a-path-between-two-cities/) | Medium | 1680 | W322 · Q3 | library |
| 1129 | [Shortest Path with Alternating Colors](https://leetcode.com/problems/shortest-path-with-alternating-colors/) | Medium | 1780 | W146 · Q2 | library |
| 2998 | [Minimum Number of Operations to Make X and Y Equal](https://leetcode.com/problems/minimum-number-of-operations-to-make-x-and-y-equal/) | Medium | 1795 | B121 · Q3 | library |
| 847 | [Shortest Path Visiting All Nodes](https://leetcode.com/problems/shortest-path-visiting-all-nodes/) | Hard | 2201 | W87 · Q4 | roadmap #339 + library |
| 1306 | [Jump Game III](https://leetcode.com/problems/jump-game-iii/) | Medium | 1397 | W169 · Q3 | library |
| 133 | [Clone Graph](https://leetcode.com/problems/clone-graph/) | Medium | — | — | roadmap #326 |
| 1970 | [Last Day Where You Can Still Cross](https://leetcode.com/problems/last-day-where-you-can-still-cross/) | Hard | 2124 | W254 · Q4 | roadmap #453 + library |
| 773 | [Sliding Puzzle](https://leetcode.com/problems/sliding-puzzle/) | Hard | 1815 | W69 · Q3 | library |
| 1298 | [Maximum Candies You Can Get from Boxes](https://leetcode.com/problems/maximum-candies-you-can-get-from-boxes/) | Hard | 1825 | W168 · Q4 | library |
| 864 | [Shortest Path to Get All Keys](https://leetcode.com/problems/shortest-path-to-get-all-keys/) | Hard | 2259 | W92 · Q4 | library |
| 1345 | [Jump Game IV](https://leetcode.com/problems/jump-game-iv/) | Hard | 1810 | B19 · Q4 | library |
| 126 | [Word Ladder II](https://leetcode.com/problems/word-ladder-ii/) | Hard | — | — | roadmap #203 |
| 2258 | [Escape the Spreading Fire](https://leetcode.com/problems/escape-the-spreading-fire/) | Hard | 2347 | B77 · Q4 | library |

#### Cycle Detection

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Detect Cycle in an Undirected Graph (GeeksforGeeks) | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Detect Cycle in a Directed Graph (GeeksforGeeks) | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Check if a Graph Has a Cycle of Odd Length | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 1559 | [Detect Cycles in 2D Grid](https://leetcode.com/problems/detect-cycles-in-2d-grid/) | Medium | 1838 | B33 · Q4 | library |
| 2608 | [Shortest Cycle in a Graph](https://leetcode.com/problems/shortest-cycle-in-a-graph/) | Hard | 1904 | B101 · Q4 | roadmap #338 + library |
| 785 | [Is Graph Bipartite?](https://leetcode.com/problems/is-graph-bipartite/) | Medium | 1625 | W72 · Q2 | library |
| 886 | [Possible Bipartition](https://leetcode.com/problems/possible-bipartition/) | Medium | 1795 | W97 · Q3 | library |
| 1042 | [Flower Planting With No Adjacent](https://leetcode.com/problems/flower-planting-with-no-adjacent/) | Medium | 1712 | W136 · Q2 | library |
| 2493 | [Divide Nodes into the Maximum Number of Groups](https://leetcode.com/problems/divide-nodes-into-the-maximum-number-of-groups/) | Hard | 2415 | W322 · Q4 | library |

#### Topological Sort

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 207 | [Course Schedule](https://leetcode.com/problems/course-schedule/) | Medium | — | — | roadmap #257 |
| 210 | [Course Schedule II](https://leetcode.com/problems/course-schedule-ii/) | Medium | — | — | roadmap #256 |
| 802 | [Find Eventual Safe States](https://leetcode.com/problems/find-eventual-safe-states/) | Medium | 1962 | W76 · Q3 | library |
| 310 | [Minimum Height Trees](https://leetcode.com/problems/minimum-height-trees/) | Medium | — | — | **NEW** |
| 851 | [Loud and Rich](https://leetcode.com/problems/loud-and-rich/) | Medium | 1783 | W88 · Q3 | library |
| 2192 | [All Ancestors of a Node in a Directed Acyclic Graph](https://leetcode.com/problems/all-ancestors-of-a-node-in-a-directed-acyclic-graph/) | Medium | 1788 | B73 · Q3 | library |
| 2115 | [Find All Possible Recipes from Given Supplies](https://leetcode.com/problems/find-all-possible-recipes-from-given-supplies/) | Medium *(sheet: Hard)* | 1679 | B68 · Q2 | roadmap #258 + library |
| 269 | [Alien Dictionary](https://leetcode.com/problems/alien-dictionary/) 🔒 | Hard | — | — | roadmap #254 |
| 329 | [Longest Increasing Path in a Matrix](https://leetcode.com/problems/longest-increasing-path-in-a-matrix/) | Hard | — | — | roadmap #234 |
| 913 | [Cat and Mouse](https://leetcode.com/problems/cat-and-mouse/) | Hard | 2567 | W104 · Q4 | library |
| 1203 | [Sort Items by Groups Respecting Dependencies](https://leetcode.com/problems/sort-items-by-groups-respecting-dependencies/) | Hard | 2419 | W155 · Q4 | roadmap #263 + library |
| 1857 | [Largest Color Value in a Directed Graph](https://leetcode.com/problems/largest-color-value-in-a-directed-graph/) | Hard | 2313 | W240 · Q4 | library |
| 2050 | [Parallel Courses III](https://leetcode.com/problems/parallel-courses-iii/) | Hard | 2084 | W264 · Q4 | roadmap #261 + library |
| 1494 | [Parallel Courses II](https://leetcode.com/problems/parallel-courses-ii/) | Hard | 2082 | B29 · Q4 | library |
| 2328 | [Number of Increasing Paths in a Grid](https://leetcode.com/problems/number-of-increasing-paths-in-a-grid/) | Hard | 2001 | W300 · Q4 | library |
| 2392 | [Build a Matrix With Conditions](https://leetcode.com/problems/build-a-matrix-with-conditions/) | Hard | 1961 | W308 · Q4 | roadmap #259 + library |

#### Flood Fill

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 733 | [Flood Fill](https://leetcode.com/problems/flood-fill/) | Easy | — | — | roadmap #190 |
| 463 | [Island Perimeter](https://leetcode.com/problems/island-perimeter/) | Easy | — | — | roadmap #288 |
| 419 | [Battleships in a Board](https://leetcode.com/problems/battleships-in-a-board/) | Medium | — | — | **NEW** |
| 200 | [Number of Islands](https://leetcode.com/problems/number-of-islands/) | Medium | — | — | roadmap #450 |
| 695 | [Max Area of Island](https://leetcode.com/problems/max-area-of-island/) | Medium | — | — | roadmap #340 |
| 1905 | [Count Sub Islands](https://leetcode.com/problems/count-sub-islands/) | Medium | 1679 | W246 · Q3 | library |
| 1992 | [Find All Groups of Farmland](https://leetcode.com/problems/find-all-groups-of-farmland/) | Medium | 1539 | B60 · Q2 | library |

#### Multi Source BFS

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 994 | [Rotting Oranges](https://leetcode.com/problems/rotting-oranges/) | Medium | 1433 | W124 · Q2 | library |
| 1020 | [Number of Enclaves](https://leetcode.com/problems/number-of-enclaves/) | Medium | 1615 | W130 · Q4 | library |
| 1765 | [Map of Highest Peak](https://leetcode.com/problems/map-of-highest-peak/) | Medium | 1783 | B46 · Q3 | library |
| 130 | [Surrounded Regions](https://leetcode.com/problems/surrounded-regions/) | Medium | — | — | **NEW** |
| 1254 | [Number of Closed Islands](https://leetcode.com/problems/number-of-closed-islands/) | Medium | 1659 | W162 · Q3 | library |
| 542 | [01 Matrix](https://leetcode.com/problems/01-matrix/) | Medium | — | — | roadmap #211 |
| 934 | [Shortest Bridge](https://leetcode.com/problems/shortest-bridge/) | Medium | 1826 | W109 · Q3 | library |

#### Dijsktra Algorithm

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Shortest Route I | Medium | — | — | not on LeetCode · CSES |
| — | Dijkstra? | Medium | — | — | not on LeetCode · CSES ("Dijkstra?") |
| — | Investigation | Medium | — | — | not on LeetCode · CSES |
| — | Flight Discount | Medium | — | — | not on LeetCode · CSES |
| 743 | [Network Delay Time](https://leetcode.com/problems/network-delay-time/) | Medium | — | — | roadmap #324 |
| 787 | [Cheapest Flights Within K Stops](https://leetcode.com/problems/cheapest-flights-within-k-stops/) | Medium | 1786 | W72 · Q3 | roadmap #238 + library |
| 1976 | [Number of Ways to Arrive at Destination](https://leetcode.com/problems/number-of-ways-to-arrive-at-destination/) | Medium | 2095 | B59 · Q3 | library |
| 1514 | [Path with Maximum Probability](https://leetcode.com/problems/path-with-maximum-probability/) | Medium | 1846 | W197 · Q3 | roadmap #331 + library |
| 1631 | [Path with Minimum Effort](https://leetcode.com/problems/path-with-minimum-effort/) | Medium | 1948 | W212 · Q3 | library |
| 1786 | [Number of Restricted Paths from First to Last Node](https://leetcode.com/problems/number-of-restricted-paths-from-first-to-last-node/) | Medium | 2079 | W231 · Q3 | library |
| 882 | [Reachable Nodes in Subdivided Graph](https://leetcode.com/problems/reachable-nodes-in-subdivided-graph/) | Hard | 2328 | W96 · Q4 | library |
| 1368 | [Minimum Cost to Make at Least One Valid Path in a Grid](https://leetcode.com/problems/minimum-cost-to-make-at-least-one-valid-path-in-a-grid/) | Hard | 2069 | W178 · Q4 | roadmap #337 + library |
| 2290 | [Minimum Obstacle Removal to Reach Corner](https://leetcode.com/problems/minimum-obstacle-removal-to-reach-corner/) | Hard | 2138 | W295 · Q4 | library |
| 1091 | [Shortest Path in Binary Matrix](https://leetcode.com/problems/shortest-path-in-binary-matrix/) | Medium | 1658 | W141 · Q3 | library |
| 1926 | [Nearest Exit from Entrance in Maze](https://leetcode.com/problems/nearest-exit-from-entrance-in-maze/) | Medium | 1638 | B56 · Q2 | library |
| 2045 | [Second Minimum Time to Reach Destination](https://leetcode.com/problems/second-minimum-time-to-reach-destination/) | Hard | 2202 | W263 · Q4 | library |

#### Bellman Ford

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | High Score | Medium | — | — | not on LeetCode · CSES |
| — | Cycle Finding | Medium | — | — | not on LeetCode · CSES |
| 815 | [Bus Routes](https://leetcode.com/problems/bus-routes/) | Hard | 1964 | W79 · Q4 | roadmap #328 + library |

#### Floyd Warshall

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Road Construction | Medium | — | — | not on LeetCode · CSES |
| 1462 | [Course Schedule IV](https://leetcode.com/problems/course-schedule-iv/) | Medium | 1693 | B27 · Q3 | library |
| 1334 | [Find the City With the Smallest Number of Neighbors at a Threshold Distance](https://leetcode.com/problems/find-the-city-with-the-smallest-number-of-neighbors-at-a-threshold-distance/) | Medium | 1855 | W173 · Q3 | library |
| 3015 | [Count the Number of Houses at a Certain Distance I](https://leetcode.com/problems/count-the-number-of-houses-at-a-certain-distance-i/) | Medium | 1658 | W381 · Q2 | library |
| 2976 | [Minimum Cost to Convert String I](https://leetcode.com/problems/minimum-cost-to-convert-string-i/) | Medium | 1882 | W377 · Q3 | library |
| — | Greg and Array | Medium | — | — | not on LeetCode · Codeforces |
| 2642 | [Design Graph With Shortest Path Calculator](https://leetcode.com/problems/design-graph-with-shortest-path-calculator/) | Hard | 1811 | B102 · Q4 | library |
| 2959 | [Number of Possible Sets of Closing Branches](https://leetcode.com/problems/number-of-possible-sets-of-closing-branches/) | Hard | 2077 | B119 · Q4 | library |

#### Travelling Salesman Problem

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 943 | [Find the Shortest Superstring](https://leetcode.com/problems/find-the-shortest-superstring/) | Hard | 2186 | W111 · Q4 | library |

#### Disjoint Set Union

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 684 | [Redundant Connection](https://leetcode.com/problems/redundant-connection/) | Medium | — | — | roadmap #449 |
| 990 | [Satisfiability of Equality Equations](https://leetcode.com/problems/satisfiability-of-equality-equations/) | Medium | 1638 | W123 · Q2 | library |
| 1202 | [Smallest String With Swaps](https://leetcode.com/problems/smallest-string-with-swaps/) | Medium | 1855 | W155 · Q3 | library |
| 721 | [Accounts Merge](https://leetcode.com/problems/accounts-merge/) | Medium | — | — | roadmap #455 |
| 947 | [Most Stones Removed with Same Row or Column](https://leetcode.com/problems/most-stones-removed-with-same-row-or-column/) | Medium | 2035 | W112 · Q3 | roadmap #451 + library |
| 1562 | [Find Latest Group of Size M](https://leetcode.com/problems/find-latest-group-of-size-m/) | Medium | 1928 | W203 · Q3 | library |
| 685 | [Redundant Connection II](https://leetcode.com/problems/redundant-connection-ii/) | Hard | — | — | **NEW** |
| 827 | [Making a Large Island](https://leetcode.com/problems/making-a-large-island/) | Hard | 1934 | W82 · Q4 | library |
| 1998 | [GCD Sort of an Array](https://leetcode.com/problems/gcd-sort-of-an-array/) | Hard | 2429 | W257 · Q4 | library |
| 803 | [Bricks Falling When Hit](https://leetcode.com/problems/bricks-falling-when-hit/) | Hard | 2765 | W76 · Q4 | library |
| 1697 | [Checking Existence of Edge Length Limited Paths](https://leetcode.com/problems/checking-existence-of-edge-length-limited-paths/) | Hard | 2300 | W220 · Q4 | library |
| 1579 | [Remove Max Number of Edges to Keep Graph Fully Traversable](https://leetcode.com/problems/remove-max-number-of-edges-to-keep-graph-fully-traversable/) | Hard | 2132 | W205 · Q4 | library |
| 1632 | [Rank Transform of a Matrix](https://leetcode.com/problems/rank-transform-of-a-matrix/) | Hard | 2530 | W212 · Q4 | library |

#### Minimum Spanning Tree

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Prim's Minimum Spanning Tree (MST) - Greedy Algorithm | Theory | — | — | not on LeetCode · Theory |
| — | Kruskal's Minimum Spanning Tree Algorithm - Greedy Algorithm | Theory | — | — | not on LeetCode · Theory |
| — | Minimum Spanning Tree | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 1584 | [Min Cost to Connect All Points](https://leetcode.com/problems/min-cost-to-connect-all-points/) | Medium *(sheet: Hard)* | 1858 | W206 · Q3 | library |
| — | Water Connection Problem | Hard | — | — | not on LeetCode · GeeksforGeeks |
| 1135 | [Connecting Cities with Minimum Cost](https://leetcode.com/problems/connecting-cities-with-minimum-cost/) 🔒 | Medium | 1753 | B5 · Q3 | library |
| 1489 | [Find Critical and Pseudo-Critical Edges in Minimum Spanning Tree](https://leetcode.com/problems/find-critical-and-pseudo-critical-edges-in-minimum-spanning-tree/) | Hard | 2572 | W194 · Q4 | library |

#### Additional Graph Algorithm

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Articulation Points (or Cut Vertices) in a Graph | Theory | — | — | not on LeetCode · Theory |
| — | Strongly Connected Components | Theory | — | — | not on LeetCode · Theory |
| 1192 | [Critical Connections in a Network](https://leetcode.com/problems/critical-connections-in-a-network/) | Hard *(sheet: Medium)* | 2085 | W154 · Q4 | library |

### Combinatorics & Geometry

36 rows · 28 unique LeetCode problems · 11 already on your roadmap · 4 new

#### Line

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1232 | [Check if it is a Straight Line](https://leetcode.com/problems/check-if-it-is-a-straight-line/) | Easy | 1247 | W159 · Q1 | roadmap #503 + library |
| 2280 | [Minimum Lines to Represent a Line Chart](https://leetcode.com/problems/minimum-lines-to-represent-a-line-chart/) | Medium | 1681 | W294 · Q3 | library |
| 973 | [K Closest Points to Origin](https://leetcode.com/problems/k-closest-points-to-origin/) | Medium | 1214 | W119 · Q1 | roadmap #114 + library |
| — | Check If Two Line Segments Intersect | Medium | — | — | not on LeetCode · GeeksforGeeks |
| 149 | [Max Points on a Line](https://leetcode.com/problems/max-points-on-a-line/) | Hard | — | — | roadmap #510 |
| 3102 | [Minimize Manhattan Distances](https://leetcode.com/problems/minimize-manhattan-distances/) | Hard | 2216 | W391 · Q4 | roadmap #501 + library |
| 335 | [Self Crossing](https://leetcode.com/problems/self-crossing/) | Hard | — | — | roadmap #513 |

#### Rectangle

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 836 | [Rectangle Overlap](https://leetcode.com/problems/rectangle-overlap/) | Easy | 1443 | W85 · Q1 | roadmap #506 + library |
| 812 | [Largest Triangle Area](https://leetcode.com/problems/largest-triangle-area/) | Easy | 1543 | W79 · Q1 | library |
| 3111 | [Minimum Rectangles to Cover Points](https://leetcode.com/problems/minimum-rectangles-to-cover-points/) | Medium | 1401 | B128 · Q2 | library |
| 223 | [Rectangle Area](https://leetcode.com/problems/rectangle-area/) | Medium | — | — | roadmap #508 |
| 939 | [Minimum Area Rectangle](https://leetcode.com/problems/minimum-area-rectangle/) | Medium | 1752 | W110 · Q3 | roadmap #497 + library |
| 963 | [Minimum Area Rectangle II](https://leetcode.com/problems/minimum-area-rectangle-ii/) | Medium | 1991 | W116 · Q3 | library |
| 858 | [Mirror Reflection](https://leetcode.com/problems/mirror-reflection/) | Medium | 1881 | W90 · Q3 | library |
| 3047 | [Find the Largest Area of Square Inside Two Rectangles](https://leetcode.com/problems/find-the-largest-area-of-square-inside-two-rectangles/) | Medium | 1602 | W386 · Q2 | library |

#### Circle

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 2481 | [Minimum Cuts to Divide a Circle](https://leetcode.com/problems/minimum-cuts-to-divide-a-circle/) | Easy *(sheet: Medium)* | 1246 | B92 · Q1 | roadmap #504 + library |
| 478 | [Generate Random Point in a Circle](https://leetcode.com/problems/generate-random-point-in-a-circle/) | Medium | — | — | **NEW** |
| 1401 | [Circle and Rectangle Overlapping](https://leetcode.com/problems/circle-and-rectangle-overlapping/) | Medium | 1709 | B23 · Q3 | library |
| 2249 | [Count Lattice Points Inside a Circle](https://leetcode.com/problems/count-lattice-points-inside-a-circle/) | Medium | 1603 | W290 · Q2 | library |
| 1828 | [Queries on Number of Points Inside a Circle](https://leetcode.com/problems/queries-on-number-of-points-inside-a-circle/) | Medium | 1380 | B50 · Q2 | roadmap #509 + library |
| 1453 | [Maximum Number of Darts Inside of a Circular Dartboard](https://leetcode.com/problems/maximum-number-of-darts-inside-of-a-circular-dartboard/) | Hard | 2202 | W189 · Q4 | library |

#### Combinatorics

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Factorial of Large Numbers | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | nCr Mod m | Medium | — | — | not on LeetCode · GeeksforGeeks |
| — | Tiles | Medium | — | — | not on LeetCode · Codeforces |
| 2929 | [Distribute Candies Among Children II](https://leetcode.com/problems/distribute-candies-among-children-ii/) | Medium | 1701 | B117 · Q2 | library |
| 62 | [Unique Paths](https://leetcode.com/problems/unique-paths/) | Medium | — | — | **NEW** |
| — | Right Triangles | Medium | — | — | not on LeetCode · Codeforces |
| 60 | [Permutation Sequence](https://leetcode.com/problems/permutation-sequence/) | Hard | — | — | **NEW** |
| 2514 | [Count Anagrams](https://leetcode.com/problems/count-anagrams/) | Hard | 2070 | B94 · Q4 | roadmap #437 + library |
| 1569 | [Number of Ways to Reorder Array to Get Same BST](https://leetcode.com/problems/number-of-ways-to-reorder-array-to-get-same-bst/) | Hard | 2288 | W204 · Q4 | library |
| 2338 | [Count the Number of Ideal Arrays](https://leetcode.com/problems/count-the-number-of-ideal-arrays/) | Hard | 2615 | W301 · Q4 | library |
| 1359 | [Count All Valid Pickup and Delivery Options](https://leetcode.com/problems/count-all-valid-pickup-and-delivery-options/) | Hard | 1723 | B20 · Q4 | library |
| 2505 | [Bitwise OR of All Subsequence Sums](https://leetcode.com/problems/bitwise-or-of-all-subsequence-sums/) 🔒 | Medium *(sheet: Hard)* | — | — | **NEW** |
| — | Count the Arrays | Hard | — | — | not on LeetCode · Codeforces |
| — | Beautiful Numbers | Hard | — | — | **ambiguous — see below** |
| — | String Mark | Hard | — | — | not on LeetCode · Codeforces |

### Game Theory

25 rows · 10 unique LeetCode problems · 1 already on your roadmap · 2 new

#### Level I

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 1025 | [Divisor Game](https://leetcode.com/problems/divisor-game/) | Easy | 1435 | W132 · Q1 | library |
| 292 | [Nim Game](https://leetcode.com/problems/nim-game/) | Easy | — | — | roadmap #524 |
| 3222 | [Find the Winning Player in Coin Game](https://leetcode.com/problems/find-the-winning-player-in-coin-game/) | Easy | 1270 | B135 · Q1 | library |
| — | Yet Another String Game | Easy | — | — | not on LeetCode · Codeforces |
| — | Substring Removal Game | Easy | — | — | not on LeetCode · Codeforces |
| — | Sasha and Sticks | Easy | — | — | not on LeetCode · Codeforces |
| — | Card Game | Easy | — | — | not on LeetCode · Codeforces |
| — | 01 Game | Easy | — | — | not on LeetCode · Codeforces |
| — | Digit Game | Easy | — | — | not on LeetCode · Codeforces |

#### Level II

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 464 | [Can I Win](https://leetcode.com/problems/can-i-win/) | Medium | — | — | **NEW** |
| 375 | [Guess Number Higher or Lower II](https://leetcode.com/problems/guess-number-higher-or-lower-ii/) | Medium | — | — | **NEW** |
| 1561 | [Maximum Number of Coins You Can Get](https://leetcode.com/problems/maximum-number-of-coins-you-can-get/) | Medium | 1406 | W203 · Q2 | library |
| 2038 | [Remove Colored Pieces if Both Neighbors are the Same Color](https://leetcode.com/problems/remove-colored-pieces-if-both-neighbors-are-the-same-color/) | Medium | 1468 | B63 · Q2 | library |
| — | Digit Game | Medium | — | — | not on LeetCode · Codeforces |
| — | Dinner With Emma | Medium | — | — | not on LeetCode · Codeforces |
| — | Matrix Game | Medium | — | — | not on LeetCode · Codeforces |
| — | Sequential Game | Medium | — | — | not on LeetCode · Codeforces |
| — | Ping-pong | Medium | — | — | not on LeetCode · Codeforces |
| — | Godsend | Medium | — | — | not on LeetCode · Codeforces |
| — | PolandBall and Game | Medium | — | — | not on LeetCode · Codeforces |
| — | Even-Odd Game | Medium | — | — | not on LeetCode · Codeforces |
| — | Palindrome Game | Medium | — | — | not on LeetCode · Codeforces |

#### Level III

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 913 | [Cat and Mouse](https://leetcode.com/problems/cat-and-mouse/) | Hard | 2567 | W104 · Q4 | library |
| 1728 | [Cat and Mouse II](https://leetcode.com/problems/cat-and-mouse-ii/) | Hard | 2849 | W224 · Q4 | library |
| 843 | [Guess the Word](https://leetcode.com/problems/guess-the-word/) | Hard | 2078 | W86 · Q4 | library |

### Dynamic Programming Level 2

63 rows · 49 unique LeetCode problems · 5 already on your roadmap · 9 new

#### DP with Bitmask

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 464 | [Can I Win](https://leetcode.com/problems/can-i-win/) | Medium | — | — | **NEW** |
| 698 | [Partition to K Equal Sum Subsets](https://leetcode.com/problems/partition-to-k-equal-sum-subsets/) | Medium | — | — | **NEW** |
| 691 | [Stickers to Spell Word](https://leetcode.com/problems/stickers-to-spell-word/) | Hard | — | — | **NEW** |
| 1125 | [Smallest Sufficient Team](https://leetcode.com/problems/smallest-sufficient-team/) | Hard | 2251 | W145 · Q4 | library |
| 1349 | [Maximum Students Taking Exam](https://leetcode.com/problems/maximum-students-taking-exam/) | Hard | 2386 | W175 · Q4 | library |
| 1434 | [Number of Ways to Wear Different Hats to Each Other](https://leetcode.com/problems/number-of-ways-to-wear-different-hats-to-each-other/) | Hard | 2273 | B25 · Q4 | library |
| 1595 | [Minimum Cost to Connect Two Groups of Points](https://leetcode.com/problems/minimum-cost-to-connect-two-groups-of-points/) | Hard | 2538 | W207 · Q4 | library |
| 1601 | [Maximum Number of Achievable Transfer Requests](https://leetcode.com/problems/maximum-number-of-achievable-transfer-requests/) | Hard | 2119 | W208 · Q4 | library |
| — | Little Elephant and T-Shirts | Hard | — | — | not on LeetCode · Codeforces |
| 1655 | [Distribute Repeating Integers](https://leetcode.com/problems/distribute-repeating-integers/) | Hard | 2307 | B39 · Q4 | library |
| 1659 | [Maximize Grid Happiness](https://leetcode.com/problems/maximize-grid-happiness/) | Hard | 2655 | W215 · Q4 | library |
| 1723 | [Find Minimum Time to Finish All Jobs](https://leetcode.com/problems/find-minimum-time-to-finish-all-jobs/) | Hard | 2284 | W223 · Q4 | library |
| 3117 | [Minimum Sum of Values by Dividing Array](https://leetcode.com/problems/minimum-sum-of-values-by-dividing-array/) | Hard | 2735 | W393 · Q4 | library |
| 847 | [Shortest Path Visiting All Nodes](https://leetcode.com/problems/shortest-path-visiting-all-nodes/) | Hard | 2201 | W87 · Q4 | roadmap #339 + library |
| — | Grouping | Hard | — | — | not on LeetCode · CSES |
| — | Matching | Hard | — | — | not on LeetCode · CSES |

#### Digit DP

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Counting Numbers | Hard | — | — | not on LeetCode · CSES |
| 600 | [Non-negative Integers without Consecutive Ones](https://leetcode.com/problems/non-negative-integers-without-consecutive-ones/) | Hard | — | — | **NEW** |
| 902 | [Numbers At Most N Given Digit Set](https://leetcode.com/problems/numbers-at-most-n-given-digit-set/) | Hard | 1990 | W101 · Q3 | library |
| 1012 | [Numbers With Repeated Digits](https://leetcode.com/problems/numbers-with-repeated-digits/) | Hard | 2230 | W128 · Q4 | library |
| 233 | [Number of Digit One](https://leetcode.com/problems/number-of-digit-one/) | Hard | — | — | **NEW** |
| 2827 | [Number of Beautiful Integers in the Range](https://leetcode.com/problems/number-of-beautiful-integers-in-the-range/) | Hard | 2324 | B111 · Q4 | library |
| 2999 | [Count the Number of Powerful Integers](https://leetcode.com/problems/count-the-number-of-powerful-integers/) | Hard | 2351 | B121 · Q4 | library |
| 1397 | [Find All Good Strings](https://leetcode.com/problems/find-all-good-strings/) | Hard | 2667 | W182 · Q4 | library |

#### DP on Trees

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 337 | [House Robber III](https://leetcode.com/problems/house-robber-iii/) | Medium | — | — | roadmap #188 |
| 1372 | [Longest ZigZag Path in a Binary Tree](https://leetcode.com/problems/longest-zigzag-path-in-a-binary-tree/) | Medium | 1713 | B21 · Q3 | library |
| 2925 | [Maximum Score After Applying Operations on a Tree](https://leetcode.com/problems/maximum-score-after-applying-operations-on-a-tree/) | Medium | 1940 | W370 · Q3 | library |
| — | Subordinates | Medium | — | — | not on LeetCode · CSES |
| — | Tree Matching | Hard | — | — | not on LeetCode · CSES |
| 1373 | [Maximum Sum BST in Binary Tree](https://leetcode.com/problems/maximum-sum-bst-in-binary-tree/) | Hard | 1914 | B21 · Q4 | library |
| 1569 | [Number of Ways to Reorder Array to Get Same BST](https://leetcode.com/problems/number-of-ways-to-reorder-array-to-get-same-bst/) | Hard | 2288 | W204 · Q4 | library |
| 2920 | [Maximum Points After Collecting Coins From All Nodes](https://leetcode.com/problems/maximum-points-after-collecting-coins-from-all-nodes/) | Hard | 2351 | W369 · Q4 | library |
| 834 | [Sum of Distances in Tree](https://leetcode.com/problems/sum-of-distances-in-tree/) | Hard | 2197 | W84 · Q4 | roadmap #358 + library |
| 2791 | [Count Paths That Can Form a Palindrome in a Tree](https://leetcode.com/problems/count-paths-that-can-form-a-palindrome-in-a-tree/) | Hard | 2677 | W355 · Q4 | library |
| 2973 | [Find Number of Coins to Place in Tree Nodes](https://leetcode.com/problems/find-number-of-coins-to-place-in-tree-nodes/) | Hard | 2277 | B120 · Q4 | library |
| 2646 | [Minimize the Total Price of the Trips](https://leetcode.com/problems/minimize-the-total-price-of-the-trips/) | Hard | 2238 | W341 · Q4 | library |
| — | Tree Distances 1 | Hard | — | — | not on LeetCode · CSES |
| — | Tree Distances II | Hard | — | — | not on LeetCode · CSES |
| — | Company Queries I | Hard | — | — | not on LeetCode · CSES |
| — | Company Queries II | Hard | — | — | not on LeetCode · CSES |
| — | Distance Queries | Hard | — | — | not on LeetCode · CSES |
| 3241 | [Time Taken to Mark All Nodes](https://leetcode.com/problems/time-taken-to-mark-all-nodes/) | Hard | 2522 | B136 · Q4 | library |

#### DP with Math

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 264 | [Ugly Number II](https://leetcode.com/problems/ugly-number-ii/) | Medium | — | — | **NEW** |
| 1641 | [Count Sorted Vowel Strings](https://leetcode.com/problems/count-sorted-vowel-strings/) | Medium | 1519 | W213 · Q2 | library |
| 818 | [Race Car](https://leetcode.com/problems/race-car/) | Hard | 2392 | W80 · Q4 | library |
| 887 | [Super Egg Drop](https://leetcode.com/problems/super-egg-drop/) | Hard | 2377 | W97 · Q4 | library |
| 964 | [Least Operators to Express Number](https://leetcode.com/problems/least-operators-to-express-number/) | Hard | 2594 | W116 · Q4 | library |
| 1363 | [Largest Multiple of Three](https://leetcode.com/problems/largest-multiple-of-three/) | Hard | 1823 | W177 · Q4 | library |
| 1643 | [Kth Smallest Instructions](https://leetcode.com/problems/kth-smallest-instructions/) | Hard | 2080 | W213 · Q4 | library |
| 1621 | [Number of Sets of K Non-Overlapping Line Segments](https://leetcode.com/problems/number-of-sets-of-k-non-overlapping-line-segments/) | Medium | 2198 | B37 · Q3 | library |
| 790 | [Domino and Tromino Tiling](https://leetcode.com/problems/domino-and-tromino-tiling/) | Medium | 1830 | W73 · Q4 | library |
| 357 | [Count Numbers with Unique Digits](https://leetcode.com/problems/count-numbers-with-unique-digits/) | Medium | — | — | **NEW** |
| 1611 | [Minimum One Bit Operations to Make Integers Zero](https://leetcode.com/problems/minimum-one-bit-operations-to-make-integers-zero/) | Hard | 2345 | W209 · Q4 | roadmap #492 + library |
| 3130 | [Find All Possible Stable Binary Arrays II](https://leetcode.com/problems/find-all-possible-stable-binary-arrays-ii/) | Hard | 2825 | B129 · Q4 | library |
| — | Counting Tilings | Hard | — | — | not on LeetCode · CSES |

#### Dp with Probability

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 808 | [Soup Servings](https://leetcode.com/problems/soup-servings/) | Medium | 2397 | W78 · Q3 | roadmap #244 + library |
| 837 | [New 21 Game](https://leetcode.com/problems/new-21-game/) | Medium | 2350 | W85 · Q3 | library |
| 1227 | [Airplane Seat Assignment Probability](https://leetcode.com/problems/airplane-seat-assignment-probability/) | Medium | — | — | **NEW** |
| 688 | [Knight Probability in Chessboard](https://leetcode.com/problems/knight-probability-in-chessboard/) | Medium | — | — | **NEW** |
| 799 | [Champagne Tower](https://leetcode.com/problems/champagne-tower/) | Medium | 1856 | W75 · Q3 | library |
| — | Sushi | Hard | — | — | not on LeetCode · AtCoder (DP contest) |
| — | Coins | Hard | — | — | not on LeetCode · AtCoder (DP contest) |
| 1467 | [Probability of a Two Boxes Having the Same Number of Distinct Balls](https://leetcode.com/problems/probability-of-a-two-boxes-having-the-same-number-of-distinct-balls/) | Hard | 2357 | W191 · Q4 | library |

### String Matching Algos

19 rows · 16 unique LeetCode problems · 1 already on your roadmap · 1 new

#### Introduction

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | KMP Algorithm for Pattern Searching | Theory | — | — | not on LeetCode · Theory |
| — | Rabin-Karp Algorithm for Pattern Searching | Theory | — | — | not on LeetCode · Theory |
| — | Z Algorithm (Linear-Time Pattern Searching Algorithm) | Theory | — | — | not on LeetCode · Theory |

#### Implementary Problems

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 3045 | [Count Prefix and Suffix Pairs II](https://leetcode.com/problems/count-prefix-and-suffix-pairs-ii/) | Hard | 2328 | W385 · Q4 | library |
| 3036 | [Number of Subarrays That Match a Pattern II](https://leetcode.com/problems/number-of-subarrays-that-match-a-pattern-ii/) | Hard | 1895 | W384 · Q4 | library |
| 3031 | [Minimum Time to Revert Word to Initial State II](https://leetcode.com/problems/minimum-time-to-revert-word-to-initial-state-ii/) | Hard | 2278 | W383 · Q4 | library |
| 3008 | [Find Beautiful Indices in the Given Array II](https://leetcode.com/problems/find-beautiful-indices-in-the-given-array-ii/) | Hard | 2016 | W380 · Q4 | library |
| 2851 | [String Transformation](https://leetcode.com/problems/string-transformation/) | Hard | 2858 | W362 · Q4 | library |
| 2156 | [Find Substring with Given Hash Value](https://leetcode.com/problems/find-substring-with-given-hash-value/) | Hard | 2063 | W278 · Q3 | library |
| 2430 | [Maximum Deletions on a String](https://leetcode.com/problems/maximum-deletions-on-a-string/) | Hard | 2102 | W313 · Q4 | library |
| 2301 | [Match Substring After Replacement](https://leetcode.com/problems/match-substring-after-replacement/) | Hard | 1861 | B80 · Q3 | library |
| 2223 | [Sum of Scores of Built Strings](https://leetcode.com/problems/sum-of-scores-of-built-strings/) | Hard | 2220 | B75 · Q4 | library |
| 1397 | [Find All Good Strings](https://leetcode.com/problems/find-all-good-strings/) | Hard | 2667 | W182 · Q4 | library |
| 1392 | [Longest Happy Prefix](https://leetcode.com/problems/longest-happy-prefix/) | Hard | 1876 | W181 · Q4 | roadmap #409 + library |
| 214 | [Shortest Palindrome](https://leetcode.com/problems/shortest-palindrome/) | Hard | — | — | **NEW** |
| 1316 | [Distinct Echo Substrings](https://leetcode.com/problems/distinct-echo-substrings/) | Hard | 1837 | B17 · Q4 | library |
| 1147 | [Longest Chunked Palindrome Decomposition](https://leetcode.com/problems/longest-chunked-palindrome-decomposition/) | Hard | 1912 | W148 · Q4 | library |
| 1960 | [Maximum Product of the Length of Two Palindromic Substrings](https://leetcode.com/problems/maximum-product-of-the-length-of-two-palindromic-substrings/) | Hard | 2691 | B58 · Q4 | library |
| 1044 | [Longest Duplicate Substring](https://leetcode.com/problems/longest-duplicate-substring/) | Hard | 2429 | W136 · Q4 | library |

### Advance algorithm

22 rows · 17 unique LeetCode problems · 1 already on your roadmap · 4 new

#### Fenwick Tree

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 3245 | [Alternating Groups III](https://leetcode.com/problems/alternating-groups-iii/) | Hard *(sheet: Medium)* | 3112 | W409 · Q4 | library |
| 2426 | [Number of Pairs Satisfying Inequality](https://leetcode.com/problems/number-of-pairs-satisfying-inequality/) | Hard | 2030 | B88 · Q4 | library |
| 2179 | [Count Good Triplets in an Array](https://leetcode.com/problems/count-good-triplets-in-an-array/) | Hard | 2272 | B72 · Q4 | library |
| 2286 | [Booking Concert Tickets in Groups](https://leetcode.com/problems/booking-concert-tickets-in-groups/) | Hard | 2470 | B79 · Q4 | library |

#### Segment Tree

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| 2424 | [Longest Uploaded Prefix](https://leetcode.com/problems/longest-uploaded-prefix/) | Medium | 1604 | B88 · Q2 | library |
| 307 | [Range Sum Query - Mutable](https://leetcode.com/problems/range-sum-query-mutable/) | Medium | — | — | **NEW** |
| 699 | [Falling Squares](https://leetcode.com/problems/falling-squares/) | Hard | — | — | **NEW** |
| 715 | [Range Module](https://leetcode.com/problems/range-module/) | Hard | — | — | roadmap #468 |
| 327 | [Count of Range Sum](https://leetcode.com/problems/count-of-range-sum/) | Hard | — | — | **NEW** |
| 2213 | [Longest Substring of One Repeating Character](https://leetcode.com/problems/longest-substring-of-one-repeating-character/) | Hard | 2629 | W285 · Q4 | library |
| 2736 | [Maximum Sum Queries](https://leetcode.com/problems/maximum-sum-queries/) | Hard | 2533 | W349 · Q4 | library |
| 2569 | [Handling Sum Queries After Update](https://leetcode.com/problems/handling-sum-queries-after-update/) | Hard | 2398 | B98 · Q4 | library |
| 3187 | [Peaks in Array](https://leetcode.com/problems/peaks-in-array/) | Hard | 2154 | W402 · Q4 | library |
| 3165 | [Maximum Sum of Subsequence With Non-Adjacent Elements](https://leetcode.com/problems/maximum-sum-of-subsequence-with-non-adjacent-elements/) | Hard | 2698 | W399 · Q4 | library |
| 3161 | [Block Placement Queries](https://leetcode.com/problems/block-placement-queries/) | Hard | 2513 | B131 · Q4 | library |

#### Sparse Table

| # | Problem | Difficulty | Rating | Contest | Have it? |
|---:|---|---|---:|---|---|
| — | Range Minimum Query | Hard | — | — | not on LeetCode · CSES / SPOJ |
| — | Catapult that ball | Hard | — | — | not on LeetCode · Codeforces |
| — | Miraculous | Hard | — | — | not on LeetCode · Codeforces |
| — | Negative Score | Hard | — | — | not on LeetCode · Codeforces |
| — | DIFERENCIJA | Hard | — | — | not on LeetCode · COCI |
| 1521 | [Find a Value of a Mysterious Function Closest to Target](https://leetcode.com/problems/find-a-value-of-a-mysterious-function-closest-to-target/) | Hard | 2384 | W198 · Q4 | library |
| 654 | [Maximum Binary Tree](https://leetcode.com/problems/maximum-binary-tree/) | Medium | — | — | **NEW** |

---

## Appendix A — the 159 genuinely new problems

These are in neither the 539 nor the contest library. They are the only additions integration
actually requires; everything else the sheet names, this repository already tracks.

**Grouped by topic**, because that is the order you would actually add them in. A problem the
sheet lists under two topics appears under the first one here.

### 2 Pointers — 5 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | Two Pointer on Arrays |
| 11 | [Container With Most Water](https://leetcode.com/problems/container-with-most-water/) | Medium | Two Pointer on Arrays |
| 16 | [3Sum Closest](https://leetcode.com/problems/3sum-closest/) | Medium | Two Pointer on Arrays |
| 18 | [4Sum](https://leetcode.com/problems/4sum/) | Medium | Two Pointer on Arrays |
| 557 | [Reverse Words in a String III](https://leetcode.com/problems/reverse-words-in-a-string-iii/) | Easy | Two Pointer on Strings |

### Prefix Sum — 4 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 238 | [Product of Array Except Self](https://leetcode.com/problems/product-of-array-except-self/) | Medium | Prefix Sum |
| 304 | [Range Sum Query 2D - Immutable](https://leetcode.com/problems/range-sum-query-2d-immutable/) | Medium | Prefix Sum |
| 391 | [Perfect Rectangle](https://leetcode.com/problems/perfect-rectangle/) | Hard | Line Sweep |
| 731 | [My Calendar II](https://leetcode.com/problems/my-calendar-ii/) | Medium | Line Sweep |

### Hashing — 9 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 169 | [Majority Element](https://leetcode.com/problems/majority-element/) | Easy | Implementary Problems |
| 217 | [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/) | Easy | Implementary Problems |
| 229 | [Majority Element II](https://leetcode.com/problems/majority-element-ii/) | Medium | Implementary Problems |
| 423 | [Reconstruct Original Digits from English](https://leetcode.com/problems/reconstruct-original-digits-from-english/) | Medium | Implementary Problems |
| 442 | [Find All Duplicates in an Array](https://leetcode.com/problems/find-all-duplicates-in-an-array/) | Medium | Implementary Problems |
| 451 | [Sort Characters by Frequency](https://leetcode.com/problems/sort-characters-by-frequency/) | Medium | Implementary Problems |
| 454 | [4Sum II](https://leetcode.com/problems/4sum-ii/) | Medium | Implementary Problems |
| 554 | [Brick Wall](https://leetcode.com/problems/brick-wall/) | Medium | Implementary Problems |
| 575 | [Distribute Candies](https://leetcode.com/problems/distribute-candies/) | Easy | Implementary Problems |

### Sliding Window — 1 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 689 | [Maximum Sum of 3 Non-Overlapping Subarrays](https://leetcode.com/problems/maximum-sum-of-3-non-overlapping-subarrays/) | Hard | Fixed Size Sliding-Window |

### Linked List — 5 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 21 | [Merge Two Sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/) | Easy | Linked List (Part 1) |
| 138 | [Copy List with Random Pointer](https://leetcode.com/problems/copy-list-with-random-pointer/) | Medium | Linked List (Part 1) |
| 142 | [Linked List Cycle II](https://leetcode.com/problems/linked-list-cycle-ii/) | Medium | Linked List (Part 1) |
| 148 | [Sort List](https://leetcode.com/problems/sort-list/) | Medium | Linked List (Part 1) |
| 382 | [Linked List Random Node](https://leetcode.com/problems/linked-list-random-node/) | Medium | Linked List (Part 1) |

### Stack — 8 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 42 | [Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/) | Hard | Monotonic Stack |
| 84 | [Largest Rectangle in Histogram](https://leetcode.com/problems/largest-rectangle-in-histogram/) | Hard | Monotonic Stack |
| 150 | [Evaluate Reverse Polish Notation](https://leetcode.com/problems/evaluate-reverse-polish-notation/) | Medium | Advance Stack Problems |
| 456 | [132 Pattern](https://leetcode.com/problems/132-pattern/) | Medium | Monotonic Stack |
| 503 | [Next Greater Element II](https://leetcode.com/problems/next-greater-element-ii/) | Medium | Monotonic Stack |
| 581 | [Shortest Unsorted Continuous Subarray](https://leetcode.com/problems/shortest-unsorted-continuous-subarray/) | Medium | Monotonic Stack |
| 726 | [Number of atoms](https://leetcode.com/problems/number-of-atoms/) | Hard | Advance Stack Problems |
| 735 | [Asteroid Collision](https://leetcode.com/problems/asteroid-collision/) | Medium | Advance Stack Problems |

### Queue — 4 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 225 | [Implement Stack using Queues](https://leetcode.com/problems/implement-stack-using-queues/) | Easy | Implementation Problems |
| 622 | [Design Circular Queue](https://leetcode.com/problems/design-circular-queue/) | Medium | Implementation Problems |
| 641 | [Design Circular Deque](https://leetcode.com/problems/design-circular-deque/) | Medium | Doubly-Ended Queue |
| 649 | [Dota2 Senate](https://leetcode.com/problems/dota2-senate/) | Medium | Singly-Ended Queue |

### Binary Search — 11 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 4 | [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/) | Hard | Binary Search On Answer |
| 74 | [Search a 2D Matrix](https://leetcode.com/problems/search-a-2d-matrix/) | Medium | Search on Matrix |
| 153 | [Find Minimum in Rotated Sorted Array](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) | Medium | Binary Search on Semi-Sorted Space |
| 240 | [Search a 2D Matrix II](https://leetcode.com/problems/search-a-2d-matrix-ii/) | Medium | Search on Matrix |
| 275 | [H-Index II](https://leetcode.com/problems/h-index-ii/) | Medium | Introductory Problems |
| 374 | [Guess Number Higher or Lower](https://leetcode.com/problems/guess-number-higher-or-lower/) | Easy | Introductory Problems |
| 441 | [Arranging Coins](https://leetcode.com/problems/arranging-coins/) | Easy | Upper Bound and Lower Bound |
| 475 | [Heaters](https://leetcode.com/problems/heaters/) | Medium | Binary Search On Answer |
| 528 | [Random Pick with Weight](https://leetcode.com/problems/random-pick-with-weight/) | Medium | Upper Bound and Lower Bound |
| 744 | [Find Smallest Letter Greater Than Target](https://leetcode.com/problems/find-smallest-letter-greater-than-target/) | Easy | Upper Bound and Lower Bound |
| 1901 | [Find a Peak Element II](https://leetcode.com/problems/find-a-peak-element-ii/) | Medium | Binary Search on Semi-Sorted Space |

### Bit Manipulation — 11 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 29 | [Divide Two Integers](https://leetcode.com/problems/divide-two-integers/) | Medium | Basic Bit Concepts |
| 67 | [Add Binary](https://leetcode.com/problems/add-binary/) | Easy | Basic Bit Concepts |
| 89 | [Gray Code](https://leetcode.com/problems/gray-code/) | Medium | Bitwise XOR operator |
| 191 | [Number of 1 Bits](https://leetcode.com/problems/number-of-1-bits/) | Easy | Basic Bit Concepts |
| 201 | [Bitwise AND of Numbers Range](https://leetcode.com/problems/bitwise-and-of-numbers-range/) | Medium | Bitwise AND operator |
| 260 | [Single Number III](https://leetcode.com/problems/single-number-iii/) | Medium | Bitwise XOR operator |
| 342 | [Power of Four](https://leetcode.com/problems/power-of-four/) | Easy | Basic Bit Concepts |
| 371 | [Sum of Two Integers](https://leetcode.com/problems/sum-of-two-integers/) | Medium | Bitwise XOR operator |
| 393 | [UTF-8 Validation](https://leetcode.com/problems/utf-8-validation/) | Medium | Basic Bit Concepts |
| 476 | [Number Complement](https://leetcode.com/problems/number-complement/) | Easy | Basic Bit Concepts |
| 477 | [Total Hamming Distance](https://leetcode.com/problems/total-hamming-distance/) | Medium | Basic Bit Concepts |

### Recursion & Backtracking — 8 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 40 | [Combination Sum II](https://leetcode.com/problems/combination-sum-ii/) | Medium | Combination Problems |
| 60 | [Permutation Sequence](https://leetcode.com/problems/permutation-sequence/) | Hard | Recursion Problems |
| 216 | [Combination Sum III](https://leetcode.com/problems/combination-sum-iii/) | Medium | Combination Problems |
| 241 | [Different Ways to Add Parentheses](https://leetcode.com/problems/different-ways-to-add-parentheses/) | Medium | Recursion Problems |
| 486 | [Predict the Winner](https://leetcode.com/problems/predict-the-winner/) | Medium | Recursion Problems |
| 491 | [Non-Decreasing Subsequences](https://leetcode.com/problems/non-decreasing-subsequences/) | Medium | Subsets Problems |
| 494 | [Target Sum](https://leetcode.com/problems/target-sum/) | Medium | Combination Problems |
| 526 | [Beautiful Arrangement](https://leetcode.com/problems/beautiful-arrangement/) | Medium | Permutation Problems |

### Binary Tree — 16 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 94 | [Binary Tree Inorder Traversal](https://leetcode.com/problems/binary-tree-inorder-traversal/) | Easy | Traversals |
| 100 | [Same Tree](https://leetcode.com/problems/same-tree/) | Easy | Two tree Validation |
| 106 | [Construct Binary Tree from Inorder and Postorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-inorder-and-postorder-traversal/) | Medium | Construction of Tree |
| 107 | [Binary Tree Level Order Traversal II](https://leetcode.com/problems/binary-tree-level-order-traversal-ii/) | Medium | Level Order Traversal |
| 110 | [Balanced Binary Tree](https://leetcode.com/problems/balanced-binary-tree/) | Easy | Properties of trees |
| 111 | [Minimum Depth of Binary Tree](https://leetcode.com/problems/minimum-depth-of-binary-tree/) | Easy | Properties of trees |
| 113 | [Path Sum II](https://leetcode.com/problems/path-sum-ii/) | Medium | Binary Tree Path |
| 129 | [Sum Root to Leaf Numbers](https://leetcode.com/problems/sum-root-to-leaf-numbers/) | Medium | Binary Tree Path |
| 145 | [Binary Tree Postorder Traversal](https://leetcode.com/problems/binary-tree-postorder-traversal/) | Easy | Traversals |
| 222 | [Count Complete Tree Nodes](https://leetcode.com/problems/count-complete-tree-nodes/) | Medium | Properties of trees |
| 437 | [Path Sum III](https://leetcode.com/problems/path-sum-iii/) | Medium | Binary Tree Path |
| 559 | [Maximum Depth of N-ary Tree](https://leetcode.com/problems/maximum-depth-of-n-ary-tree/) | Easy | N-ary Tree |
| 572 | [Subtree of Another Tree](https://leetcode.com/problems/subtree-of-another-tree/) | Easy | Two tree Validation |
| 589 | [N-ary Tree Preorder Traversal](https://leetcode.com/problems/n-ary-tree-preorder-traversal/) | Easy | N-ary Tree |
| 590 | [N-ary Tree Postorder Traversal](https://leetcode.com/problems/n-ary-tree-postorder-traversal/) | Easy | N-ary Tree |
| 617 | [Merge Two Binary Trees](https://leetcode.com/problems/merge-two-binary-trees/) | Easy | Two tree Validation |

### Binary Search Tree — 12 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 96 | [Unique Binary Search Trees](https://leetcode.com/problems/unique-binary-search-trees/) | Medium | Validation and Property |
| 99 | [Recover Binary Search Tree](https://leetcode.com/problems/recover-binary-search-tree/) | Medium | Validation and Property |
| 109 | [Convert Sorted List to Binary Search Tree](https://leetcode.com/problems/convert-sorted-list-to-binary-search-tree/) | Medium | Construction of BST |
| 173 | [Binary Search Tree Iterator](https://leetcode.com/problems/binary-search-tree-iterator/) | Medium | Validation and Property |
| 235 | [Lowest Common Ancestor of a Binary Search Tree](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/) | Medium | Validation and Property |
| 449 | [Serialize and Deserialize BST](https://leetcode.com/problems/serialize-and-deserialize-bst/) | Medium | Construction of BST |
| 450 | [Delete Node in a BST](https://leetcode.com/problems/delete-node-in-a-bst/) | Medium | Basic Operations |
| 501 | [Find Mode in Binary Search Tree](https://leetcode.com/problems/find-mode-in-binary-search-tree/) | Easy | Validation and Property |
| 538 | [Convert BST to Greater Tree](https://leetcode.com/problems/convert-bst-to-greater-tree/) | Medium | Construction of BST |
| 669 | [Trim a Binary Search Tree](https://leetcode.com/problems/trim-a-binary-search-tree/) | Medium | Construction of BST |
| 700 | [Search in a Binary Search Tree](https://leetcode.com/problems/search-in-a-binary-search-tree/) | Easy | Basic Operations |
| 701 | [Insert into a Binary Search Tree](https://leetcode.com/problems/insert-into-a-binary-search-tree/) | Medium | Basic Operations |

### Heap (Priority Queue) — 3 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 264 | [Ugly Number II](https://leetcode.com/problems/ugly-number-ii/) | Medium | Kth Pattern Problems |
| 407 | [Trapping Rain Water II](https://leetcode.com/problems/trapping-rain-water-ii/) | Hard | Implementary Questions |
| 506 | [Relative Ranks](https://leetcode.com/problems/relative-ranks/) | Easy | Implementary Questions |

### Tries — 4 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 421 | [Maximum XOR of Two Numbers in an Array](https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/) | Medium | Trie with Bit Manipulation |
| 676 | [Implement Magic Dictionary](https://leetcode.com/problems/implement-magic-dictionary/) | Medium | Trie involving String |
| 720 | [Longest Word in Dictionary](https://leetcode.com/problems/longest-word-in-dictionary/) | Medium | Trie involving String |
| 745 | [Prefix and Suffix Search](https://leetcode.com/problems/prefix-and-suffix-search/) | Hard | Trie involving String |

### Greedy — 5 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 330 | [Patching Array](https://leetcode.com/problems/patching-array/) | Hard | Part I |
| 376 | [Wiggle Subsequence](https://leetcode.com/problems/wiggle-subsequence/) | Medium | Part I |
| 406 | [Queue Reconstruction by Height](https://leetcode.com/problems/queue-reconstruction-by-height/) | Medium | Part II |
| 435 | [Non-Overlapping Intervals](https://leetcode.com/problems/non-overlapping-intervals/) | Medium | Part I |
| 517 | [Super Washing Machines](https://leetcode.com/problems/super-washing-machines/) | Hard | Part I |

### Dynamic Programming Level 1 — 33 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 5 | [Longest Palindromic Substring](https://leetcode.com/problems/longest-palindromic-substring/) | Medium | Longest Common Subsequence |
| 53 | [Maximum Subarray](https://leetcode.com/problems/maximum-subarray/) | Medium | Kadane Algo |
| 62 | [Unique Paths](https://leetcode.com/problems/unique-paths/) | Medium | DP On Grid |
| 63 | [Unique Paths II](https://leetcode.com/problems/unique-paths-ii/) | Medium | DP On Grid |
| 132 | [Palindrome Partitioning II](https://leetcode.com/problems/palindrome-partitioning-ii/) | Hard | Matrix Chain Multiplication |
| 188 | [Best Time to Buy and Sell Stock IV](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iv/) | Hard | 2 Dimensional DP |
| 198 | [House Robber](https://leetcode.com/problems/house-robber/) | Medium | Linear DP |
| 300 | [Longest Increasing Subsequence](https://leetcode.com/problems/longest-increasing-subsequence/) | Medium | Longest Increasing Subsequence |
| 309 | [Best Time to Buy and Sell Stock with Cooldown](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/) | Medium | 2 Dimensional DP |
| 363 | [Max Sum of Rectangle No Larger Than K](https://leetcode.com/problems/max-sum-of-rectangle-no-larger-than-k/) | Hard | Cummulative Sum |
| 368 | [Largest Divisible Subset](https://leetcode.com/problems/largest-divisible-subset/) | Medium | Longest Increasing Subsequence |
| 375 | [Guess Number Higher or Lower II](https://leetcode.com/problems/guess-number-higher-or-lower-ii/) | Medium | Matrix Chain Multiplication |
| 377 | [Combination Sum IV](https://leetcode.com/problems/combination-sum-iv/) | Medium | 2 Dimensional DP |
| 413 | [Arithmetic Slices](https://leetcode.com/problems/arithmetic-slices/) | Medium | Linear DP |
| 467 | [Unique Substrings in Wraparound String](https://leetcode.com/problems/unique-substrings-in-wraparound-string/) | Medium | DP on String |
| 472 | [Concatenated Words](https://leetcode.com/problems/concatenated-words/) | Hard | DP on String |
| 474 | [Ones and Zeroes](https://leetcode.com/problems/ones-and-zeroes/) | Medium | Knapsack DP |
| 516 | [Longest Palindromic Subsequence](https://leetcode.com/problems/longest-palindromic-subsequence/) | Medium | Longest Common Subsequence |
| 518 | [Coin Change II](https://leetcode.com/problems/coin-change-ii/) | Medium | 2 Dimensional DP |
| 546 | [Remove Boxes](https://leetcode.com/problems/remove-boxes/) | Hard | Matrix Chain Multiplication |
| 552 | [Student Attendance Record Leetcode](https://leetcode.com/problems/student-attendance-record-ii/) | Hard | 2 Dimensional DP |
| 576 | [Out of Boundary Paths](https://leetcode.com/problems/out-of-boundary-paths/) | Medium | DP On Grid |
| 583 | [Delete operation for two strings](https://leetcode.com/problems/delete-operation-for-two-strings/) | Medium | Longest Common Subsequence |
| 629 | [K Inverse Pairs Array](https://leetcode.com/problems/k-inverse-pairs-array/) | Hard | 2 Dimensional DP |
| 638 | [Shopping Offers](https://leetcode.com/problems/shopping-offers/) | Medium | Knapsack DP |
| 646 | [Maximum Length of Pair Chain](https://leetcode.com/problems/maximum-length-of-pair-chain/) | Medium | Longest Increasing Subsequence |
| 650 | [2 Keys Keyboard](https://leetcode.com/problems/2-keys-keyboard/) | Medium | Knapsack DP |
| 664 | [Strange Printer](https://leetcode.com/problems/strange-printer/) | Hard | Matrix Chain Multiplication |
| 712 | [Minimum ASCII Delete Sum for Two Strings](https://leetcode.com/problems/minimum-ascii-delete-sum-for-two-strings/) | Medium | DP on String |
| 714 | [Best Time to Buy and Sell Stock with Transaction Fee](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-transaction-fee/) | Medium | 2 Dimensional DP |
| 718 | [Maximum Length of Repeated Subarray](https://leetcode.com/problems/maximum-length-of-repeated-subarray/) | Medium | Longest Common Subsequence |
| 730 | [Count Different Palindromic Subsequences](https://leetcode.com/problems/count-different-palindromic-subsequences/) | Hard | DP on String |
| 740 | [Delete and Earn](https://leetcode.com/problems/delete-and-earn/) | Medium | Linear DP |

### Graphs — 5 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 130 | [Surrounded Regions](https://leetcode.com/problems/surrounded-regions/) | Medium | Multi Source BFS |
| 310 | [Minimum Height Trees](https://leetcode.com/problems/minimum-height-trees/) | Medium | Topological Sort |
| 419 | [Battleships in a Board](https://leetcode.com/problems/battleships-in-a-board/) | Medium | Flood Fill |
| 547 | [Number of Provinces](https://leetcode.com/problems/number-of-provinces/) | Medium | DFS and BFS on Graphs |
| 685 | [Redundant Connection II](https://leetcode.com/problems/redundant-connection-ii/) | Hard | Disjoint Set Union |

### Combinatorics & Geometry — 2 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 478 | [Generate Random Point in a Circle](https://leetcode.com/problems/generate-random-point-in-a-circle/) | Medium | Circle |
| 2505 | [Bitwise OR of All Subsequence Sums](https://leetcode.com/problems/bitwise-or-of-all-subsequence-sums/) | Medium | Combinatorics |

### Game Theory — 1 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 464 | [Can I Win](https://leetcode.com/problems/can-i-win/) | Medium | Level II |

### Dynamic Programming Level 2 — 7 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 233 | [Number of Digit One](https://leetcode.com/problems/number-of-digit-one/) | Hard | Digit DP |
| 357 | [Count Numbers with Unique Digits](https://leetcode.com/problems/count-numbers-with-unique-digits/) | Medium | DP with Math |
| 600 | [Non-negative Integers without Consecutive Ones](https://leetcode.com/problems/non-negative-integers-without-consecutive-ones/) | Hard | Digit DP |
| 688 | [Knight Probability in Chessboard](https://leetcode.com/problems/knight-probability-in-chessboard/) | Medium | Dp with Probability |
| 691 | [Stickers to Spell Word](https://leetcode.com/problems/stickers-to-spell-word/) | Hard | DP with Bitmask |
| 698 | [Partition to K Equal Sum Subsets](https://leetcode.com/problems/partition-to-k-equal-sum-subsets/) | Medium | DP with Bitmask |
| 1227 | [Airplane Seat Assignment Probability](https://leetcode.com/problems/airplane-seat-assignment-probability/) | Medium | Dp with Probability |

### String Matching Algos — 1 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 214 | [Shortest Palindrome](https://leetcode.com/problems/shortest-palindrome/) | Hard | Implementary Problems |

### Advance algorithm — 4 to add

| # | Problem | Difficulty | Sub-topic |
|---:|---|---|---|
| 307 | [Range Sum Query - Mutable](https://leetcode.com/problems/range-sum-query-mutable/) | Medium | Segment Tree |
| 327 | [Count of Range Sum](https://leetcode.com/problems/count-of-range-sum/) | Hard | Segment Tree |
| 654 | [Maximum Binary Tree](https://leetcode.com/problems/maximum-binary-tree/) | Medium | Sparse Table |
| 699 | [Falling Squares](https://leetcode.com/problems/falling-squares/) | Hard | Segment Tree |

## Appendix B — on the sheet, but not on LeetCode

Reported by platform rather than dropped. Several are classics worth doing; they simply cannot
carry a LeetCode id or link, and inventing one would be the exact failure this report avoids.

| Platform | Count | Problems |
|---|---:|---|
| AtCoder (DP contest) | 2 | Coins · Sushi |
| COCI | 1 | DIFERENCIJA |
| CSES | 18 | Company Queries I · Company Queries II · Counting Numbers · Counting Tilings · Cycle Finding · Distance Queries · Flight Discount · Grouping · High Score · Investigation · Matching · Road Construction · Round Trip · Shortest Route I · Subordinates · Tree Distances 1 · Tree Distances II · Tree Matching |
| CSES ("Dijkstra?") | 1 | Dijkstra? |
| CSES / SPOJ | 1 | Range Minimum Query |
| Codeforces | 26 | 01 Game · Card Game · Catapult that ball · Count the Arrays · Digit Game · Dinner With Emma · Even-Odd Game · Godsend · Greg and Array · Little Elephant and T-Shirts · Matrix Game · Miraculous · Negative Score · Palindrome Game · Ping-pong · PolandBall and Game · Pongal Bunk · Right Triangles · Sasha and Sticks · Sequential Game · String Mark · Substring Removal Game · Tiles · Valid BFS? · XOR Sequences · Yet Another String Game |
| GeeksforGeeks | 72 | Activity Selection · Add 1 to a Linked List Number · BFS in Graph · Burning Tree · Check If Two Line Segments Intersect · Check Odd or Even · Check if Subtree · Check if Tree is Isomorphic · Check if a Graph Has a Cycle of Odd Length · Children Sum in a Binary Tree · Construct BST from Postorder · Construct Binary Tree from Parent Array · Construct Binary Tree from String with Bracket Representation · Convert Min Heap to Max Heap · Count Total Set Bits · DFS Traversal · Decimal to Binary · Delete Middle Element of a Stack · Deque Implementations · Detect Cycle in a Directed Graph (GeeksforGeeks) · Detect Cycle in an Undirected Graph (GeeksforGeeks) · Does Array Represent Heap? · Factorial of Large Numbers · Find Common Nodes in two BSTs · Find Length of Loop · First Negative Integer in Every Window of Size K · First Non-Repeating Character in a Stream · Flattening a Linked List · Fractional Knapsack · Geek's Training · Get, Set, Clear ith Bit · Heap Sort · Implement Queue using Array · Implement Queue using Linked List · Implementation of Priority Queue using Binary Heap · Is Binary Tree Heap? · Job Sequencing Problem · Josephus Problem · Knapsack - 1 · Knapsack - 2 · Kth Bit is Set or Not · Left View of Binary Tree · Linked List to Binary Tree · Matrix Chain Multiplication · Max Sum Increasing Subsequence · Median in a Row-wise Sorted Matrix · Merge K Sorted Arrays · Minimum Platforms · Minimum Spanning Tree · Minimum XOR Value Pair · Mirror Tree · N-Queue using Array · Operations on Binary Min Heap · Preorder, Postorder, Inorder in a Single Traversal · Print all LCS sequences · Printing Longest Increasing Subsequence · Queue using Two Stacks · Rat in a Maze Problem · Remove Half Nodes · Reverse First K Elements of Queue · Rod Cutting · Rotation · Set the Rightmost Unset Bit · Sort a Linked List of 0s, 1s, and 2s · Sort a Stack · Swap Two Numbers (with Temp Variable) · Top View of Binary Tree · Tower of Hanoi · Trie Delete · Two Mirror Trees · Water Connection Problem · nCr Mod m |
| GeeksforGeeks (theory) | 1 | Count Common Subsequence in Two Strings |
| GeeksforGeeks / InterviewBit | 1 | Redundant Parenthesis |
| GeeksforGeeks / SPOJ | 1 | Aggressive Cows |
| Reference (C++ STL) | 1 | C++ STL (queue) |
| Theory | 8 | Articulation Points (or Cut Vertices) in a Graph · KMP Algorithm for Pattern Searching · Kruskal's Minimum Spanning Tree Algorithm - Greedy Algorithm · N-ary Tree · Prim's Minimum Spanning Tree (MST) - Greedy Algorithm · Rabin-Karp Algorithm for Pattern Searching · Strongly Connected Components · Z Algorithm (Linear-Time Pattern Searching Algorithm) |

## Appendix C — difficulty disagreements

On 27 rows the sheet's difficulty differs from LeetCode's official one. Neither is
necessarily "wrong" — a sheet author often grades by *how hard it is to see the idea* rather
than by LeetCode's label — but the disagreement is worth seeing, because it is also how a
mis-resolution would show itself.

| # | Problem | Sheet | LeetCode | Topic |
|---:|---|---|---|---|
| 1476 | [Subrectangle Queries](https://leetcode.com/problems/subrectangle-queries/) | Easy | Medium | Matrix |
| 328 | [Odd Even Linked List](https://leetcode.com/problems/odd-even-linked-list/) | Easy | Medium | Linked List |
| 410 | [Split Array Largest Sum](https://leetcode.com/problems/split-array-largest-sum/) | Medium | Hard | Binary Search |
| 2141 | [Maximum Running Time of N Computers](https://leetcode.com/problems/maximum-running-time-of-n-computers/) | Medium | Hard | Binary Search |
| 378 | [Kth Smallest Element in a Sorted Matrix](https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/) | Hard | Medium | Binary Search |
| 393 | [UTF-8 Validation](https://leetcode.com/problems/utf-8-validation/) | Easy | Medium | Bit Manipulation |
| 1734 | [Decode Xored Permutation](https://leetcode.com/problems/decode-xored-permutation/) | Easy | Medium | Bit Manipulation |
| 1922 | [Count Good Numbers](https://leetcode.com/problems/count-good-numbers/) | Easy | Medium | Recursion & Backtracking |
| 222 | [Count Complete Tree Nodes](https://leetcode.com/problems/count-complete-tree-nodes/) | Easy | Medium | Binary Tree |
| 199 | [Binary Tree Right Side View](https://leetcode.com/problems/binary-tree-right-side-view/) | Easy | Medium | Binary Tree |
| 373 | [Find K Pairs with Smallest Sums](https://leetcode.com/problems/find-k-pairs-with-smallest-sums/) | Hard | Medium | Heap (Priority Queue) |
| 421 | [Maximum XOR of Two Numbers in an Array](https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/) | Hard | Medium | Tries |
| 14 | [Longest Common Prefix](https://leetcode.com/problems/longest-common-prefix/) | Medium | Easy | Tries |
| 1233 | [Remove Sub-Folders from the Filesystem](https://leetcode.com/problems/remove-sub-folders-from-the-filesystem/) | Hard | Medium | Tries |
| 1948 | [Delete Duplicate Folders in System](https://leetcode.com/problems/delete-duplicate-folders-in-system/) | Medium | Hard | Tries |
| 1223 | [Dice Roll Simulation](https://leetcode.com/problems/dice-roll-simulation/) | Medium | Hard | Dynamic Programming Level 1 |
| 2930 | [Number of Strings Which Can Be Rearranged to Contain Substring](https://leetcode.com/problems/number-of-strings-which-can-be-rearranged-to-contain-substring/) | Hard | Medium | Dynamic Programming Level 1 |
| 122 | [Best Time to Buy and Sell Stock II](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-ii/) | Hard | Medium | Dynamic Programming Level 1 |
| 3196 | [Maximize Total Cost of Alternating Subarrays](https://leetcode.com/problems/maximize-total-cost-of-alternating-subarrays/) | Hard | Medium | Dynamic Programming Level 1 |
| 646 | [Maximum Length of Pair Chain](https://leetcode.com/problems/maximum-length-of-pair-chain/) | Hard | Medium | Dynamic Programming Level 1 |
| 912 | [Sort an Array](https://leetcode.com/problems/sort-an-array/) | Hard | Medium | Dynamic Programming Level 1 |
| 2115 | [Find All Possible Recipes from Given Supplies](https://leetcode.com/problems/find-all-possible-recipes-from-given-supplies/) | Hard | Medium | Graphs |
| 1584 | [Min Cost to Connect All Points](https://leetcode.com/problems/min-cost-to-connect-all-points/) | Hard | Medium | Graphs |
| 1192 | [Critical Connections in a Network](https://leetcode.com/problems/critical-connections-in-a-network/) | Medium | Hard | Graphs |
| 2481 | [Minimum Cuts to Divide a Circle](https://leetcode.com/problems/minimum-cuts-to-divide-a-circle/) | Medium | Easy | Combinatorics & Geometry |
| 2505 | [Bitwise OR of All Subsequence Sums](https://leetcode.com/problems/bitwise-or-of-all-subsequence-sums/) | Hard | Medium | Combinatorics & Geometry |
| 3245 | [Alternating Groups III](https://leetcode.com/problems/alternating-groups-iii/) | Medium | Hard | Advance algorithm |

## Appendix D — ambiguous

- **Beautiful Numbers** *(Combinatorics & Geometry / Combinatorics, sheet says Hard)* — Could be LeetCode 3490 "Count Beautiful Numbers" (Hard), or the Codeforces problem of this exact name — its neighbours in this subtopic (Tiles, Right Triangles, Count the Arrays, String Mark) are all Codeforces.

Left unresolved on purpose. Tell me which one you meant and it becomes a one-line alias.

## Appendix E — transcription note

The sheet was transcribed by hand from the message you sent, into
`scripts/data/revision-sheet.txt`, preserving your spelling and ordering exactly (including
`Robot Collisons` and `Insert Intervals`, which are corrected in the resolver's alias table
rather than in the transcript). Two things to know:

- **The paste ended mid-row.** The final entry under *Advance algorithm → Sparse Table* is
  `Maximum Binary Tree` with no difficulty. It resolved to LeetCode 654, but if your sheet has
  more rows after it, they are not here.
- **Rows repeat by design.** 1,210 rows resolve to 1,016 unique problems because the sheet
  deliberately lists some problems under several patterns (Sliding Window Maximum appears under
  both a fixed-size window and a deque, for instance). That repetition is signal, not noise —
  it is exactly what makes a problem worth revising — and the integration plan preserves it.

---

## What to do with this — the integration plan in one page

The full plan is `docs/superpowers/specs/2026-08-20-revision-sheet-design.md`. The short form:

**This sheet does not become a third question universe.** 84% of it is already here, so it
becomes a *lens* — a topic-wise ordering over problems the repo already tracks — plus the 159
additions in Appendix A. No third progress register, no second scheduler, no second scorer.

| | |
|---|---|
| **Where progress lives** | Curriculum rows keep their record in `progress.byId`. Everything else (library rows *and* the 159) uses the existing slug-keyed register, which needs no schema change to accept them. |
| **Your no-repeat rule** | Enforced *by construction*: membership is known when the dataset is generated, so a revision draw excludes roadmap-backed rows by default — visibly and reversibly, never silently. |
| **New surfaces** | A `/sheet` index, and a fifth mode on the existing Revision mode selector. A timed set reuses the contest path that already exists. |
| **Cost** | ~2.5–3 days across four slices, after V13 slice 7. |

Two things are flagged in the plan rather than left to be discovered late: `/sheet` would be
the **17th nav destination**, and 16 is what currently fits a 590px rail — so that gets
resolved before the route is built, not after. And the 134 non-LeetCode rows get **listed with
their platform named and nothing linked**, because a fabricated link is precisely the failure
this report exists to prevent.

Three questions in the plan need your answer before slice S1 — XP for sheet-only solves, what
to do with the non-LeetCode rows, and the one ambiguous title.

## Data model — how a row references its problem

The shipped dataset (`src/data/revisionSheet.json`, decoded by `src/data/revisionSheet.ts`) is
a list of **references**, one per row: a `curriculum` row carries a question id into the 539, a
`library` row carries a slug into the 2,561, and only a `sheet` row — one of the additions —
carries its own metadata, because it exists nowhere else. External and ambiguous rows carry no
identity at all. Progress for every non-curriculum row lives in the existing slug-keyed
register (`contestLibrary.bySlug`), on the one 1/3/7/15/30 ladder; curriculum rows keep their
one record in `progress.byId`. One problem, one identity, never a second copy — the design is
`docs/superpowers/specs/2026-08-20-revision-sheet-design.md`.

## Validation — what `validate:data` now enforces

The offline gate re-checks the shipped artifact independently of the generator that wrote it:
index bounds and kind codes; every curriculum id exists in `questions.json`; every library slug
exists in the contest library; **every sheet-only slug exists in NEITHER universe** (a roadmap
problem may never ship as a sheet addition); slug shape, positive frontend ids, non-blank
titles/platforms/notes; exactly nine columns per sheet-only row, so an invented rating field
fails loudly; and the library's mapping-honesty rules (unmapped claims nothing, heuristic
never filters).

## Known limitations

- **3 premium rows** link correctly but need a LeetCode subscription to open.
- **The ambiguous row** (Appendix D) stays unresolved until the user says which problem it is.
- **Today's rail block** is titled "Practice reviews" and covers both pools, but the setting
  that gates it keeps its original `contestOnToday` key and "Contest reviews on Today" label —
  a naming seam, recorded rather than migrated.
- **External rows are display-only**: platform named, nothing linked, nothing tracked. A
  verified-links table (master plan T1.13) can add hand-checked URLs; unlisted rows stay
  unlinked.

## Next steps

The integration itself is tracked in `docs/superpowers/plans/2026-08-20-revision-sheet-
integration.md` (V14 tasks, absorbed as Phase 1 of `docs/superpowers/plans/2026-08-20-master-
plan-v15.md`). After Phase 1 the master plan continues into the capability reader, failure
routing, contextual revision, and the contest/interview deltas — the sheet is the data ground
those phases build on.
