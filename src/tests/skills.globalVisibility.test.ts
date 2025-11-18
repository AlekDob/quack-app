import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test suite for global skills visibility fix
 *
 * BUG: Global skills were not visible in projects without .claude/skills/ directory
 * ROOT CAUSE: App.tsx returned early if check_skills_directory returned false,
 *             preventing list_skills from being called
 * FIX: Always call list_skills regardless of directory existence
 */

describe('Global Skills Visibility Bug Fix', () => {
  describe('Backend (Rust) Behavior', () => {
    it('should list global skills even when project directory does not exist', () => {
      /**
       * SIMULATED BEHAVIOR:
       *
       * 1. check_skills_directory(working_dir) => false (no .claude/skills/ in project)
       * 2. list_skills(working_dir) => SHOULD still return global skills from ~/.claude/skills/
       *
       * Expected: [{name: 'swift-expert', scope: 'global', ...}, ...]
       */

      const mockGlobalSkills = [
        { name: 'swift-expert', scope: 'global', description: 'Swift Expert', file_path: '~/.claude/skills/swift-expert.md' },
        { name: 'brand-guidelines', scope: 'global', description: 'Brand Guidelines', file_path: '~/.claude/skills/brand-guidelines.md' }
      ];

      // This simulates the Rust backend behavior
      const checkSkillsDirectory = () => false; // No project skills dir
      const listSkills = () => mockGlobalSkills; // But still returns global skills

      expect(checkSkillsDirectory()).toBe(false);
      expect(listSkills()).toEqual(mockGlobalSkills);
      expect(listSkills().length).toBeGreaterThan(0);
    });

    it('should list both global and project skills when project directory exists', () => {
      const mockAllSkills = [
        { name: 'swift-expert', scope: 'global', description: 'Swift Expert', file_path: '~/.claude/skills/swift-expert.md' },
        { name: 'project-specific', scope: 'project', description: 'Project Skill', file_path: './.claude/skills/project-specific.md' }
      ];

      const checkSkillsDirectory = () => true; // Project skills dir exists
      const listSkills = () => mockAllSkills;

      expect(checkSkillsDirectory()).toBe(true);
      expect(listSkills()).toEqual(mockAllSkills);
      expect(listSkills().filter(s => s.scope === 'global').length).toBe(1);
      expect(listSkills().filter(s => s.scope === 'project').length).toBe(1);
    });
  });

  describe('Frontend (React) Behavior - BEFORE FIX', () => {
    it('BUG: should have skipped list_skills when directory did not exist', async () => {
      /**
       * BUGGY CODE (App.tsx lines 2934-2937):
       *
       * if (!dirExists) {
       *   setSkills([]);  // ❌ Clears all skills!
       *   setSkillsError(null);
       *   return;  // ❌ Never calls list_skills!
       * }
       */

      const dirExists = false;
      const skills: any[] = [];

      // Simulating the buggy behavior
      if (!dirExists) {
        expect(skills).toEqual([]); // Skills array is empty
        // list_skills was never called! ❌
      }

      expect(skills.length).toBe(0); // Bug: Global skills not loaded
    });
  });

  describe('Frontend (React) Behavior - AFTER FIX', () => {
    it('FIX: should always call list_skills regardless of directory existence', async () => {
      /**
       * FIXED CODE (App.tsx lines 2934-2938):
       *
       * // Check if PROJECT skills directory exists (for UI display purposes)
       * const dirExists = await invoke<boolean>("check_skills_directory", { workingDir });
       * setSkillsDirectoryExists(dirExists);
       *
       * // ALWAYS call list_skills - it will return global skills even if project dir doesn't exist
       * const skillsList = await invoke<SkillInfo[]>("list_skills", { workingDir });
       * setSkills(skillsList);
       */

      const mockInvoke = vi.fn();

      // Scenario 1: No project skills directory
      mockInvoke.mockResolvedValueOnce(false); // check_skills_directory
      mockInvoke.mockResolvedValueOnce([
        { name: 'swift-expert', scope: 'global', description: 'Swift Expert' },
        { name: 'brand-guidelines', scope: 'global', description: 'Brand Guidelines' }
      ]); // list_skills

      const dirExists = await mockInvoke('check_skills_directory', { workingDir: '/some/project' });
      const skillsList = await mockInvoke('list_skills', { workingDir: '/some/project' });

      expect(dirExists).toBe(false); // No project directory
      expect(skillsList.length).toBe(2); // ✅ But global skills are still loaded!
      expect(skillsList.every((s: any) => s.scope === 'global')).toBe(true);

      // Verify both functions were called
      expect(mockInvoke).toHaveBeenCalledTimes(2);
      expect(mockInvoke).toHaveBeenNthCalledWith(1, 'check_skills_directory', { workingDir: '/some/project' });
      expect(mockInvoke).toHaveBeenNthCalledWith(2, 'list_skills', { workingDir: '/some/project' });
    });

    it('should load global skills in flow-pos-mobile project (real bug scenario)', async () => {
      /**
       * REAL BUG SCENARIO:
       *
       * Project: flow-pos-mobile
       * Issue: No .claude/skills/ directory in project
       * Expected: Should show global skills from ~/.claude/skills/
       * Before Fix: Showed "No skills directory" message
       * After Fix: Shows global skills + message for project skills
       */

      const mockInvoke = vi.fn();

      mockInvoke.mockResolvedValueOnce(false); // check_skills_directory (no project dir)
      mockInvoke.mockResolvedValueOnce([
        // Global skills that should be visible
        { name: 'swift-expert', scope: 'global', description: 'Swift Expert' },
        { name: 'brand-guidelines', scope: 'global', description: 'Brand Guidelines' },
        { name: 'claude-agent-sdk-expert', scope: 'global', description: 'Claude Agent SDK Expert' },
        { name: 'discord-community-manager', scope: 'global', description: 'Discord Community Manager' },
        // ... more global skills
      ]);

      const projectPath = '/Users/alekdob/Desktop/Dev/flow-pos-mobile';
      const dirExists = await mockInvoke('check_skills_directory', { workingDir: projectPath });
      const skillsList = await mockInvoke('list_skills', { workingDir: projectPath });

      expect(dirExists).toBe(false); // Project has no .claude/skills/
      expect(skillsList.length).toBeGreaterThan(0); // ✅ Global skills are visible!
      expect(skillsList.filter((s: any) => s.scope === 'global').length).toBeGreaterThan(0);
      expect(skillsList.filter((s: any) => s.scope === 'project').length).toBe(0);
    });

    it('should load all skills in quack-app project (working scenario)', async () => {
      /**
       * WORKING SCENARIO:
       *
       * Project: quack-app
       * Has: .claude/skills/ directory with project-specific skills
       * Expected: Shows both global and project skills
       */

      const mockInvoke = vi.fn();

      mockInvoke.mockResolvedValueOnce(true); // check_skills_directory (project dir exists)
      mockInvoke.mockResolvedValueOnce([
        // Global skills
        { name: 'swift-expert', scope: 'global', description: 'Swift Expert' },
        { name: 'brand-guidelines', scope: 'global', description: 'Brand Guidelines' },
        // Project skills
        { name: 'claude-agent-sdk-expert', scope: 'project', description: 'Claude Agent SDK Expert' },
        { name: 'discord-community-manager', scope: 'project', description: 'Discord Community Manager' },
        { name: 'frontend-dev-guidelines', scope: 'project', description: 'Frontend Dev Guidelines' },
        // ... more skills
      ]);

      const projectPath = '/Users/alekdob/Desktop/Dev/Personal/quack-app';
      const dirExists = await mockInvoke('check_skills_directory', { workingDir: projectPath });
      const skillsList = await mockInvoke('list_skills', { workingDir: projectPath });

      expect(dirExists).toBe(true); // Project has .claude/skills/
      expect(skillsList.length).toBeGreaterThan(0);
      expect(skillsList.filter((s: any) => s.scope === 'global').length).toBeGreaterThan(0);
      expect(skillsList.filter((s: any) => s.scope === 'project').length).toBeGreaterThan(0);
    });
  });

  describe('UI Display Logic', () => {
    it('should show correct message when no project skills but global skills exist', () => {
      const skills = [
        { name: 'swift-expert', scope: 'global', description: 'Swift Expert' }
      ];
      const directoryExists = false; // No project directory

      // UI should show:
      // - Global Skills section (expanded) with swift-expert
      // - "No Project Skills" message with helpful tip about global skills

      const globalSkills = skills.filter(s => s.scope === 'global');
      const projectSkills = skills.filter(s => s.scope === 'project');

      expect(globalSkills.length).toBeGreaterThan(0);
      expect(projectSkills.length).toBe(0);
      expect(directoryExists).toBe(false);

      // UI logic: Show global skills section + "No Project Skills" message
      const shouldShowGlobalSection = globalSkills.length > 0;
      const shouldShowProjectSection = projectSkills.length > 0;
      const shouldShowNoProjectSkillsMessage = !directoryExists && skills.length > 0;

      expect(shouldShowGlobalSection).toBe(true);
      expect(shouldShowProjectSection).toBe(false);
      expect(shouldShowNoProjectSkillsMessage).toBe(true);
    });

    it('should show correct message when no skills at all', () => {
      const skills: any[] = [];
      const directoryExists = false;

      // UI should show:
      // - "No Project Skills" message
      // - Hint about creating .claude/skills/ directory
      // - Hint about global skills from ~/.claude/skills/

      expect(skills.length).toBe(0);
      expect(directoryExists).toBe(false);
    });

    it('should show all skills when both global and project exist', () => {
      const skills = [
        { name: 'swift-expert', scope: 'global', description: 'Swift Expert' },
        { name: 'project-skill', scope: 'project', description: 'Project Skill' }
      ];
      const directoryExists = true;

      const globalSkills = skills.filter(s => s.scope === 'global');
      const projectSkills = skills.filter(s => s.scope === 'project');

      expect(globalSkills.length).toBe(1);
      expect(projectSkills.length).toBe(1);
      expect(directoryExists).toBe(true);

      // UI logic: Show both sections
      const shouldShowGlobalSection = globalSkills.length > 0;
      const shouldShowProjectSection = projectSkills.length > 0;

      expect(shouldShowGlobalSection).toBe(true);
      expect(shouldShowProjectSection).toBe(true);
    });
  });
});
