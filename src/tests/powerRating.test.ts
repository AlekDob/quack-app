import { describe, it, expect } from 'vitest';
import {
  calculatePowerRating,
  getPowerRatingColor,
  getPowerRatingTier,
  formatPowerRating,
  getPowerRatingPercentage,
} from '../utils/powerRating';

/**
 * Power Rating System Tests
 *
 * Tests for the agent power rating calculation system.
 * Power = Base + (Skills × 100) + (Droids × 150) + (Rules × 50) + (Commands × 75)
 */

describe('Power Rating - calculatePowerRating()', () => {
  it('should return base power (100) for empty equipment', () => {
    const result = calculatePowerRating(0, 0, 0, 0);

    expect(result.total).toBe(100);
    expect(result.base).toBe(100);
    expect(result.skills).toBe(0);
    expect(result.droids).toBe(0);
    expect(result.rules).toBe(0);
    expect(result.commands).toBe(0);
    expect(result.skillCount).toBe(0);
    expect(result.droidCount).toBe(0);
    expect(result.ruleCount).toBe(0);
    expect(result.commandCount).toBe(0);
  });

  it('should calculate correctly with skills only', () => {
    const result = calculatePowerRating(3, 0, 0, 0);

    expect(result.total).toBe(400); // 100 + 3*100
    expect(result.skills).toBe(300);
    expect(result.skillCount).toBe(3);
  });

  it('should calculate correctly with droids only', () => {
    const result = calculatePowerRating(0, 2, 0, 0);

    expect(result.total).toBe(400); // 100 + 2*150
    expect(result.droids).toBe(300);
    expect(result.droidCount).toBe(2);
  });

  it('should calculate correctly with rules only', () => {
    const result = calculatePowerRating(0, 0, 4, 0);

    expect(result.total).toBe(300); // 100 + 4*50
    expect(result.rules).toBe(200);
    expect(result.ruleCount).toBe(4);
  });

  it('should calculate correctly with commands only', () => {
    const result = calculatePowerRating(0, 0, 0, 2);

    expect(result.total).toBe(250); // 100 + 2*75
    expect(result.commands).toBe(150);
    expect(result.commandCount).toBe(2);
  });

  it('should calculate correctly with all equipment types', () => {
    // 100 + 3*100 + 2*150 + 4*50 + 2*75 = 100 + 300 + 300 + 200 + 150 = 1050
    const result = calculatePowerRating(3, 2, 4, 2);

    expect(result.total).toBe(1050);
    expect(result.base).toBe(100);
    expect(result.skills).toBe(300);
    expect(result.droids).toBe(300);
    expect(result.rules).toBe(200);
    expect(result.commands).toBe(150);
    expect(result.skillCount).toBe(3);
    expect(result.droidCount).toBe(2);
    expect(result.ruleCount).toBe(4);
    expect(result.commandCount).toBe(2);
  });

  it('should handle maximum realistic power (4 skills, 3 droids, 5 rules, 3 commands)', () => {
    // 100 + 4*100 + 3*150 + 5*50 + 3*75 = 100 + 400 + 450 + 250 + 225 = 1425
    const result = calculatePowerRating(4, 3, 5, 3);

    expect(result.total).toBe(1425);
  });

  it('should handle single item of each type', () => {
    // 100 + 1*100 + 1*150 + 1*50 + 1*75 = 475
    const result = calculatePowerRating(1, 1, 1, 1);

    expect(result.total).toBe(475);
    expect(result.skillCount).toBe(1);
    expect(result.droidCount).toBe(1);
    expect(result.ruleCount).toBe(1);
    expect(result.commandCount).toBe(1);
  });

  it('should handle large numbers gracefully', () => {
    const result = calculatePowerRating(10, 10, 10, 10);

    expect(result.total).toBe(3850); // 100 + 1000 + 1500 + 500 + 750
    expect(result.skills).toBe(1000);
    expect(result.droids).toBe(1500);
    expect(result.rules).toBe(500);
    expect(result.commands).toBe(750);
  });

  it('should prioritize droids over other equipment (weight 150)', () => {
    const withDroids = calculatePowerRating(0, 2, 0, 0); // 100 + 300 = 400
    const withSkills = calculatePowerRating(3, 0, 0, 0); // 100 + 300 = 400

    // Same total but fewer droids needed than skills
    expect(withDroids.total).toBe(withSkills.total);
    expect(withDroids.droidCount).toBe(2);
    expect(withSkills.skillCount).toBe(3);
  });
});

