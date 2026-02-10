#!/usr/bin/env python3
"""
Pattern Extractor for Medium Analytics Skill
Identifies success patterns in titles, timing, length, and structure
"""

import json
import sys
import re
from datetime import datetime
from typing import Dict, List
from collections import Counter

def analyze_title_patterns(articles: List[Dict]) -> Dict:
    """
    Analyze common patterns in article titles.
    """

    titles = [a.get("title", "") for a in articles]

    patterns = {
        "has_number": 0,
        "has_question": 0,
        "has_how_to": 0,
        "has_list_indicator": 0,
        "uses_power_words": 0,
        "length_stats": {
            "mean_chars": 0,
            "mean_words": 0,
            "optimal_range": "40-60 characters"
        }
    }

    power_words = ["ultimate", "essential", "complete", "definitive", "secret", "hidden", "best", "worst", "must-know"]
    list_indicators = ["ways", "things", "tips", "reasons", "steps", "methods"]

    total_chars = 0
    total_words = 0

    for title in titles:
        title_lower = title.lower()

        # Number detection
        if re.search(r'\d+', title):
            patterns["has_number"] += 1

        # Question detection
        if '?' in title or title_lower.startswith(('what', 'why', 'how', 'when', 'where', 'who')):
            patterns["has_question"] += 1

        # How-to detection
        if 'how to' in title_lower or 'how i' in title_lower:
            patterns["has_how_to"] += 1

        # List indicator detection
        if any(indicator in title_lower for indicator in list_indicators):
            patterns["has_list_indicator"] += 1

        # Power words detection
        if any(word in title_lower for word in power_words):
            patterns["uses_power_words"] += 1

        # Length stats
        total_chars += len(title)
        total_words += len(title.split())

    # Calculate averages
    count = len(titles) if titles else 1
    patterns["length_stats"]["mean_chars"] = round(total_chars / count, 1)
    patterns["length_stats"]["mean_words"] = round(total_words / count, 1)

    # Convert to percentages
    patterns["has_number_pct"] = round((patterns["has_number"] / count) * 100, 1)
    patterns["has_question_pct"] = round((patterns["has_question"] / count) * 100, 1)
    patterns["has_how_to_pct"] = round((patterns["has_how_to"] / count) * 100, 1)
    patterns["has_list_indicator_pct"] = round((patterns["has_list_indicator"] / count) * 100, 1)
    patterns["uses_power_words_pct"] = round((patterns["uses_power_words"] / count) * 100, 1)

    return patterns

def analyze_publishing_patterns(articles: List[Dict]) -> Dict:
    """
    Analyze optimal publishing times and days.
    """

    publish_times = []
    weekdays = []

    for article in articles:
        date_str = article.get("published_date")
        if date_str:
            try:
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                publish_times.append(dt.hour)
                weekdays.append(dt.strftime("%A"))
            except:
                continue

    if not publish_times:
        return {
            "optimal_hour": None,
            "optimal_day": None,
            "note": "Insufficient date data"
        }

    # Find most common publishing hour
    hour_counter = Counter(publish_times)
    optimal_hour = hour_counter.most_common(1)[0][0] if hour_counter else None

    # Find most common weekday
    day_counter = Counter(weekdays)
    optimal_day = day_counter.most_common(1)[0][0] if day_counter else None

    # Calculate distribution
    hour_distribution = dict(hour_counter.most_common(5))
    day_distribution = dict(day_counter.most_common())

    return {
        "optimal_hour": f"{optimal_hour}:00" if optimal_hour is not None else None,
        "optimal_day": optimal_day,
        "hour_distribution": hour_distribution,
        "day_distribution": day_distribution,
        "insight": f"Best publishing time: {optimal_day} at {optimal_hour}:00" if optimal_hour and optimal_day else None
    }

def analyze_content_length(articles: List[Dict]) -> Dict:
    """
    Analyze optimal content length based on performance.
    """

    length_performance = []

    for article in articles:
        reading_time = article.get("reading_time", 0)
        claps = article.get("claps", 0)

        if reading_time > 0:
            length_performance.append({
                "reading_time": reading_time,
                "claps": claps,
                "claps_per_minute": round(claps / reading_time, 2)
            })

    if not length_performance:
        return {"error": "No reading time data available"}

    # Sort by claps per minute
    length_performance.sort(key=lambda x: x["claps_per_minute"], reverse=True)

    # Get top performers' reading times
    top_5_lengths = [lp["reading_time"] for lp in length_performance[:5]]
    avg_optimal_length = round(sum(top_5_lengths) / len(top_5_lengths), 1) if top_5_lengths else 0

    # Categorize by length
    short = [lp for lp in length_performance if lp["reading_time"] <= 3]
    medium = [lp for lp in length_performance if 4 <= lp["reading_time"] <= 7]
    long = [lp for lp in length_performance if lp["reading_time"] >= 8]

    def avg_claps(articles):
        return round(sum(a["claps"] for a in articles) / len(articles), 0) if articles else 0

    return {
        "optimal_length_minutes": avg_optimal_length,
        "length_categories": {
            "short (1-3 min)": {
                "count": len(short),
                "avg_claps": avg_claps(short)
            },
            "medium (4-7 min)": {
                "count": len(medium),
                "avg_claps": avg_claps(medium)
            },
            "long (8+ min)": {
                "count": len(long),
                "avg_claps": avg_claps(long)
            }
        },
        "top_performers": length_performance[:5],
        "insight": f"Optimal reading time: {avg_optimal_length} minutes based on top performers"
    }

