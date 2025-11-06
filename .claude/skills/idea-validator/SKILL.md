---
name: idea-validator
description: Brutally honest validation of app ideas before building. This skill should be used when evaluating new product ideas to assess market viability, demand, feasibility, monetization potential, and overall interest factor. Provides quick verdict (Build it, Maybe, Skip it) with detailed analysis and competitor research.
---

# Idea Validator

This skill provides brutally honest, data-driven validation of app ideas before investing time in development.

## Purpose

Save builders from wasting weeks or months on ideas that have no market, are too crowded, can't be monetized, or are simply uninteresting. The validator provides quick, actionable feedback based on real market research, competitor analysis, and feasibility assessment.

## When to Use This Skill

Use this skill **before starting any new project or significant feature**. Ideal scenarios:

- Evaluating a new app or SaaS idea
- Considering a side project or indie hacker venture
- Deciding between multiple ideas
- Validating feature additions to existing products
- Getting a reality check before committing time

## How It Works

### Input Format

User provides an idea description, which can be:
- Brief description (e.g., "A tool for managing Discord communities")
- Detailed pitch with features and target audience
- Simple one-liner concept

### Validation Process

The skill performs comprehensive analysis across five key criteria:

#### 1. Market Analysis
- **Competitor research**: Search for existing products using web search
- **Market saturation**: Assess how crowded the space is
- **Differentiation**: Identify what makes similar products successful or unique
- **Tools**: Use `mcp__firecrawl__firecrawl_search` for competitor discovery
- **Output**: List of 5-10 similar products with URLs and brief descriptions

#### 2. Demand Validation
- **Real user signals**: Check Product Hunt, Indie Hackers, Reddit, HackerNews for actual demand
- **Pain point validation**: Verify people are actively seeking solutions
- **Distinguish**: Separate "nice to have" from "must have" problems
- **Red flags**: Ideas people say they want but never pay for
- **Tools**: Web search for community discussions, upvotes, reviews
- **Output**: Evidence of real demand or lack thereof

#### 3. Feasibility Check
- **Solo builder assessment**: Can one person build this in 2-4 weeks?
- **Technical complexity**: Required tech stack, integrations, infrastructure
- **Scope creep risk**: Likelihood of feature bloat
- **MVP viability**: What's the smallest shippable version?
- **Tools**: Technical knowledge base + time estimation
- **Output**: Time estimate (1-2 weeks, 2-4 weeks, 4-8 weeks, 8+ weeks) with reasoning

#### 4. Monetization Reality Check
- **Pricing research**: What do similar products charge?
- **Revenue models**: Subscription, one-time, freemium, ads, usage-based
- **Willingness to pay**: Historical data on what people actually pay for
- **Unit economics**: Rough estimate of CAC vs LTV viability
- **Tools**: Web search for competitor pricing pages
- **Output**: Suggested pricing model with benchmarks

#### 5. Interest Factor Gut Check
- **Compelling vs boring**: Honest assessment of idea appeal
- **Founder-market fit**: Does this excite the builder?
- **Competitive advantage**: Can a solo builder compete with established players?
- **Timing**: Is this idea too early, too late, or just right?
- **Output**: Honest gut reaction

### Output Format

Generate a comprehensive validation report with the following structure:

