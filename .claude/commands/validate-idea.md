# Validate Idea Command

Use the Idea Validator skill to get brutally honest feedback on an app idea before investing time building.

## Arguments
- `[idea]` (required) - Brief description of the app idea to validate

## Examples
```bash
/validate-idea "A tool for Discord community management"
/validate-idea "Local-first note-taking app with AI features"
/validate-idea "Invoice tracker for freelancers"
```

## What This Does

The Idea Validator skill performs comprehensive analysis:

1. **Market Research**: Find and analyze 5-10 similar products
2. **Demand Validation**: Check Product Hunt, Indie Hackers, Reddit, HackerNews
3. **Feasibility Check**: Estimate time, tech stack, and complexity
4. **Monetization Analysis**: Research pricing and revenue models
5. **Interest Factor**: Honest gut check on idea appeal

## Output

You'll get:
- 🎯 **Quick Verdict**: Build it (🟢), Maybe (🟡), or Skip it (🔴)
- 📊 **Scores**: Market, Demand, Feasibility, Monetization, Interest (1-10)
- 🔍 **Competitor List**: Similar products with URLs and pricing
- 💡 **Demand Evidence**: Real signals from communities
- ⚙️ **Tech Stack**: Required technologies and time estimate
- 💰 **Pricing Benchmark**: What similar products charge
- 🚀 **Improvement Ideas**: How to make it stronger

## Where Reports Are Saved

All validation reports are automatically saved to your Obsidian vault:

```
/Users/alekdob/Documents/Obsidian Vault/11 - Idea Validation/
```

Filename format: `[YYYY-MM-DD] - [Idea Name].md`

An index file (`README.md`) tracks all validated ideas sorted by verdict.

## Scoring System

- **8.0-10.0**: 🟢 Build it - Strong opportunity worth pursuing
- **5.0-7.9**: 🟡 Maybe - Proceed with caution, validate further
- **1.0-4.9**: 🔴 Skip it - Not worth the time, move on

## Philosophy

Better to hear "this has been done 100 times" now than after building for a month.

The validator is brutally honest - it will call out weak demand, oversaturated markets, and monetization challenges. Use this before starting any new project to avoid wasting time on ideas nobody wants.

---

*Powered by Idea Validator Skill*