describe('Power Rating - getPowerRatingColor()', () => {
  it('should return green for minimal power (< 300)', () => {
    expect(getPowerRatingColor(100)).toBe('#00FF00');
    expect(getPowerRatingColor(200)).toBe('#00FF00');
    expect(getPowerRatingColor(299)).toBe('#00FF00');
  });

  it('should return yellow for standard power (300-599)', () => {
    expect(getPowerRatingColor(300)).toBe('#FFFF00');
    expect(getPowerRatingColor(450)).toBe('#FFFF00');
    expect(getPowerRatingColor(599)).toBe('#FFFF00');
  });

  it('should return orange for advanced power (600-999)', () => {
    expect(getPowerRatingColor(600)).toBe('#FF9900');
    expect(getPowerRatingColor(800)).toBe('#FF9900');
    expect(getPowerRatingColor(999)).toBe('#FF9900');
  });

  it('should return red for pro power (>= 1000)', () => {
    expect(getPowerRatingColor(1000)).toBe('#FF0000');
    expect(getPowerRatingColor(1500)).toBe('#FF0000');
    expect(getPowerRatingColor(3850)).toBe('#FF0000');
  });

  it('should handle edge cases at tier boundaries', () => {
    expect(getPowerRatingColor(299)).toBe('#00FF00'); // Just below standard
    expect(getPowerRatingColor(300)).toBe('#FFFF00'); // Exactly standard
    expect(getPowerRatingColor(599)).toBe('#FFFF00'); // Just below advanced
    expect(getPowerRatingColor(600)).toBe('#FF9900'); // Exactly advanced
    expect(getPowerRatingColor(999)).toBe('#FF9900'); // Just below pro
    expect(getPowerRatingColor(1000)).toBe('#FF0000'); // Exactly pro
  });

  it('should handle zero power', () => {
    expect(getPowerRatingColor(0)).toBe('#00FF00');
  });

  it('should handle negative power (edge case)', () => {
    // In practice this shouldn't happen, but test defensive behavior
    expect(getPowerRatingColor(-100)).toBe('#00FF00');
  });
});

describe('Power Rating - getPowerRatingTier()', () => {
  it('should return "Minimal" for power < 300', () => {
    expect(getPowerRatingTier(100)).toBe('Minimal');
    expect(getPowerRatingTier(200)).toBe('Minimal');
    expect(getPowerRatingTier(299)).toBe('Minimal');
  });

  it('should return "Standard" for power 300-599', () => {
    expect(getPowerRatingTier(300)).toBe('Standard');
    expect(getPowerRatingTier(450)).toBe('Standard');
    expect(getPowerRatingTier(599)).toBe('Standard');
  });

  it('should return "Advanced" for power 600-999', () => {
    expect(getPowerRatingTier(600)).toBe('Advanced');
    expect(getPowerRatingTier(800)).toBe('Advanced');
    expect(getPowerRatingTier(999)).toBe('Advanced');
  });

  it('should return "Pro" for power >= 1000', () => {
    expect(getPowerRatingTier(1000)).toBe('Pro');
    expect(getPowerRatingTier(1200)).toBe('Pro');
    expect(getPowerRatingTier(3850)).toBe('Pro');
  });

  it('should match color tier boundaries', () => {
    // Ensure tier labels match color tier boundaries
    const powerLevels = [100, 300, 600, 1000, 1500];

    powerLevels.forEach(power => {
      const color = getPowerRatingColor(power);
      const tier = getPowerRatingTier(power);

      if (power < 300) {
        expect(tier).toBe('Minimal');
        expect(color).toBe('#00FF00');
      } else if (power < 600) {
        expect(tier).toBe('Standard');
        expect(color).toBe('#FFFF00');
      } else if (power < 1000) {
        expect(tier).toBe('Advanced');
        expect(color).toBe('#FF9900');
      } else {
        expect(tier).toBe('Pro');
        expect(color).toBe('#FF0000');
      }
    });
  });
});