```markdown
# Idea Validation Report: [Idea Name]

**Date**: [YYYY-MM-DD]
**Validated by**: Claude (Idea Validator Skill)

---

## 🎯 Quick Verdict

**[🟢 Build it | 🟡 Maybe | 🔴 Skip it]**

[2-3 sentences explaining the verdict with brutal honesty]

---

## 📊 Evaluation Scores

| Criterion | Score | Notes |
|-----------|-------|-------|
| Market Opportunity | [1-10] | [Brief note] |
| Demand Validation | [1-10] | [Brief note] |
| Feasibility | [1-10] | [Brief note] |
| Monetization | [1-10] | [Brief note] |
| Interest Factor | [1-10] | [Brief note] |
| **Overall Score** | **[1-10]** | **[Weighted average]** |

---

## 🔍 Market Analysis

**Saturation Level**: [Low / Medium / High / Very High]

**Similar Existing Products**:
1. **[Product Name]** - [URL]
   - Description: [What it does]
   - Pricing: [Price point or model]
   - Differentiator: [What makes it unique]

2. [Repeat for 5-10 products]

**Key Insights**:
- [Insight about market trends]
- [Insight about competitive landscape]
- [Insight about gaps or opportunities]

---

## 💡 Demand Validation

**Evidence of Real Demand**:
- [Finding from Product Hunt / Reddit / HackerNews]
- [User pain points discovered]
- [Community discussions or requests]

**Red Flags**:
- [Any signals this is a "nice to have" vs "must have"]
- [Historical examples of similar ideas that failed]

**Demand Level**: [Strong / Moderate / Weak / No evidence]

---

## ⚙️ Feasibility Assessment

**Time Estimate**: [1-2 weeks | 2-4 weeks | 4-8 weeks | 8+ weeks | Not feasible solo]

**Technical Complexity**: [Low / Medium / High / Very High]

**Required Tech Stack**:
- Frontend: [e.g., React, Vue]
- Backend: [e.g., Node.js, Python, Rust]
- Database: [e.g., PostgreSQL, MongoDB]
- Integrations: [e.g., Stripe, Auth0]
- Infrastructure: [e.g., Vercel, AWS]

**MVP Scope**:
- [Essential feature 1]
- [Essential feature 2]
- [Essential feature 3]

**Challenges**:
- [Technical challenge 1]
- [Scope risk or complexity issue]

---

## 💰 Monetization Analysis

**Recommended Model**: [Subscription | One-time purchase | Freemium | Usage-based | Ads]

**Pricing Benchmarks**:
| Product | Model | Price |
|---------|-------|-------|
| [Competitor 1] | [Model] | [Price] |
| [Competitor 2] | [Model] | [Price] |

**Suggested Pricing**: $[X]/month or $[Y] one-time

**Revenue Potential**: [High / Medium / Low]
- [Reasoning based on market size and pricing]

**Monetization Risks**:
- [Risk 1: e.g., users expect free alternatives]
- [Risk 2: e.g., low willingness to pay]

---

## 🎨 Interest Factor

**Honest Assessment**: [Brutally honest gut reaction]

**Why This Matters (or Doesn't)**:
- [What makes this compelling or boring]
- [Founder-market fit considerations]
- [Competitive advantage for solo builder]

**Timing Check**: [Too early | Just right | Too late | Already saturated]

---

## 🚀 What Would Make This Stronger

**Differentiation Opportunities**:
1. [Specific way to stand out from competitors]
2. [Niche to focus on]
3. [Unique angle or approach]

**MVP Recommendations**:
- [Suggestion for minimal viable version]
- [Features to cut or defer]
- [Quick validation experiment to run first]

**Alternative Angles**:
- [Pivot idea 1]
- [Pivot idea 2]

---

## 🎬 Final Recommendation

[Detailed final recommendation with next steps if proceeding, or alternative directions if skipping]

---

*Generated by Idea Validator Skill*
*Saved to: [Obsidian vault path]*
```

### Workflow Steps

1. **Extract idea details** from user input
   - Identify core concept
   - Note any specific features or target audience mentioned
   - Clarify ambiguities with follow-up questions if needed

2. **Research competitors** (5-7 minutes)
   - Use `mcp__firecrawl__firecrawl_search` with queries like:
     - "[idea description] tool"
     - "[idea description] SaaS"
     - "[idea description] app alternatives"
   - Collect 5-10 similar products with URLs
   - Note pricing, features, differentiation

3. **Validate demand** (3-5 minutes)
   - Search Product Hunt for similar products and upvote counts
   - Check Indie Hackers for discussions about the problem
   - Search Reddit (r/SaaS, r/entrepreneur, r/startups) for pain points
   - Look for HackerNews discussions

