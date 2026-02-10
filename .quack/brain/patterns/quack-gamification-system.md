---
type: pattern
project: quack-app
created: 2026-01-10
migrated: true
---

# Quack Gamification System

## Gamification System Design

### Core Pillars

1. **Progression (Levels)** - Senso di crescita
2. **Achievement (Badges)** - Riconoscimento milestones
3. **Collection (Agents/Skills)** - Pokemon effect
4. **Social (Marketplace)** - Condivisione e competizione

---

### LEVELING SYSTEM

**XP Sources:**
| Action | XP | Note |
|--------|-----|------|
| Create agent | +100 | First time bonus +50 |
| Complete task | +50 | Streak bonus up to 2x |
| Use skill | +10 | Max 100/day |
| Export agent | +200 | Sharing is rewarded |
| Get download | +5 | Passive income |
| First install | +25 | Welcome bonus |
| Daily login | +15 | Streak bonus up to 7x |

**Level Thresholds:**
```
Lv.1:  0 XP      - 2 skill slots, 1 droid slot
Lv.5:  500 XP    - 3 skill slots, 1 droid slot
Lv.10: 2000 XP   - 4 skill slots, 2 droid slots
Lv.15: 4000 XP   - 4 skill slots, 2 droid slots, custom themes
Lv.20: 7000 XP   - 5 skill slots, 3 droid slots
Lv.30: 12000 XP  - 5 skill slots, 3 droid slots, beta features
Lv.50: 25000 XP  - Unlimited slots, all features
Lv.100: 100000 XP - Legend status, special badge
```

---

### ACHIEVEMENTS

**Creation Category:**
- First Steps: Create first agent (+50 XP)
- Droid Commander: Create 5 agents (+100 XP)
- Factory Foreman: Create 10 agents (+200 XP)
- Skill Collector: Equip 10 different skills (+75 XP)
- Droid Army: Assign 5 different droids (+75 XP)

**Usage Category:**
- Task Master: Complete 100 tasks (+150 XP)
- Speed Runner: 50 tasks under 5 minutes (+100 XP)
- Night Owl: Work between midnight and 5am (+25 XP)
- Early Bird: Work before 7am (+25 XP)
- Marathon: 8+ hours in one session (+50 XP)
- Streak Master: 7-day daily streak (+100 XP)
- Month Warrior: 30-day streak (+500 XP)

**Community Category:**
- Contributor: Share first agent to marketplace (+200 XP)
- Popular: Get 100 downloads (+150 XP)
- Influencer: Get 1000 downloads (+500 XP)
- Viral: Get 10000 downloads (+2000 XP)
- Verified Author: Get verified badge (+300 XP)
- Helper: Answer 10 community questions (+100 XP)

**Mastery Category:**
- Class Master: Create agent in every class (+200 XP)
- Skill Sensei: Max level with 3 skills (+150 XP)
- Droid Whisperer: Max synergy bonus achieved (+100 XP)
- Completionist: Unlock all other achievements (+1000 XP)

**Hidden Category:**
- Easter Egg Hunter: Find 3 hidden features
- Retro: Use Quack for 1 year
- OG: Early adopter badge (first 1000 users)

---

### REWARDS

**Cosmetic Rewards:**
- Rare avatar frames (gold, diamond, animated)
- Special color palettes
- Custom agent card backgrounds
- Animated achievement badges
- Profile flairs

**Functional Rewards:**
- Extra skill/droid slots (per level)
- Priority in marketplace listings
- Beta features early access
- Extended agent export options
- Bulk operations unlock

**Social Rewards:**
- Verified badge on profile
- Author spotlight (weekly feature)
- Featured agent placement
- Community role badges
- Leaderboard visibility

---

### UI INTEGRATION

**Profile Section:**
```
+----------------------------------+
| [Avatar]  ALEK                   |
|           Level 15               |
|           [==============--] 75% |
|                                  |
| Agents: 12  |  Downloads: 3.4k   |
| Achievements: 23/45              |
+----------------------------------+
```

**Achievement Toast:**
```
+----------------------------------+
| ACHIEVEMENT UNLOCKED!            |
| Droid Commander                  |
| Created 5 agents                 |
| +100 XP                          |
+----------------------------------+
```

**Level Up Animation:**
- Full screen celebratory effect
- Show new unlocks
- Confetti particles
- Sound effect (optional)

[2026-01-10] DEPRECATED - Sostituito con Power Rating System semplice. La gamification complessa (XP, livelli, achievements) e' stata rimossa per evitare complessita' non necessaria. Vedi [[Quack Agent Power Rating System]] per il nuovo approccio.

[2026-01-10] Moved to quack-bundles/ folder for better organization