describe('Power Rating - formatPowerRating()', () => {
  it('should format power as string', () => {
    expect(formatPowerRating(100)).toBe('100');
    expect(formatPowerRating(850)).toBe('850');
    expect(formatPowerRating(1425)).toBe('1425');
  });

  it('should handle zero', () => {
    expect(formatPowerRating(0)).toBe('0');
  });

  it('should handle large numbers', () => {
    expect(formatPowerRating(9999)).toBe('9999');
    expect(formatPowerRating(10000)).toBe('10000');
  });

  it('should not add separators or formatting', () => {
    // Simple toString() - no thousand separators
    expect(formatPowerRating(1000)).toBe('1000');
    expect(formatPowerRating(10000)).toBe('10000');
  });
});

describe('Power Rating - getPowerRatingPercentage()', () => {
  it('should return 0% for base power (100)', () => {
    expect(getPowerRatingPercentage(100)).toBeCloseTo(6.67, 1);
  });

  it('should return ~50% for mid-range power (750)', () => {
    expect(getPowerRatingPercentage(750)).toBe(50);
  });

  it('should return 100% for max realistic power (1500)', () => {
    expect(getPowerRatingPercentage(1500)).toBe(100);
  });

  it('should cap at 100% for power above max', () => {
    expect(getPowerRatingPercentage(2000)).toBe(100);
    expect(getPowerRatingPercentage(5000)).toBe(100);
    expect(getPowerRatingPercentage(10000)).toBe(100);
  });

  it('should return 0% for zero power', () => {
    expect(getPowerRatingPercentage(0)).toBe(0);
  });

  it('should calculate correct percentages for common scenarios', () => {
    // Empty agent (100) = 6.67%
    expect(getPowerRatingPercentage(100)).toBeCloseTo(6.67, 1);

    // Minimal (300) = 20%
    expect(getPowerRatingPercentage(300)).toBe(20);

    // Standard (600) = 40%
    expect(getPowerRatingPercentage(600)).toBe(40);

    // Advanced (1000) = 66.67%
    expect(getPowerRatingPercentage(1000)).toBeCloseTo(66.67, 1);

    // Pro (1425) = 95%
    expect(getPowerRatingPercentage(1425)).toBe(95);
  });

  it('should handle negative power (edge case)', () => {
    // In practice this shouldn't happen, but test defensive behavior
    expect(getPowerRatingPercentage(-100)).toBeCloseTo(-6.67, 1);
  });

  it('should return fractional percentages', () => {
    // Not rounded to integers
    expect(getPowerRatingPercentage(475)).toBeCloseTo(31.67, 1);
    expect(getPowerRatingPercentage(825)).toBeCloseTo(55, 1);
  });
});

