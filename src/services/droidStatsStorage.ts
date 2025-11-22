import type { UserStats, Achievement, DroidSpec } from '../components/droid-factory/types';
import { ACHIEVEMENTS_CONFIG } from '../components/droid-factory/types';

const STATS_STORAGE_KEY = 'quack_droid_factory_stats';

export function loadDroidStats(): UserStats {
  try {
    const stored = localStorage.getItem(STATS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load droid stats:', error);
  }

  // Default stats
  return {
    droidsCreated: 0,
    droidsUsed: 0,
    achievements: [],
    favoriteTemplate: '',
    creationDates: {},
  };
}

export function saveDroidStats(stats: UserStats): void {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to save droid stats:', error);
  }
}

export function checkAchievements(stats: UserStats, spec: DroidSpec): Achievement[] {
  const newAchievements: Achievement[] = [];
  const existingIds = new Set(stats.achievements.map(a => a.id));

  // First Steps - Create first droid
  if (stats.droidsCreated === 1 && !existingIds.has('FIRST_STEPS')) {
    newAchievements.push({
      id: 'FIRST_STEPS',
      ...ACHIEVEMENTS_CONFIG.FIRST_STEPS,
      unlockedAt: new Date().toISOString(),
    });
  }

  // Droid Commander - Create 5 droids
  if (stats.droidsCreated === 5 && !existingIds.has('DROID_COMMANDER')) {
    newAchievements.push({
      id: 'DROID_COMMANDER',
      ...ACHIEVEMENTS_CONFIG.DROID_COMMANDER,
      unlockedAt: new Date().toISOString(),
    });
  }

  // Web Master - Create Web Explorer
  if (spec.name === 'web-explorer' && !existingIds.has('WEB_MASTER')) {
    newAchievements.push({
      id: 'WEB_MASTER',
      ...ACHIEVEMENTS_CONFIG.WEB_MASTER,
      unlockedAt: new Date().toISOString(),
    });
  }

  // Code Archaeologist - Create Code Explorer
  if (spec.name === 'code-explorer' && !existingIds.has('CODE_ARCHAEOLOGIST')) {
    newAchievements.push({
      id: 'CODE_ARCHAEOLOGIST',
      ...ACHIEVEMENTS_CONFIG.CODE_ARCHAEOLOGIST,
      unlockedAt: new Date().toISOString(),
    });
  }

  // Quality Guardian - Create Test Generator
  if (spec.name === 'test-generator' && !existingIds.has('QUALITY_GUARDIAN')) {
    newAchievements.push({
      id: 'QUALITY_GUARDIAN',
      ...ACHIEVEMENTS_CONFIG.QUALITY_GUARDIAN,
      unlockedAt: new Date().toISOString(),
    });
  }

  return newAchievements;
}
