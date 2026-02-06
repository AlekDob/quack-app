/**
 * Project Utils Tests
 *
 * Unit tests for the project utility functions.
 */

import { describe, it, expect } from 'vitest';
import { extractProjectId, isValidProjectPath, formatProjectName } from '../utils/projectUtils';

describe('projectUtils', () => {
  describe('extractProjectId', () => {
    it('should extract project ID from absolute path (Unix/Mac)', () => {
      expect(extractProjectId('/Users/alekdob/Desktop/Dev/Personal/quack-app')).toBe('quack-app');
      expect(extractProjectId('/Users/alekdob/Desktop/Dev/flow-bi')).toBe('flow-bi');
      expect(extractProjectId('/home/user/projects/my-app')).toBe('my-app');
    });

    it('should extract project ID from absolute path (Windows)', () => {
      expect(extractProjectId('C:\\Users\\dev\\Documents\\GitHub\\quack-app')).toBe('quack-app');
      expect(extractProjectId('D:\\Projects\\flow-bi')).toBe('flow-bi');
      expect(extractProjectId('\\\\?\\C:\\Users\\dev\\Documents\\GitHub\\quack-app')).toBe('quack-app');
    });

    it('should handle trailing slashes (Unix/Mac)', () => {
      expect(extractProjectId('/Users/alekdob/Desktop/Dev/Personal/quack-app/')).toBe('quack-app');
      expect(extractProjectId('/Users/alekdob/Desktop/Dev/Personal/quack-app///')).toBe('quack-app');
    });

    it('should handle trailing backslashes (Windows)', () => {
      expect(extractProjectId('C:\\Users\\dev\\Documents\\GitHub\\quack-app\\')).toBe('quack-app');
      expect(extractProjectId('C:\\Users\\dev\\Documents\\GitHub\\quack-app\\\\\\')).toBe('quack-app');
    });

    it('should handle mixed separators', () => {
      expect(extractProjectId('C:/Users/dev/Documents/GitHub/quack-app')).toBe('quack-app');
      expect(extractProjectId('/Users/alekdob\\Desktop\\Dev/quack-app')).toBe('quack-app');
    });

    it('should return empty string for invalid input', () => {
      expect(extractProjectId('')).toBe('');
      expect(extractProjectId(null)).toBe('');
      expect(extractProjectId(undefined)).toBe('');
    });

    it('should handle single segment paths', () => {
      expect(extractProjectId('/project')).toBe('project');
      expect(extractProjectId('C:\\project')).toBe('project');
    });

    it('should handle root path', () => {
      expect(extractProjectId('/')).toBe('');
      expect(extractProjectId('C:\\')).toBe('');
    });
  });

  describe('isValidProjectPath', () => {
    it('should return true for valid absolute paths (Unix/Mac)', () => {
      expect(isValidProjectPath('/Users/alekdob/Desktop/Dev/Personal/quack-app')).toBe(true);
      expect(isValidProjectPath('/home/user/projects')).toBe(true);
    });

    it('should return true for valid absolute paths (Windows)', () => {
      expect(isValidProjectPath('C:\\Users\\dev\\Documents\\GitHub\\quack-app')).toBe(true);
      expect(isValidProjectPath('D:\\Projects\\my-app')).toBe(true);
      expect(isValidProjectPath('\\\\?\\C:\\Users\\dev\\Documents\\GitHub\\quack-app')).toBe(true);
    });

    it('should return false for relative paths', () => {
      expect(isValidProjectPath('projects/my-app')).toBe(false);
      expect(isValidProjectPath('./my-app')).toBe(false);
      expect(isValidProjectPath('..\\my-app')).toBe(false);
    });

    it('should return false for invalid input', () => {
      expect(isValidProjectPath('')).toBe(false);
      expect(isValidProjectPath(null)).toBe(false);
      expect(isValidProjectPath(undefined)).toBe(false);
    });
  });

  describe('formatProjectName', () => {
    it('should convert slugs to title case', () => {
      expect(formatProjectName('quack-app')).toBe('Quack App');
      expect(formatProjectName('flow-bi')).toBe('Flow Bi');
    });

    it('should handle underscores', () => {
      expect(formatProjectName('my_project')).toBe('My Project');
      expect(formatProjectName('some_long_name')).toBe('Some Long Name');
    });

    it('should handle single words', () => {
      expect(formatProjectName('project')).toBe('Project');
    });

    it('should return empty string for empty input', () => {
      expect(formatProjectName('')).toBe('');
    });
  });
});
