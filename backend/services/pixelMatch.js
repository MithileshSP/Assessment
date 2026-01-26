/**
 * Pixel Matching Service
 * Uses Puppeteer to render HTML and capture screenshots
 * Performs pixel-by-pixel comparison using pixelmatch library
 */

const puppeteer = require('puppeteer');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const fs = require('fs');
const path = require('path');

class PixelMatcher {
  constructor() {
    this.screenshotDir = path.join(__dirname, '../screenshots');
    this.browser = null;
  }

  /**
   * Initialize browser instance (reuse for performance)
   */
  async initBrowser() {
    if (!this.browser) {
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Overcome limited resource problems in Docker
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions'
        ],
        timeout: 30000 // 30 second launch timeout
      });
    }
    return this.browser;
  }

  /**
   * Close browser
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Main comparison function
   * @param {Object} candidateCode - { html, css, js }
   * @param {Object} expectedCode - { html, css, js }
   * @param {string} submissionId - Unique ID for screenshot naming
   * @returns {Object} - Comparison result with score
   */
  async compare(candidateCode, expectedCode, submissionId) {
    let browser = null;

    try {
      browser = await this.initBrowser();

      // Create full HTML pages
      const candidatePage = this.createFullPage(candidateCode);
      const expectedPage = this.createFullPage(expectedCode);

      // Take screenshots
      const candidateScreenshot = await this.captureScreenshot(
        browser,
        candidatePage,
        `${submissionId}-candidate`
      );

      const expectedScreenshot = await this.captureScreenshot(
        browser,
        expectedPage,
        `${submissionId}-expected`
      );

      // Compare screenshots
      const comparisonResult = await this.compareImages(
        candidateScreenshot,
        expectedScreenshot,
        submissionId
      );

      return {
        score: comparisonResult.score,
        passed: comparisonResult.score >= 80, // Default threshold
        diffPixels: comparisonResult.diffPixels,
        totalPixels: comparisonResult.totalPixels,
        diffPercentage: comparisonResult.diffPercentage,
        screenshots: {
          candidate: `/screenshots/${submissionId}-candidate.png`,
          expected: `/screenshots/${submissionId}-expected.png`,
          diff: `/screenshots/${submissionId}-diff.png`
        }
      };

    } catch (error) {
      console.error('Pixel matching error:', error);
      return {
        score: 0,
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Create full HTML page with CSS and JS injected
   * @param {Object} code - { html, css, js }
   * @returns {string} - Complete HTML page
   */
  createFullPage(code) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Render</title>
        <style>
          /* Reset for consistency */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          /* User CSS */
          ${code.css || ''}
        </style>
      </head>
      <body>
        ${code.html || ''}
        
        <script>
          try {
            ${code.js || ''}
          } catch (e) {
            console.error('JS execution error:', e);
          }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Capture screenshot of HTML page
   * @param {Browser} browser - Puppeteer browser instance
   * @param {string} htmlContent - Full HTML content
   * @param {string} filename - Screenshot filename
   * @returns {string} - Path to screenshot
   */
  async captureScreenshot(browser, htmlContent, filename) {
    const page = await browser.newPage();

    try {
      // Set consistent viewport
      await page.setViewport({
        width: 1280,
        height: 720,
        deviceScaleFactor: 1
      });

      // Set content and wait for rendering
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded', // Faster than 'load'
        timeout: 30000 // 30 second timeout (increased for Docker)
      });

      // Wait a bit for any animations or dynamic content
      await new Promise(r => setTimeout(r, 500));

      // Capture screenshot
      const screenshotPath = path.join(this.screenshotDir, `${filename}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false // Use viewport size for consistency
      });

      return screenshotPath;

    } finally {
      await page.close();
    }
  }

  /**
   * Compare two PNG images pixel by pixel
   * @param {string} candidatePath - Path to candidate screenshot
   * @param {string} expectedPath - Path to expected screenshot
   * @param {string} submissionId - ID for diff image
   * @returns {Object} - Comparison metrics
   */
  async compareImages(candidatePath, expectedPath, submissionId) {
    try {
      // Read images
      const candidateImg = PNG.sync.read(fs.readFileSync(candidatePath));
      const expectedImg = PNG.sync.read(fs.readFileSync(expectedPath));

      const { width, height } = expectedImg;

      // Ensure images are same size (resize candidate if needed)
      let candidateData = candidateImg.data;
      if (candidateImg.width !== width || candidateImg.height !== height) {
        console.warn('Image size mismatch, using expected dimensions');
        // In production, you'd resize the image properly
        // For prototype, we'll proceed with size difference noted
      }

      // Create diff image
      const diff = new PNG({ width, height });

      // Perform pixel comparison
      const diffPixels = pixelmatch(
        candidateImg.data,
        expectedImg.data,
        diff.data,
        width,
        height,
        {
          threshold: 0.1, // Sensitivity (0-1, lower = more strict)
          alpha: 0.1,
          diffColor: [255, 0, 0], // Red for differences
          diffColorAlt: [0, 255, 0] // Green for matches (optional)
        }
      );

      // Save diff image
      const diffPath = path.join(this.screenshotDir, `${submissionId}-diff.png`);
      fs.writeFileSync(diffPath, PNG.sync.write(diff));

      // 1. Detection of "Blank" or "Solid" page (Variance check)
      const isSolidColor = (data) => {
        let firstR = data[0], firstG = data[1], firstB = data[2];
        for (let i = 4; i < data.length; i += 4) {
          if (Math.abs(data[i] - firstR) > 5 || Math.abs(data[i + 1] - firstG) > 5 || Math.abs(data[i + 2] - firstB) > 5) return false;
        }
        return true;
      };

      const candidateIsBlank = isSolidColor(candidateImg.data);
      const expectedIsBlank = isSolidColor(expectedImg.data);

      // 2. Weighted Calculation
      let contentMatch = 0, contentTotal = 0;
      let bgMatch = 0, bgTotal = 0;

      // Sample background color from top-left pixel (assumed background)
      const bgR = expectedImg.data[0], bgG = expectedImg.data[1], bgB = expectedImg.data[2];

      for (let i = 0; i < expectedImg.data.length; i += 4) {
        const isContent = Math.abs(expectedImg.data[i] - bgR) > 10 ||
          Math.abs(expectedImg.data[i + 1] - bgG) > 10 ||
          Math.abs(expectedImg.data[i + 2] - bgB) > 10;

        // Check if student pixel matches expected within threshold
        const matches = Math.abs(candidateImg.data[i] - expectedImg.data[i]) < 30 &&
          Math.abs(candidateImg.data[i + 1] - expectedImg.data[i + 1]) < 30 &&
          Math.abs(candidateImg.data[i + 2] - expectedImg.data[i + 2]) < 30;

        if (isContent) {
          contentTotal++;
          if (matches) contentMatch++;
        } else {
          bgTotal++;
          if (matches) bgMatch++;
        }
      }

      // Calculate weighted score: 90% Content area, 10% Background area
      let similarityScore = 0;
      if (contentTotal > 0) {
        const contentRatio = contentMatch / contentTotal;
        const bgRatio = bgTotal > 0 ? bgMatch / bgTotal : 1;
        similarityScore = (contentRatio * 90) + (bgRatio * 10);
      } else {
        // Fallback to simple pixel match if template is basically empty
        similarityScore = 100 - ((diffPixels / totalPixels) * 100);
      }

      // Safety: If student submitted a blank page but template has content, score is 0
      if (candidateIsBlank && !expectedIsBlank) {
        similarityScore = Math.min(similarityScore, 5); // Allow tiny score for "trying" but floor it
      }

      return {
        score: Math.round(similarityScore),
        diffPixels,
        totalPixels,
        diffPercentage: ((diffPixels / totalPixels) * 100).toFixed(2),
        matchPercentage: similarityScore.toFixed(2),
        isCandidateBlank: candidateIsBlank
      };

    } catch (error) {
      console.error('Image comparison error:', error);
      throw error;
    }
  }
}

module.exports = new PixelMatcher();
