/**
 * Image Storage Service
 * Unified service for storing images in both database (BLOB) and file system
 * Provides redundancy and easy retrieval
 */

const fs = require('fs');
const path = require('path');
const { query, queryOne } = require('../database/connection');

class ImageStorageService {
  constructor() {
    this.assetsDir = path.join(__dirname, '../assets');
  }

  

  /**
   * Store asset in database
   * @param {Object} assetInfo - Asset metadata
   * @param {string} filePath - Path to asset file
   */
  async storeAsset(assetInfo, filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileBuffer = fs.readFileSync(filePath);
      
      await query(
        `INSERT INTO assets (filename, original_name, path, url, type, size, category, file_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         file_data = VALUES(file_data),
         size = VALUES(size),
         uploaded_at = CURRENT_TIMESTAMP`,
        [
          assetInfo.filename,
          assetInfo.originalName,
          assetInfo.relativePath,
          assetInfo.url,
          assetInfo.type,
          assetInfo.size,
          assetInfo.category || 'general',
          fileBuffer
        ]
      );

      console.log(`✓ Stored asset ${assetInfo.filename} in database`);
      return true;
    } catch (error) {
      console.error(`Failed to store asset in database:`, error.message);
      return false;
    }
  }

  /**
   * Retrieve asset from database
   * @param {string} filename - Asset filename
   * @returns {Object|null} - { data: Buffer, type: string, originalName: string }
   */
  async getAsset(filename) {
    try {
      const result = await queryOne(
        'SELECT file_data, type, original_name FROM assets WHERE filename = ?',
        [filename]
      );

      if (result && result.file_data) {
        return {
          data: result.file_data,
          type: result.type,
          originalName: result.original_name
        };
      }

      // Fallback to filesystem
      const categories = ['images', 'references', 'courses'];
      for (const category of categories) {
        const filePath = path.join(this.assetsDir, category, filename);
        if (fs.existsSync(filePath)) {
          console.log(`⚠ Asset retrieved from filesystem (not in DB): ${filename}`);
          return {
            data: fs.readFileSync(filePath),
            type: this._getMimeType(filename),
            originalName: filename
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to retrieve asset:`, error.message);
      return null;
    }
  }

  /**
   * Get all assets metadata
   * @returns {Array} - Array of asset metadata
   */
  async getAllAssets() {
    try {
      const assets = await query(
        'SELECT id, filename, original_name, url, type, size, category, uploaded_at FROM assets ORDER BY uploaded_at DESC'
      );
      return assets.map(asset => ({
        id: asset.id,
        filename: asset.filename,
        originalName: asset.original_name,
        url: asset.url,
        type: asset.type,
        size: asset.size,
        category: asset.category,
        uploadedAt: asset.uploaded_at
      }));
    } catch (error) {
      console.error('Failed to get assets from database:', error.message);
      return [];
    }
  }

  /**
   * Delete asset from database
   * @param {string} filename - Asset filename
   */
  async deleteAsset(filename) {
    try {
      await query('DELETE FROM assets WHERE filename = ?', [filename]);
      console.log(`✓ Deleted asset ${filename} from database`);
      return true;
    } catch (error) {
      console.error(`Failed to delete asset from database:`, error.message);
      return false;
    }
  }

  

  /**
   * Get MIME type from filename
   * @param {string} filename - Filename
   * @returns {string} - MIME type
   */
  _getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

module.exports = new ImageStorageService();
