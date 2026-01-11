# Assessment Evaluation System

## 🏗 Architecture (Brief)
The system employs a **Hybrid Evaluation Engine** built on Node.js, processing submissions through two parallel pipelines to ensure both visual fidelity and code quality:

1.  **Visual Pipeline (Puppeteer)**: Renders the user's code in a headless Chrome browser to capture high-fidelity screenshots, exactly as a user would see them.
2.  **Structural Pipeline (JSDOM)**: Parses the raw HTML/CSS into a Virtual DOM for deep static analysis, checking for specific attributes, hierarchy, and semantic correctness.

The results from these independent pipelines are normalized and aggregated into a final percentage score.

---

## 🧮 DOM Analysis Algorithms

The structural evaluation relies on advanced DOM traversal and heuristic matching techniques:

### 1. Virtual DOM Construction
We use **JSDOM** to tokenize the user's HTML string and construct a queryable DOM tree in memory. This allows us to use standard Web APIs (like `querySelector` and `getAttribute`) on the server side without the overhead of a graphical browser.

### 2. Heuristic Node Matching
Instead of brittle exact matches, we use a flexible matching algorithm to identify components:
*   **Signature Matching**: Elements are identified by a composite signature of their Tag Name, Class List, and ID.
*   **Fuzzy Text Matching**: We utilize the **Levenshtein Distance** algorithm to calculate string similarity. This allows the system to recognize correct content even with minor typos (e.g., treating "Add to Crat" as a match for "Add to Cart" with a penalty).
*   **Attribute Validation**: Critical accessibility attributes (like `alt`, `role`, `aria-label`) are validated for existence and meaningful content.

### 3. Visual Diffing Algorithm
For the visual score, we employ a pixel-by-pixel comparison using **Pixelmatch**:
*   **Overlay & Diff**: The user's screenshot is overlaid on the "Golden Master" (expected output).
*   **Anti-Aliasing Detection**: The algorithm detects and ignores dynamic anti-aliasing pixels to prevent false negatives caused by font rendering differences.
*   **Thresholding**: A sensitivity threshold (typically 0.1) is applied to ignore imperceptible color shifts.

---

## 🛠 Toolchain Deep Dive

### Puppeteer (Headless Chrome)
*   **Role**: Visual Rendering Agent.
*   **Why**: JSDOM cannot calculate computed styles (like final layout positions) accurately. Puppeteer gives us the "ground truth" of how the code renders. It handles external resources, fonts, and complex CSS layouts (Flexbox/Grid).

### JSDOM (JavaScript DOM)
*   **Role**: Static Structure Analyzer.
*   **Why**: It provides a lightweight, spec-compliant environment to inspect proper HTML semantics. It is significantly faster than Puppeteer for checking simple logic like "does an input exist?".

### Pixelmatch & PNGJS
*   **Role**: Visual Regression Engine.
*   **Why**: Fast, binary-level image comparison. It generates a "Diff Image" where mismatching pixels are highlighted in Red, providing instant visual feedback to the user on where their design deviated.

### Levenshtein (String Similarity)
*   **Role**: Text Tolerance Engine.
*   **Why**: Prevents students from failing an entire test due to a single typo. It quantifies the "edit distance" between two strings, allowing us to set tolerance thresholds (e.g., 90% matching is a pass).
