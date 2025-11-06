# Idea Validator Skill

Brutally honest validation of app ideas before building.

## Quick Start

### Using the Slash Command

```bash
/validate-idea "Your app idea description here"
```

### Using the Skill Directly

Simply describe your app idea to Claude and mention you want to validate it. The skill will automatically trigger when you ask about:
- Validating an idea
- Getting feedback on an app concept
- Checking if an idea is worth building
- Market research for a product

## What You Get

Each validation includes:

1. **🎯 Quick Verdict**: Build it (🟢), Maybe (🟡), or Skip it (🔴)
2. **📊 Evaluation Scores**: Market, Demand, Feasibility, Monetization, Interest (1-10 each)
3. **🔍 Market Analysis**: 5-10 similar products with URLs, pricing, features
4. **💡 Demand Validation**: Evidence from Product Hunt, Indie Hackers, Reddit, HackerNews
5. **⚙️ Feasibility Assessment**: Time estimate, tech stack, MVP scope
6. **💰 Monetization Analysis**: Pricing benchmarks, suggested revenue model
7. **🎨 Interest Factor**: Honest gut check on idea appeal
8. **🚀 Improvement Suggestions**: How to make it stronger

## Evaluation Criteria

### Market (25% weight)
- Is this space crowded or blue ocean?
- Who are the competitors?
- What makes similar products successful?

### Demand (30% weight) - Highest Priority
- Do people actually want this?
- Are they paying for solutions?
- Real evidence vs just saying "nice idea"

### Feasibility (15% weight)
- Can a solo builder ship this in 2-4 weeks?
- What's the technical complexity?
- What's the realistic MVP scope?

### Monetization (20% weight)
- How would this make money?
- Are people paying for similar things?
- What's the willingness to pay?

### Interest Factor (10% weight)
- Is this boring or compelling?
- Does the founder have passion for it?
- Is timing right?

## Scoring System

| Score | Verdict | Meaning |
|-------|---------|---------|
| 8.0-10.0 | 🟢 **Build it** | Strong opportunity, worth pursuing |
| 5.0-7.9 | 🟡 **Maybe** | Proceed with caution, validate further |
| 1.0-4.9 | 🔴 **Skip it** | Not worth the time, move on |

## Where Reports Are Saved

All validation reports are saved to your Obsidian vault:

```
/Users/alekdob/Documents/Obsidian Vault/11 - Idea Validation/
```

- **Filename format**: `[YYYY-MM-DD] - [Idea Name].md`
- **Index file**: `README.md` tracks all validated ideas sorted by verdict

## Example Validations

### Strong Idea (🟢 Build it - Score 7.8/10)

**Idea**: "Simple invoice tracker for freelancers to manage payments and follow-ups"

**Why Build**:
- Clear pain point for freelancers
- Multiple competitors = proven demand
- Feasible 2-3 week MVP
- Straightforward monetization ($10-30/month)
- Room for simpler/cheaper alternative

### Weak Idea (🔴 Skip it - Score 3.5/10)

**Idea**: "A tool for managing Discord communities with moderation, analytics, and engagement features"

**Why Skip**:
- Very crowded market (MEE6, Dyno, Carl-bot, etc.)
- Dominated by established free alternatives
- Hard to differentiate
- Low willingness to pay (most are freemium)

### Mixed Signals (🟡 Maybe - Score 6.5/10)

**Idea**: "Local-first note-taking app with AI features for summarization and organization"

**Why Maybe**:
- Interesting privacy angle (growing demand)
- Technically complex (local AI, sync)
- Strong competitors (Obsidian, Logseq)
- Need strong differentiation

## Philosophy

**Better to hear harsh truth now than waste a month building.**

This skill is brutally honest. It will:
- ✅ Call out "been done 100 times"
- ✅ Highlight weak demand signals
- ✅ Identify oversaturated markets
- ✅ Point out monetization challenges
- ✅ Be realistic about feasibility

Use this **before starting any new project** to avoid building stuff nobody wants.

## Best Practices

### Do This
- ✅ Validate every idea before building
- ✅ Look for 7.0+ scores before committing time
- ✅ Pay attention to demand signals (highest weight)
- ✅ Learn from "Skip it" verdicts (why it won't work)
- ✅ Use suggestions to strengthen "Maybe" ideas
- ✅ Review past validations in Obsidian

### Don't Do This
- ❌ Skip validation and jump into coding
- ❌ Ignore "Skip it" verdicts hoping you're special
- ❌ Only validate after building (too late)
- ❌ Dismiss competitor research
- ❌ Assume "big market" = demand
- ❌ Build based on friends saying "cool idea"

## Skill Structure

```
idea-validator/
├── SKILL.md                          # Main skill instructions
├── README.md                         # This file
├── references/
│   ├── validation-frameworks.md     # Detailed evaluation criteria
│   ├── pricing-benchmarks.md        # SaaS pricing research data
│   └── market-signals.md            # Demand validation signals
└── scripts/
    └── (none - skill uses web search tools)
```

## Tools Used

The skill leverages:
- **Firecrawl Search**: Competitor and market research
- **Web Search**: Community signals (Product Hunt, Reddit, Indie Hackers)
- **Read**: Analyze competitor websites if needed
- **Write**: Save validation reports to Obsidian

## Validation Workflow

1. **Extract idea details** from user input
2. **Research competitors** (5-7 minutes) - Find 5-10 similar products
3. **Validate demand** (3-5 minutes) - Check Product Hunt, IH, Reddit, HN
4. **Assess feasibility** (2-3 minutes) - Tech stack, time estimate, MVP scope
5. **Analyze monetization** (2-3 minutes) - Pricing benchmarks, revenue models
6. **Gut check** (1-2 minutes) - Interest factor, timing, red flags
7. **Generate verdict** (1 minute) - Scores, overall rating, recommendation
8. **Save to Obsidian** (automatic) - Create report and update index

**Total time: ~15 minutes per validation**

## Red Flags to Watch For

The skill will call out:
- 🚩 "Been done 100+ times" (saturated market)
- 🚩 "People say they want it but won't pay" (false demand)
- 🚩 "Would take 8+ weeks to build" (not solo-builder friendly)
- 🚩 "Free alternatives dominate" (monetization challenge)
- 🚩 "No evidence of real demand" (solution seeking problem)
- 🚩 "Requires team/enterprise sales" (not indie-hacker viable)

## Success Factors

Ideas score high when they have:
- ✨ Clear, specific pain point
- ✨ Evidence people are paying for solutions
- ✨ 2-4 week feasibility for MVP
- ✨ Proven pricing models ($10-50/month)
- ✨ Room for differentiation
- ✨ Solo builder can compete

## Questions?

The skill is designed to be self-explanatory, but if you have questions:
1. Review the reference documents in `references/`
2. Check example validations above
3. Try validating a simple idea first to see output format

## License

See LICENSE.txt for complete terms.

---

**Ready to validate your first idea?**

Use `/validate-idea "your idea here"` or just describe your idea and ask for validation!