4. **Assess feasibility** (2-3 minutes)
   - Break down required tech stack
   - Estimate MVP scope
   - Identify technical challenges
   - Provide time estimate

5. **Analyze monetization** (2-3 minutes)
   - Research competitor pricing
   - Identify common revenue models
   - Assess willingness to pay
   - Suggest pricing strategy

6. **Gut check** (1-2 minutes)
   - Provide honest interest factor assessment
   - Consider timing and competitive landscape
   - Note any red flags

7. **Generate verdict** (1 minute)
   - Assign scores (1-10) for each criterion
   - Calculate weighted overall score
   - Provide clear verdict: 🟢 Build it | 🟡 Maybe | 🔴 Skip it

8. **Save report to Obsidian** (automatic)
   - Create markdown file in `/Users/alekdob/Documents/Obsidian Vault/11 - Idea Validation/`
   - Filename format: `[YYYY-MM-DD] - [Idea Name].md`
   - Update index file with link to new validation

### Scoring Rubric

**Market Opportunity (1-10)**:
- 9-10: Blue ocean, clear gap, untapped niche
- 7-8: Some competition, but room for differentiation
- 4-6: Crowded market, need strong differentiator
- 1-3: Saturated, dominated by giants, no clear opportunity

**Demand Validation (1-10)**:
- 9-10: Strong evidence of active demand, people paying for solutions
- 7-8: Some demand signals, growing interest
- 4-6: Lukewarm interest, "nice to have" problem
- 1-3: No clear demand, people say they want it but don't pay

**Feasibility (1-10)**:
- 9-10: Can ship MVP in 1-2 weeks with existing skills
- 7-8: 2-4 weeks, straightforward tech stack
- 4-6: 4-8 weeks, some complexity or new skills needed
- 1-3: 8+ weeks, very complex, or requires team

**Monetization (1-10)**:
- 9-10: Clear willingness to pay, proven pricing models, good benchmarks
- 7-8: Some paying users exist, pricing model viable
- 4-6: Unclear monetization, low price points
- 1-3: No clear revenue model, free alternatives dominate

**Interest Factor (1-10)**:
- 9-10: Highly compelling, unique angle, exciting to build
- 7-8: Interesting, has potential
- 4-6: Somewhat boring or derivative
- 1-3: Dull, uninspired, or played out

**Overall Score**: Weighted average
- Market Opportunity: 25%
- Demand Validation: 30%
- Feasibility: 15%
- Monetization: 20%
- Interest Factor: 10%

**Verdict Thresholds**:
- 🟢 **Build it** (8.0+): Strong opportunity, worth pursuing
- 🟡 **Maybe** (5.0-7.9): Proceed with caution, validate further
- 🔴 **Skip it** (<5.0): Not worth the time, move on

### Index File Management

Maintain an index file at `/Users/alekdob/Documents/Obsidian Vault/11 - Idea Validation/README.md`:

```markdown
# Idea Validation Index

All validated ideas are listed below, sorted by date (newest first).

## Build It 🟢

- [[YYYY-MM-DD - Idea Name]] - Score: X.X - Brief reason

## Maybe 🟡

- [[YYYY-MM-DD - Idea Name]] - Score: X.X - Brief reason

## Skip It 🔴

- [[YYYY-MM-DD - Idea Name]] - Score: X.X - Brief reason

---

*Last updated: [YYYY-MM-DD]*
```

After generating each validation report, update this index with:
1. Add new entry to appropriate section (Build It / Maybe / Skip It)
2. Keep sorted by date (newest first)
3. Include Obsidian wiki-link `[[filename]]`, score, and one-line summary

## Best Practices

### Be Brutally Honest
- Don't sugarcoat findings
- Call out "been done 100 times" when true
- Highlight real obstacles and challenges
- Prefer harsh truth now over wasted time later

