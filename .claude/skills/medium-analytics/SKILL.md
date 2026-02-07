---
name: medium-analytics
description: Analyze Medium article performance through engagement metrics, discover trending content, and extract success patterns from top-performing stories
---

# Medium Analytics Skill

Discover what makes Medium articles successful by analyzing real engagement data (claps, reading time, publication stats) and extracting actionable patterns from top performers.

## Capabilities

- Fetch trending Medium articles by topic/tag with engagement metrics
- Analyze article performance with viral coefficient and engagement rates
- Extract success patterns from high-performing content (titles, timing, length)
- Compare multiple articles to identify what works
- Discover optimal publishing times and content strategies
- Identify trending topics based on real engagement data
- Track competitors (authors/publications) for continuous monitoring
- Monitor performance changes and new articles from tracked sources

## How to Use

1. **Quick Discovery**: Ask to find top articles on a specific topic
2. **Deep Analysis**: Request detailed metrics comparison for specific articles
3. **Pattern Extraction**: Ask for success patterns from high performers
4. **Competitive Research**: Analyze articles in your niche to understand what works
5. **Competitor Tracking**: Monitor specific authors or publications over time

## Input/Output Format

**Input**: Natural language requests like:
- "Find the top 10 AI articles from this week"
- "Analyze these Medium articles and compare their performance"
- "What patterns do successful AI articles have?"
- "Track @username and monitor their new articles"
- "Show me a report of all tracked competitors"

**Output**: JSON data with:
- Article metadata (title, author, publication, URL)
- Engagement metrics (claps, viral coefficient, performance tier)
- Success patterns (title formulas, optimal timing, content length)
- Actionable recommendations

## Example Usage

```
User: "Find the most successful articles about Claude AI from the last 30 days"

Claude executes: python fetch_articles.py "claude-ai anthropic" --days 30 --limit 15

Result: List of 15 articles sorted by engagement with clap counts,
        viral coefficients, and performance tiers
```

```
User: "What patterns do these top articles share?"

Claude executes: python extract_patterns.py '[article_data]'

Result: Title patterns (60% use numbers, 40% ask questions),
        optimal publishing times (Tuesday 9am),
        ideal content length (7-9 min read)
```

```
User: "Track @towardsdatascience and monitor their performance"

Claude executes: python track_competitors.py add @towardsdatascience --type publication

Later: python track_competitors.py update

Result: Updated metrics for all tracked competitors, including new articles,
        clap counts, and performance trends
```

## Scripts

- **fetch_articles.py** - Retrieves Medium articles by topic/tag using discovery + GraphQL API
- **analyze_metrics.py** - Calculates performance metrics, viral coefficients, and comparative statistics
- **extract_patterns.py** - Identifies success patterns in titles, timing, length, and content structure
- **track_competitors.py** - Monitors specific authors/publications, tracks new articles and performance changes

## Best Practices

- Use specific, focused topics for better results (e.g., "AI agents" vs "technology")
- Limit time ranges to 7-30 days for trending content analysis
- Compare articles within the same niche for meaningful insights
- Consider both quantitative metrics (claps) and qualitative patterns (titles)
- Combine with `medium-ai-writer` Skill for complete content strategy
- Cache results to minimize API calls (automatic with 1-hour TTL)

## Limitations

- Uses unofficial Medium GraphQL API (may change without notice)
- Rate limited to 30 requests/minute to avoid abuse
- Clap counts are public data only (not private draft stats)
- Historical data limited to what's accessible via RSS feeds
- Cannot access paywalled article content
- Pattern extraction requires minimum 5 articles for statistical validity
