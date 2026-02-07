#!/usr/bin/env python3
"""
Metrics Analyzer for Medium Analytics Skill
Calculates performance metrics and comparative statistics
"""

import json
import sys
from typing import Dict, List
from statistics import mean, stdev

def calculate_viral_coefficient(claps: int, reading_time: int) -> float:
    """
    Calculate viral coefficient: engagement per minute of content.
    Higher values indicate content that generates more engagement relative to length.
    """
    if reading_time == 0:
        return 0.0

    return claps / reading_time

def determine_performance_tier(claps: int, viral_coef: float) -> str:
    """
    Classify article performance into tiers based on claps and viral coefficient.
    """

    if claps >= 5000 and viral_coef >= 500:
        return "viral"  # Exceptional performance
    elif claps >= 2000 and viral_coef >= 200:
        return "top"  # Top 1% performer
    elif claps >= 1000 and viral_coef >= 100:
        return "strong"  # Strong performer
    elif claps >= 500 and viral_coef >= 50:
        return "moderate"  # Above average
    elif claps >= 100:
        return "emerging"  # Growing traction
    else:
        return "low"  # Limited engagement

def calculate_engagement_rate(article: Dict) -> float:
    """
    Calculate engagement rate: claps per 100 potential readers.
    This is a proxy metric - in production would use actual view counts.
    """
    # Simplified calculation - in production use real view data
    claps = article.get("claps", 0)

    # Rough estimate: viral articles get 100x claps to views ratio
    estimated_views = claps * 50  # Conservative estimate

    if estimated_views == 0:
        return 0.0

    return (claps / estimated_views) * 100

def analyze_article(article: Dict) -> Dict:
    """Analyze a single article's performance metrics"""

    claps = article.get("claps", 0)
    reading_time = article.get("reading_time", 1)

    viral_coef = calculate_viral_coefficient(claps, reading_time)
    performance_tier = determine_performance_tier(claps, viral_coef)
    engagement_rate = calculate_engagement_rate(article)

    return {
        **article,
        "metrics": {
            "claps": claps,
            "reading_time": reading_time,
            "viral_coefficient": round(viral_coef, 2),
            "performance_tier": performance_tier,
            "engagement_rate": round(engagement_rate, 2)
        }
    }

def compare_articles(articles: List[Dict]) -> Dict:
    """
    Perform comparative analysis across multiple articles.
    Returns statistical insights and identifies outliers.
    """

    if not articles:
        return {"error": "No articles to compare"}

    analyzed = [analyze_article(a) for a in articles]

    # Extract metrics for statistical analysis
    claps_list = [a["metrics"]["claps"] for a in analyzed]
    viral_coefs = [a["metrics"]["viral_coefficient"] for a in analyzed]

    # Calculate statistics
    stats = {
        "total_articles": len(analyzed),
        "claps": {
            "mean": round(mean(claps_list), 2) if claps_list else 0,
            "max": max(claps_list) if claps_list else 0,
            "min": min(claps_list) if claps_list else 0,
            "stdev": round(stdev(claps_list), 2) if len(claps_list) > 1 else 0
        },
        "viral_coefficient": {
            "mean": round(mean(viral_coefs), 2) if viral_coefs else 0,
            "max": round(max(viral_coefs), 2) if viral_coefs else 0,
            "min": round(min(viral_coefs), 2) if viral_coefs else 0
        }
    }

    # Identify performance distribution
    tiers = {}
    for article in analyzed:
        tier = article["metrics"]["performance_tier"]
        tiers[tier] = tiers.get(tier, 0) + 1

    stats["performance_distribution"] = tiers

    # Identify top performers (above 1 standard deviation)
    if len(claps_list) > 1:
        threshold = stats["claps"]["mean"] + stats["claps"]["stdev"]
        top_performers = [
            {
                "title": a.get("title", "Unknown"),
                "claps": a["metrics"]["claps"],
                "tier": a["metrics"]["performance_tier"]
            }
            for a in analyzed
            if a["metrics"]["claps"] >= threshold
        ]
    else:
        top_performers = []

    # Calculate z-scores for outlier detection
    if len(claps_list) > 1 and stats["claps"]["stdev"] > 0:
        for article in analyzed:
            claps = article["metrics"]["claps"]
            z_score = (claps - stats["claps"]["mean"]) / stats["claps"]["stdev"]
            article["metrics"]["z_score"] = round(z_score, 2)
            article["metrics"]["is_outlier"] = abs(z_score) > 2  # Beyond 2 std devs

    return {
        "articles": analyzed,
        "statistics": stats,
        "top_performers": top_performers,
        "insights": generate_insights(stats, analyzed)
    }

def generate_insights(stats: Dict, articles: List[Dict]) -> List[str]:
    """Generate actionable insights from the analysis"""

    insights = []

    # Performance distribution insight
    total = stats["total_articles"]
    dist = stats.get("performance_distribution", {})

    viral_count = dist.get("viral", 0)
    top_count = dist.get("top", 0)

    if viral_count > 0:
        insights.append(
            f"{viral_count}/{total} articles achieved viral status (5K+ claps)"
        )

    if top_count > 0:
        insights.append(
            f"{top_count}/{total} articles are top 1% performers (2K+ claps)"
        )

    # Viral coefficient insight
    mean_vc = stats["viral_coefficient"]["mean"]
    if mean_vc >= 200:
        insights.append(
            "High average viral coefficient - content is highly engaging relative to length"
        )
    elif mean_vc < 50:
        insights.append(
            "Low viral coefficient - consider shorter, more impactful content"
        )

    # Consistency insight
    if stats["claps"]["stdev"] > stats["claps"]["mean"]:
        insights.append(
            "High variance in performance - inconsistent content quality or targeting"
        )
    else:
        insights.append(
            "Consistent performance across articles - well-defined content strategy"
        )

    return insights

def main():
    """Main execution function"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Please provide article data to analyze",
            "usage": "python analyze_metrics.py '[article_json_array]' [--compare]"
        }, indent=2))
        sys.exit(1)

    # Parse article data from JSON string
    try:
        articles_json = sys.argv[1]
        articles = json.loads(articles_json)

        if not isinstance(articles, list):
            # If single article passed, wrap in list
            articles = [articles]

        compare_mode = "--compare" in sys.argv

        if compare_mode and len(articles) > 1:
            result = compare_articles(articles)
        else:
            # Analyze individual article
            result = analyze_article(articles[0]) if articles else {}

        print(json.dumps(result, indent=2))

    except json.JSONDecodeError as e:
        print(json.dumps({
            "error": f"Invalid JSON data: {str(e)}",
            "usage": "Provide article data as JSON string"
        }, indent=2))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "error": str(e)
        }, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
