import type { PowerRatingBreakdown } from '../types';

/**
 * Power Rating System
 *
 * Simple calculation that shows how "equipped" an agent is.
 *
 * Formula:
 * Power = Base + (Skills × 100) + (Droids × 150) + (Rules × 50) + (Commands × 75)
 *
 * Base: 100 (everyone starts here)
 * Skills: 100 points each (core abilities)
 * Droids: 150 points each (subagents are powerful)
 * Rules: 50 points each (guidelines, less impactful)
 * Commands: 75 points each (utility shortcuts)
 */

const BASE_POWER = 100;
const SKILL_WEIGHT = 100;
const DROID_WEIGHT = 150;
const RULE_WEIGHT = 50;
const COMMAND_WEIGHT = 75;

/**
 * Calculate power rating for an agent
 */
export function calculatePowerRating(
  skillCount: number,
  droidCount: number,
  ruleCount: number,
  commandCount: number
): PowerRatingBreakdown {
  const skillsPoints = skillCount * SKILL_WEIGHT;
  const droidsPoints = droidCount * DROID_WEIGHT;
  const rulesPoints = ruleCount * RULE_WEIGHT;
  const commandsPoints = commandCount * COMMAND_WEIGHT;

  const total = BASE_POWER + skillsPoints + droidsPoints + rulesPoints + commandsPoints;

  return {
    total,
    base: BASE_POWER,
    skills: skillsPoints,
    droids: droidsPoints,
    rules: rulesPoints,
    commands: commandsPoints,
    skillCount,
    droidCount,
    ruleCount,
    commandCount,
  };
}

/**
 * Get color for power rating (gradient: green → yellow → red)
 */
export function getPowerRatingColor(power: number): string {
  if (power < 300) return '#00FF00'; // Green (minimal)
  if (power < 600) return '#FFFF00'; // Yellow (standard)
  if (power < 1000) return '#FF9900'; // Orange (advanced)
  return '#FF0000'; // Red (pro)
}

/**
 * Get power rating tier label
 */
export function getPowerRatingTier(power: number): string {
  if (power < 300) return 'Minimal';
  if (power < 600) return 'Standard';
  if (power < 1000) return 'Advanced';
  return 'Pro';
}

/**
 * Format power rating for display (e.g., "850")
 */
export function formatPowerRating(power: number): string {
  return power.toString();
}

/**
 * Calculate progress percentage for power bar (0-100)
 * Assumes max realistic power is ~1500 (4 skills + 3 droids + 5 rules + 3 commands)
 */
export function getPowerRatingPercentage(power: number): number {
  const MAX_REALISTIC_POWER = 1500;
  return Math.min((power / MAX_REALISTIC_POWER) * 100, 100);
}
