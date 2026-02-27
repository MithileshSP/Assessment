/**
 * User Model
 * Database operations for users table
 */

const { query, queryOne } = require('../database/connection');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function saltPassword(password) {
  if (!password) return null;
  // If it's already a bcrypt hash (starts with $2), don't salt it again
  if (password.startsWith('$2')) return password;
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

function verifyPassword(password, hash, version = 'bcrypt') {
  if (version === 'sha256') {
    const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
    return sha256Hash === hash;
  }

  // Try standard bcrypt (plaintext)
  if (bcrypt.compareSync(password, hash)) return true;

  // Try legacy double-hash (bcrypt(sha256(password)))
  const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
  if (bcrypt.compareSync(sha256Hash, hash)) return true;

  return false;
}

class UserModel {
  // Get all users
  // Get all users with pagination, search, and ordering
  static async findAll(options = {}) {
    const { limit, offset, search, role, username, email, fullName, rollNo, isBlocked } = options;

    let queryStr = 'SELECT * FROM users';
    const params = [];
    const whereClauses = [];

    if (search) {
      whereClauses.push('(username LIKE ? OR email LIKE ? OR full_name LIKE ? OR roll_no LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (role && role !== 'all') {
      whereClauses.push('role = ?');
      params.push(role);
    }

    // New Specific Column Filters
    if (username) {
      whereClauses.push('username LIKE ?');
      params.push(`%${username}%`);
    }
    if (email) {
      whereClauses.push('email LIKE ?');
      params.push(`%${email}%`);
    }
    if (fullName) {
      whereClauses.push('full_name LIKE ?');
      params.push(`%${fullName}%`);
    }
    if (rollNo) {
      whereClauses.push('roll_no LIKE ?');
      params.push(`%${rollNo}%`);
    }
    if (isBlocked !== undefined && isBlocked !== null && isBlocked !== '') {
      whereClauses.push('is_blocked = ?');
      params.push(isBlocked === 'true' || isBlocked === true ? 1 : 0);
    }

    if (whereClauses.length > 0) {
      queryStr += ' WHERE ' + whereClauses.join(' AND ');
    }

    queryStr += ' ORDER BY created_at DESC';

    if (limit !== undefined && offset !== undefined) {
      queryStr += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
    }

    return await query(queryStr, params);
  }

  // Count users for pagination
  static async count(options = {}) {
    const { search, role, username, email, fullName, rollNo, isBlocked } = options;
    let queryStr = 'SELECT COUNT(*) as total FROM users';
    const params = [];
    const whereClauses = [];

    if (search) {
      whereClauses.push('(username LIKE ? OR email LIKE ? OR full_name LIKE ? OR roll_no LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (role && role !== 'all') {
      whereClauses.push('role = ?');
      params.push(role);
    }

    // New Specific Column Filters
    if (username) {
      whereClauses.push('username LIKE ?');
      params.push(`%${username}%`);
    }
    if (email) {
      whereClauses.push('email LIKE ?');
      params.push(`%${email}%`);
    }
    if (fullName) {
      whereClauses.push('full_name LIKE ?');
      params.push(`%${fullName}%`);
    }
    if (rollNo) {
      whereClauses.push('roll_no LIKE ?');
      params.push(`%${rollNo}%`);
    }
    if (isBlocked !== undefined && isBlocked !== null && isBlocked !== '') {
      whereClauses.push('is_blocked = ?');
      params.push(isBlocked === 'true' || isBlocked === true ? 1 : 0);
    }

    if (whereClauses.length > 0) {
      queryStr += ' WHERE ' + whereClauses.join(' AND ');
    }

    const result = await queryOne(queryStr, params);
    return result.total;
  }

  // Get user by ID
  static async findById(id) {
    return await queryOne('SELECT * FROM users WHERE id = ?', [id]);
  }

  // Get user by username
  static async findByUsername(username) {
    return await queryOne('SELECT * FROM users WHERE username = ?', [username]);
  }

  // Get user by email
  static async findByEmail(email) {
    return await queryOne('SELECT * FROM users WHERE email = ?', [email]);
  }

  // Create new user
  static async create(userData) {
    // Students are blocked by default, admin/faculty are not
    const isBlocked = userData.isBlocked !== undefined
      ? userData.isBlocked
      : (userData.is_blocked !== undefined ? userData.is_blocked : (userData.role === 'student'));

    // New users always use bcrypt
    const password = userData.password ? saltPassword(userData.password) : null;
    const passwordVersion = 'bcrypt';

    const result = await query(
      `INSERT INTO users (id, username, password, password_version, email, full_name, roll_no, role, is_blocked, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.id,
        userData.username,
        password,
        passwordVersion,
        userData.email,
        userData.fullName || userData.full_name,
        userData.rollNo || userData.roll_no || null,
        userData.role || 'student',
        isBlocked,
        userData.createdAt || new Date()
      ]
    );
    return await this.findById(userData.id);
  }

  // Update user
  static async update(id, userData) {
    // If password is being updated, hash it with bcrypt
    const updates = { ...userData };
    if (updates.password) {
      updates.password = saltPassword(updates.password);
      updates.password_version = 'bcrypt';
    }

    await query(
      `UPDATE users SET
       username = COALESCE(?, username),
       email = COALESCE(?, email),
       full_name = COALESCE(?, full_name),
       roll_no = COALESCE(?, roll_no),
       role = COALESCE(?, role),
       is_blocked = COALESCE(?, is_blocked),
       password = COALESCE(?, password),
       password_version = COALESCE(?, password_version)
       WHERE id = ?`,
      [
        updates.username ?? null,
        updates.email ?? null,
        (updates.fullName ?? updates.full_name) ?? null,
        (updates.rollNo ?? updates.roll_no) ?? null,
        updates.role ?? null,
        (updates.isBlocked ?? updates.is_blocked) ?? null,
        updates.password ?? null,
        updates.password_version ?? null,
        id
      ]
    );
    return await this.findById(id);
  }

  // Update last login
  static async updateLastLogin(id) {
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [id]
    );
  }

  // Delete user
  static async delete(id) {
    await query('DELETE FROM users WHERE id = ?', [id]);
  }

  // Get user count
  static async count() {
    const result = await queryOne('SELECT COUNT(*) as count FROM users');
    return result.count;
  }
}

UserModel.saltPassword = saltPassword;
UserModel.verifyPassword = verifyPassword;

module.exports = UserModel;