### Use Real Data
- Always use web search for competitor research
- Provide actual URLs to similar products
- Quote real pricing from competitor sites
- Reference specific community discussions or reviews

### Focus on Solo Builder Reality
- Time estimates assume one developer working solo
- Consider scope creep and feature complexity
- Account for learning curve on new technologies
- Be realistic about what's achievable in 2-4 weeks

### Monetization First
- Always research what people actually pay for
- Distinguish between "cool idea" and "viable business"
- Call out when similar products are free or freemium
- Be skeptical of monetization through ads alone

### Quick Turnaround
- Target 10-15 minute total analysis time
- Focus on most important signals
- Don't get lost in research rabbit holes
- Provide actionable verdict quickly

## Examples

### Example 1: Discord Community Manager Tool

**User Input**: "A tool for managing Discord communities with moderation, analytics, and engagement features"

**Expected Process**:
1. Search for "Discord community management tool", "Discord analytics", "Discord moderation bot"
2. Find competitors: MEE6, Dyno, Carl-bot, Server Hoster, Discord.me
3. Check Product Hunt and Reddit for demand signals
4. Assess feasibility: Discord API integration, dashboard UI, analytics engine
5. Research pricing: Most are freemium with $5-15/month premium tiers
6. Gut check: Very crowded market, dominated by established players
7. **Verdict**: 🔴 Skip it - Score 3.5/10 - Market is saturated with free alternatives

### Example 2: Local-First Note-Taking App with AI

**User Input**: "A note-taking app that runs locally with AI features for summarization and organization"

**Expected Process**:
1. Search for "local-first notes app", "AI note-taking", "private AI notes"
2. Find competitors: Obsidian, Notion, Logseq, Capacities, Reflect
3. Check demand: Strong privacy concerns, growing local-first movement
4. Assess feasibility: Electron/Tauri app, local AI models, sync challenges
5. Research pricing: $8-15/month for AI features, one-time $50-100 for local apps
6. Gut check: Interesting niche, but requires sophisticated AI integration
7. **Verdict**: 🟡 Maybe - Score 6.5/10 - Interesting angle but technically complex

### Example 3: Micro-SaaS for Freelance Invoice Tracking

**User Input**: "Simple invoice tracker for freelancers to manage payments and follow-ups"

**Expected Process**:
1. Search for "freelance invoice software", "invoice tracking", "payment reminder tool"
2. Find competitors: FreshBooks, Wave, Invoice Ninja, Bonsai, AND.CO
3. Check demand: Strong pain point, freelancers actively seeking solutions
4. Assess feasibility: CRUD app, email reminders, PDF generation - 2-3 weeks MVP
5. Research pricing: $10-30/month for basic plans
6. Gut check: Established players, but room for simpler/cheaper alternative
7. **Verdict**: 🟢 Build it - Score 7.8/10 - Feasible MVP with clear monetization path

## Tools and Resources

### Primary Research Tools
- `mcp__firecrawl__firecrawl_search`: For competitor and market research
- `WebSearch`: For general web queries when Firecrawl is unavailable
- `Read`: To analyze competitor websites if needed
- `Write`: To save validation report to Obsidian vault

### Research Targets
- Product Hunt: Product launches, upvotes, comments
- Indie Hackers: Founder discussions, revenue reports
- Reddit: r/SaaS, r/entrepreneur, r/startups, r/sideproject
- HackerNews: "Show HN" posts, comments, discussions
- Competitor websites: Pricing pages, feature lists, about pages

### References
- See `references/validation-frameworks.md` for detailed evaluation criteria
- See `references/pricing-benchmarks.md` for SaaS pricing research data
- See `references/market-signals.md` for demand validation signals

## Notes

- Total analysis time: ~15 minutes per idea
- Report generation: ~5 minutes
- Save to Obsidian automatically after completion
- Update index file with each new validation
- User can review later or during "idea review" sessions
