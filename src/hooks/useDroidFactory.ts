import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { DroidSpec, UserStats, Achievement } from '../components/droid-factory/types';
import { generateDroidFile, validateDroidSpec } from '../services/droidFactory';
import {
  loadDroidStats,
  saveDroidStats,
  checkAchievements
} from '../services/droidStatsStorage';

export function useDroidFactory() {
  const [droidFactoryOpen, setDroidFactoryOpen] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>(() => loadDroidStats());

  return {
    droidFactoryOpen,
    setDroidFactoryOpen,
    userStats,
  };
}
