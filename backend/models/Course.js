/**
 * Course Model
 * Database operations for courses table with JSON fallback
 */

const { query, queryOne, isConnected } = require("../database/connection");
const fs = require("fs").promises;
const path = require("path");

const COURSES_FILE = path.join(__dirname, "../data/courses.json");

// Helper to normalize tag fields that might come as JSON, CSV, or arrays
const normalizeTags = (rawValue) => {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (rawValue === null || rawValue === undefined) {
    return [];
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return [];
    }

    const looksJson =
      trimmed.startsWith("[") ||
      trimmed.startsWith("{") ||
      trimmed.startsWith('"');
    if (looksJson) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        console.warn(
          "Failed to parse course tags JSON, falling back to comma split:",
          error.message
        );
      }
    }

    return trimmed
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [String(rawValue).trim()].filter(Boolean);
};

class CourseModel {
  // Load courses from JSON file
  static async loadFromJSON() {
    try {
      const data = await fs.readFile(COURSES_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error reading courses.json:", error.message);
      return [];
    }
  }

  // Save courses to JSON file
  static async saveToJSON(courses) {
    try {
      await fs.writeFile(COURSES_FILE, JSON.stringify(courses, null, 2));
    } catch (error) {
      console.error("Error writing courses.json:", error.message);
      throw error;
    }
  }

  // Get all courses
  static async findAll() {
    if (!isConnected()) {
      const courses = await this.loadFromJSON();
      return courses.map((course) => ({
        ...course,
        tags: normalizeTags(course.tags),
      }));
    }

    const courses = await query(
      "SELECT * FROM courses ORDER BY created_at DESC"
    );
    // Parse JSON fields
    return courses.map((course) => ({
      ...course,
      tags: normalizeTags(course.tags),
      isLocked: Boolean(course.is_locked),
      totalLevels: course.total_levels,
      estimatedTime: course.estimated_time,
    }));
  }

  // Get course by ID
  static async findById(id) {
    if (!isConnected()) {
      const courses = await this.loadFromJSON();
      const course = courses.find((c) => c.id === id) || null;
      return course ? { ...course, tags: normalizeTags(course.tags) } : null;
    }

    const course = await queryOne("SELECT * FROM courses WHERE id = ?", [id]);
    if (!course) return null;
    return {
      ...course,
      tags: normalizeTags(course.tags),
      isLocked: Boolean(course.is_locked),
      totalLevels: course.total_levels,
      estimatedTime: course.estimated_time,
    };
  }

  // Create new course
  static async create(courseData) {
    const id = courseData.id || `course-${Date.now()}`;
    const normalizedTags = normalizeTags(courseData.tags);

    if (!isConnected()) {
      const courses = await this.loadFromJSON();
      const newCourse = {
        id,
        title: courseData.title,
        description: courseData.description,
        thumbnail: courseData.thumbnail || null,
        icon: courseData.icon || "📚",
        color: courseData.color || "#3B82F6",
        totalLevels: courseData.totalLevels || 1,
        estimatedTime: courseData.estimatedTime || "1 hour",
        difficulty: courseData.difficulty || "Beginner",
        tags: normalizedTags,
        isLocked: courseData.isLocked || false,
        restrictions: courseData.restrictions || {},
        levelSettings: courseData.levelSettings || {},
        createdAt: new Date().toISOString(),
      };
      courses.push(newCourse);
      await this.saveToJSON(courses);
      return newCourse;
    }

    await query(
      `INSERT INTO courses (id, title, description, thumbnail, icon, color, total_levels, estimated_time, difficulty, tags, is_locked, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        courseData.title,
        courseData.description,
        courseData.thumbnail || null,
        courseData.icon || "📚",
        courseData.color || "#3B82F6",
        courseData.totalLevels || 1,
        courseData.estimatedTime || "1 hour",
        courseData.difficulty || "Beginner",
        JSON.stringify(normalizedTags),
        courseData.isLocked || false,
        courseData.createdAt || new Date(),
      ]
    );
    return await this.findById(id);
  }

  // Update course
  static async update(id, courseData) {
    const preparedData = {
      ...courseData,
    };

    if (courseData.tags !== undefined) {
      preparedData.tags = normalizeTags(courseData.tags);
    }

    if (!isConnected()) {
      const courses = await this.loadFromJSON();
      const index = courses.findIndex((c) => c.id === id);
      if (index === -1) return null;

      courses[index] = {
        ...courses[index],
        ...preparedData,
        id, // Preserve ID
        updatedAt: new Date().toISOString(),
      };
      await this.saveToJSON(courses);
      return courses[index];
    }

    await query(
      `UPDATE courses SET
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       thumbnail = COALESCE(?, thumbnail),
       icon = COALESCE(?, icon),
       color = COALESCE(?, color),
       total_levels = COALESCE(?, total_levels),
       estimated_time = COALESCE(?, estimated_time),
       difficulty = COALESCE(?, difficulty),
       tags = COALESCE(?, tags),
       is_locked = COALESCE(?, is_locked),
       updated_at = NOW()
       WHERE id = ?`,
      [
        preparedData.title,
        preparedData.description,
        preparedData.thumbnail,
        preparedData.icon,
        preparedData.color,
        preparedData.totalLevels,
        preparedData.estimatedTime,
        preparedData.difficulty,
        preparedData.tags !== undefined
          ? JSON.stringify(preparedData.tags)
          : null,
        preparedData.isLocked !== undefined ? preparedData.isLocked : null,
        id,
      ]
    );
    return await this.findById(id);
  }

  // Delete course
  static async delete(id) {
    if (!isConnected()) {
      const courses = await this.loadFromJSON();
      const filtered = courses.filter((c) => c.id !== id);
      await this.saveToJSON(filtered);
      return;
    }

    await query("DELETE FROM courses WHERE id = ?", [id]);
  }

  // Get course count
  static async count() {
    if (!isConnected()) {
      const courses = await this.loadFromJSON();
      return courses.length;
    }

    const result = await queryOne("SELECT COUNT(*) as count FROM courses");
    return result.count;
  }
}

module.exports = CourseModel;