def analyze_publication_impact(articles: List[Dict]) -> Dict:
    """
    Analyze impact of being published in a publication vs self-published.
    """

    publications = Counter()
    publication_performance = {}

    for article in articles:
        pub = article.get("publication", "Self-published")
        claps = article.get("claps", 0)

        publications[pub] += 1

        if pub not in publication_performance:
            publication_performance[pub] = []
        publication_performance[pub].append(claps)

    # Calculate average claps per publication
    pub_stats = {}
    for pub, clap_list in publication_performance.items():
        pub_stats[pub] = {
            "article_count": len(clap_list),
            "avg_claps": round(sum(clap_list) / len(clap_list), 0),
            "total_claps": sum(clap_list)
        }

    # Sort by average claps
    sorted_pubs = sorted(pub_stats.items(), key=lambda x: x[1]["avg_claps"], reverse=True)

    return {
        "total_publications": len(publications),
        "publication_stats": dict(sorted_pubs[:5]),  # Top 5 publications
        "insight": f"Top publication: {sorted_pubs[0][0]} with avg {sorted_pubs[0][1]['avg_claps']} claps" if sorted_pubs else None
    }

def generate_success_formula(patterns: Dict) -> Dict:
    """
    Generate a success formula based on extracted patterns.
    """

    title_patterns = patterns.get("title_patterns", {})
    publishing = patterns.get("publishing_patterns", {})
    content_length = patterns.get("content_length", {})

    formula = []

    # Title recommendations
    if title_patterns.get("has_number_pct", 0) > 50:
        formula.append("Use numbers in titles (found in 50%+ of successful articles)")

    if title_patterns.get("has_how_to_pct", 0) > 30:
        formula.append("Consider 'How to' format (popular among top performers)")

    if title_patterns.get("has_question_pct", 0) > 40:
        formula.append("Ask questions in titles to boost engagement")

    # Publishing recommendations
    if publishing.get("optimal_day"):
        formula.append(f"Publish on {publishing['optimal_day']}s for maximum reach")

    if publishing.get("optimal_hour"):
        formula.append(f"Optimal posting time: {publishing['optimal_hour']}")

    # Length recommendations
    optimal_length = content_length.get("optimal_length_minutes")
    if optimal_length:
        formula.append(f"Target {optimal_length} minute read time for best engagement")

    return {
        "success_formula": formula,
        "formula_strength": "strong" if len(formula) >= 4 else "moderate",
        "confidence": f"{len(formula)}/6 factors identified"
    }

def extract_patterns(articles: List[Dict]) -> Dict:
    """
    Main pattern extraction function.
    Analyzes all aspects and generates comprehensive insights.
    """

    if not articles:
        return {"error": "No articles provided for pattern extraction"}

    if len(articles) < 5:
        return {
            "error": "Insufficient data for pattern extraction",
            "note": "Minimum 5 articles required for statistical validity"
        }

    patterns = {
        "total_articles_analyzed": len(articles),
        "title_patterns": analyze_title_patterns(articles),
        "publishing_patterns": analyze_publishing_patterns(articles),
        "content_length": analyze_content_length(articles),
        "publication_impact": analyze_publication_impact(articles),
        "timestamp": datetime.now().isoformat()
    }

    # Generate success formula
    patterns["success_formula"] = generate_success_formula(patterns)

    # Generate summary insights
    patterns["key_insights"] = generate_summary_insights(patterns)

    return patterns

def generate_summary_insights(patterns: Dict) -> List[str]:
    """Generate high-level summary insights"""

    insights = []

    # Title insight
    title = patterns["title_patterns"]
    if title.get("has_number_pct", 0) > 60:
        insights.append(f"Numbers are highly effective: {title['has_number_pct']}% of top articles use them")

    # Publishing insight
    pub = patterns["publishing_patterns"]
    if pub.get("insight"):
        insights.append(pub["insight"])

    # Length insight
    length = patterns["content_length"]
    if length.get("insight"):
        insights.append(length["insight"])

    # Publication insight
    pub_impact = patterns["publication_impact"]
    if pub_impact.get("insight"):
        insights.append(pub_impact["insight"])

    return insights

def main():
    """Main execution function"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Please provide article data to analyze",
            "usage": "python extract_patterns.py '[article_json_array]'"
        }, indent=2))
        sys.exit(1)

    try:
        articles_json = sys.argv[1]
        articles = json.loads(articles_json)

        if not isinstance(articles, list):
            articles = [articles]

        result = extract_patterns(articles)
        print(json.dumps(result, indent=2))

    except json.JSONDecodeError as e:
        print(json.dumps({
            "error": f"Invalid JSON data: {str(e)}",
            "usage": "Provide article data as JSON array"
        }, indent=2))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "error": str(e)
        }, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
