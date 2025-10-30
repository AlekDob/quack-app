# XTerm Terminal Expert - Reference Documentation

This directory contains detailed reference documentation for XTerm.js integration.

## Files

### `rendering-issues.md`
**Comprehensive troubleshooting guide for all rendering problems**

Contains:
- 6 major rendering issues with symptoms, causes, and solutions
- Blank screen problems
- Duplicate content issues
- Character-per-line wrapping
- Agent switching bugs
- Initial zsh prompt cleanup
- Content sharing between terminals

Use when: Encountering any visual or rendering problem with terminals.

### `react-integration.md`
**React-specific patterns and best practices**

Contains:
- 8 core integration patterns
- Global instance storage
- Initialization guards
- DOM re-attachment
- Multiple terminal rendering
- Fitting on activation
- Window resize handling
- Cleanup and disposal
- Tab persistence

Use when: Implementing XTerm in React components or dealing with React lifecycle issues.

### `sizing-and-fitting.md`
**Complete guide to terminal sizing and the fit() addon**

Contains:
- Understanding XTerm's two dimension systems
- 4 sizing strategies (creation, activation, resize, layout)
- Container CSS requirements
- Dimension validation
- Troubleshooting sizing issues
- Advanced manual resize
- Comprehensive logging strategies
- Quick reference timing table

Use when: Dealing with terminal sizing, fitting problems, or dimension-related issues.

## How to Use These References

1. **Start with SKILL.md** in parent directory for overview and quick reference
2. **Dive into specific reference** when encountering issues:
   - Visual problems → `rendering-issues.md`
   - React lifecycle → `react-integration.md`
   - Sizing/fitting → `sizing-and-fitting.md`
3. **Use search** (Cmd+F) to find specific error messages or symptoms
4. **Follow code examples** - all patterns are production-tested
5. **Check checklists** at end of each file for verification

## Document Organization

Each reference file follows this structure:
- **Problem description** with symptoms
- **Root cause** explanation
- **Failed solutions** (what doesn't work)
- **Working solution** with code examples
- **Why it works** technical explanation
- **Checklists** for verification

## Production Battle-Tested

All patterns and solutions in these references come from real production debugging:
- Hours spent fighting rendering issues
- Multiple failed approaches documented
- Working solutions verified in production
- Performance implications considered
- Edge cases handled

These are not theoretical best practices - they are battle-tested solutions to real problems.

## Contributing

When encountering new XTerm issues:
1. Debug and find solution
2. Document in appropriate reference file
3. Include: symptoms, cause, failed attempts, working solution
4. Add code examples
5. Explain why it works
6. Update checklists

Keep documentation practical and example-driven.