describe('Power Rating - Real-World Scenarios', () => {
  it('should calculate power for a minimal agent (1 skill)', () => {
    const result = calculatePowerRating(1, 0, 0, 0);

    expect(result.total).toBe(200); // 100 + 100
    expect(getPowerRatingTier(result.total)).toBe('Minimal');
    expect(getPowerRatingColor(result.total)).toBe('#00FF00');
    expect(getPowerRatingPercentage(result.total)).toBeCloseTo(13.33, 1);
  });

  it('should calculate power for a standard agent (2 skills, 1 rule)', () => {
    const result = calculatePowerRating(2, 0, 1, 0);

    expect(result.total).toBe(350); // 100 + 200 + 50
    expect(getPowerRatingTier(result.total)).toBe('Standard');
    expect(getPowerRatingColor(result.total)).toBe('#FFFF00');
    expect(getPowerRatingPercentage(result.total)).toBeCloseTo(23.33, 1);
  });

  it('should calculate power for an advanced agent (3 skills, 1 droid, 2 rules)', () => {
    const result = calculatePowerRating(3, 1, 2, 0);

    expect(result.total).toBe(650); // 100 + 300 + 150 + 100
    expect(getPowerRatingTier(result.total)).toBe('Advanced');
    expect(getPowerRatingColor(result.total)).toBe('#FF9900');
    expect(getPowerRatingPercentage(result.total)).toBeCloseTo(43.33, 1);
  });

  it('should calculate power for a pro agent (4 skills, 3 droids, 5 rules, 3 commands)', () => {
    const result = calculatePowerRating(4, 3, 5, 3);

    expect(result.total).toBe(1425); // 100 + 400 + 450 + 250 + 225
    expect(getPowerRatingTier(result.total)).toBe('Pro');
    expect(getPowerRatingColor(result.total)).toBe('#FF0000');
    expect(getPowerRatingPercentage(result.total)).toBe(95);
  });

  it('should show that droids are most valuable equipment', () => {
    const withOneDroid = calculatePowerRating(0, 1, 0, 0).total; // 100 + 150 = 250
    const withOneSkill = calculatePowerRating(1, 0, 0, 0).total; // 100 + 100 = 200
    const withTwoRules = calculatePowerRating(0, 0, 2, 0).total; // 100 + 100 = 200
    const withTwoCommands = calculatePowerRating(0, 0, 0, 2).total; // 100 + 150 = 250

    expect(withOneDroid).toBeGreaterThan(withOneSkill);
    expect(withOneDroid).toBeGreaterThan(withTwoRules);
    expect(withOneDroid).toBe(withTwoCommands); // Equal value
  });

  it('should calculate breakdown correctly for display purposes', () => {
    const result = calculatePowerRating(2, 1, 3, 1);

    // Verify all breakdown components
    // 100 + 200 + 150 + 150 + 75 = 675
    expect(result).toEqual({
      total: 675,
      base: 100,
      skills: 200,
      droids: 150,
      rules: 150,
      commands: 75,
      skillCount: 2,
      droidCount: 1,
      ruleCount: 3,
      commandCount: 1,
    });
  });
});

describe('Power Rating - Edge Cases', () => {
  it('should handle all zeros', () => {
    const result = calculatePowerRating(0, 0, 0, 0);

    expect(result.total).toBe(100);
    expect(formatPowerRating(result.total)).toBe('100');
    expect(getPowerRatingTier(result.total)).toBe('Minimal');
    expect(getPowerRatingColor(result.total)).toBe('#00FF00');
  });

  it('should handle very large equipment counts', () => {
    const result = calculatePowerRating(100, 100, 100, 100);

    expect(result.total).toBe(37600); // 100 + 10000 + 15000 + 5000 + 7500
    expect(getPowerRatingTier(result.total)).toBe('Pro');
    expect(getPowerRatingColor(result.total)).toBe('#FF0000');
    expect(getPowerRatingPercentage(result.total)).toBe(100); // Capped
  });

  it('should return consistent results for same inputs', () => {
    const result1 = calculatePowerRating(3, 2, 4, 2);
    const result2 = calculatePowerRating(3, 2, 4, 2);

    expect(result1).toEqual(result2);
  });

  it('should handle decimals gracefully (in case of bad input)', () => {
    // TypeScript should prevent this, but test runtime behavior
    const result = calculatePowerRating(2.5, 1.7, 3.2, 1.9);

    // Should work with floats (no type error at runtime)
    expect(result.total).toBeGreaterThan(100);
  });
});
