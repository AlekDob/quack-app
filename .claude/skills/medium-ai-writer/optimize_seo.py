#!/usr/bin/env python3
"""
SEO Optimizer for Medium AI Writer Skill
Generates Medium-compliant SEO elements with strict character validation
"""

import json
import re
import sys
from typing import Dict, List, Optional, Tuple

# Medium SEO Specifications
MEDIUM_SEO_SPECS = {
    "title": {
        "optimal_min": 40,
        "optimal_max": 50,
        "absolute_max": 60,
        "description": "SEO title for Google search results"
    },
    "description": {
        "optimal_min": 140,
        "optimal_max": 156,
        "absolute_max": 160,
        "description": "Meta description replacing subtitle in search"
    },
    "tags": {
        "max_count": 5,
        "description": "Maximum 5 tags allowed on Medium"
    }
}

def optimize_for_medium(
    content: str,
    topic: Optional[str] = None,
    current_title: Optional[str] = None
) -> Dict:
    """
    Optimize content for Medium SEO specifications.

    Args:
        content: Article content or topic to optimize
        topic: Optional topic if not in content
        current_title: Optional existing title to improve

    Returns:
        Dictionary with SEO optimizations
    """

    # Extract topic from content if not provided
    if not topic:
        topic = extract_topic(content)

    # Generate multiple title variants
    seo_titles = generate_seo_titles(topic, current_title)

    # Generate SEO description
    seo_description = generate_seo_description(topic, content)

    # Generate article title (can be longer)
    article_title = generate_article_title(topic)

    # Generate optimal tags
    tags = generate_tags(topic)

    # Analyze content structure
    structure_analysis = analyze_structure(content)

    # Calculate readability
    readability = calculate_readability(content)

    # Generate optimization report
    optimization = {
        "seo_title": seo_titles[0],
        "seo_title_variants": seo_titles,
        "seo_description": seo_description,
        "article_title": article_title,
        "tags": tags,
        "structure_recommendations": structure_analysis,
        "readability_score": readability,
        "validation": validate_seo_elements(seo_titles[0], seo_description, tags)
    }

    return optimization

def extract_topic(content: str) -> str:
    """Extract main topic from content."""
    # Simple extraction - in production would use NLP
    lines = content.split('\n')
    for line in lines:
        if line.strip() and len(line) > 10:
            # Clean and return first substantial line as topic
            return line.strip()[:100]
    return "AI Development"

def generate_seo_titles(topic: str, current_title: Optional[str] = None) -> List[Dict]:
    """Generate SEO-optimized title variants based on top performer analysis."""
    variants = []

    # Power words for engagement
    power_words = ["How", "Why", "Ultimate", "Complete", "Essential", "Best"]
    number_words = ["5", "7", "10"]

    # BLUEPRINT PATTERNS (from 689 claps + 624 claps articles)
    # Pattern 1: Contrarian Stance (Alex Suzuki style - 689 claps)
    contrarian_patterns = [
        f"Why I DON'T Use {topic}",
        f"The {topic} Anti-Pattern",
        f"{topic}: Against the Mainstream"
    ]

    # Pattern 2: Brand + Scale (Netflix style - 624 claps)
    scale_patterns = [
        f"How We Built {topic} at Scale",
        f"{topic}: Internet Scale Guide",
        f"Building {topic} for 8 Countries"
    ]

    # Pattern 3: Personal + Technical Hybrid
    hybrid_patterns = [
        f"{topic}: A Craftsman's View",
        f"Why {topic} Still Matters",
        f"The Human Side of {topic}"
    ]

    # Base patterns (original)
    base_patterns = [
        f"{topic}: A Practical Guide",
        f"How to Master {topic}",
        f"{topic} Best Practices",
        f"The Truth About {topic}",
        f"Why {topic} Matters Now"
    ]

    # Combine all patterns (blueprint first for priority)
    patterns = contrarian_patterns + scale_patterns + hybrid_patterns + base_patterns

    # Generate variants
    for pattern in patterns:
        title = pattern[:50]  # Truncate to optimal length
        char_count = len(title)

        if MEDIUM_SEO_SPECS["title"]["optimal_min"] <= char_count <= MEDIUM_SEO_SPECS["title"]["optimal_max"]:
            status = "optimal"
        elif char_count <= MEDIUM_SEO_SPECS["title"]["absolute_max"]:
            status = "acceptable"
        else:
            title = title[:MEDIUM_SEO_SPECS["title"]["absolute_max"]]
            char_count = len(title)
            status = "truncated"

        variants.append({
            "title": title,
            "char_count": char_count,
            "status": status,
            "includes_keyword": topic.lower() in title.lower()
        })

    # Sort by optimal status
    variants.sort(key=lambda x: (x["status"] == "optimal", x["includes_keyword"]), reverse=True)

    return variants[:3]  # Return top 3 variants

def generate_seo_description(topic: str, content: str) -> Dict:
    """Generate SEO meta description."""
    # Create compelling description
    base_description = f"Discover practical insights on {topic} from real enterprise deployments. "
    base_description += "Learn proven strategies, avoid common pitfalls, and accelerate implementation."

    # Adjust to optimal length
    if len(base_description) > MEDIUM_SEO_SPECS["description"]["optimal_max"]:
        base_description = base_description[:MEDIUM_SEO_SPECS["description"]["optimal_max"] - 3] + "..."

    char_count = len(base_description)

    return {
        "description": base_description,
        "char_count": char_count,
        "status": "optimal" if MEDIUM_SEO_SPECS["description"]["optimal_min"] <= char_count <= MEDIUM_SEO_SPECS["description"]["optimal_max"] else "needs_adjustment",
        "includes_keyword": topic.lower() in base_description.lower()
    }

def generate_article_title(topic: str) -> Dict:
    """Generate creative article title based on viral article blueprints."""
    # BLUEPRINT-BASED PATTERNS (from 689 + 624 claps articles)

    # Contrarian + Metaphor (Alex Suzuki pattern - 689 claps)
    contrarian_creative = [
        f"Cretaceous {topic} — Why I Don't Follow the Mainstream",
        f"The {topic} Dinosaur: Why Old Ways Still Work",
        f"Why I DON'T Use {topic} (And You Shouldn't Either)"
    ]

    # Brand + Scale + Multi-part (Netflix pattern - 624 claps)
    scale_creative = [
        f"How and Why We Built {topic}: Part 1 — Real-World Implementation at Scale",
        f"Building {topic} at Internet Scale: Lessons from 8-Country Deployment",
        f"{topic} in Production: What Works (and What Doesn't) at Scale"
    ]

    # Personal Experience + Time Commitment
    experience_creative = [
        f"I Spent 6 Months Building {topic} in Production. Here's What Actually Works",
        f"The Hidden Complexity of {topic} That Nobody Talks About",
        f"How We Scaled {topic} Across 8 Countries (And What We Learned)",
        f"{topic}: The Gap Between Documentation and Reality"
    ]

    # Combine patterns (blueprint first)
    creative_patterns = contrarian_creative + scale_creative + experience_creative

    # Pick most engaging based on topic
    title = creative_patterns[0]

    return {
        "title": title,
        "char_count": len(title),
        "note": "Article title uses viral blueprints: contrarian stance, scale hints, or personal experience",
        "pattern_type": "contrarian" if "DON'T" in title or "Cretaceous" in title else "scale" if "Scale" in title else "experience"
    }

def generate_tags(topic: str) -> List[str]:
    """Generate optimal Medium tags."""
    # Common high-performing tags
    base_tags = ["artificial-intelligence", "programming", "technology", "software-development"]

    # Topic-specific tags
    topic_words = topic.lower().split()
    topic_tags = []

    # Map common terms to Medium tags
    tag_mapping = {
        "ai": "artificial-intelligence",
        "agent": "ai-agents",
        "claude": "anthropic",
        "llm": "large-language-models",
        "enterprise": "enterprise-software",
        "automation": "automation",
        "coding": "programming",
        "development": "software-development"
    }

    for word in topic_words:
        if word in tag_mapping:
            topic_tags.append(tag_mapping[word])

    # Combine and limit to 5
    all_tags = list(set(topic_tags + base_tags))[:5]

    return all_tags

def analyze_structure(content: str) -> List[str]:
    """Analyze and recommend content structure improvements."""
    recommendations = []
    lines = content.split('\n')

    # Check hook (first 3 sentences)
    if len(lines) > 0:
        first_paragraph = ' '.join(lines[:3])
        if len(first_paragraph) > 200:
            recommendations.append("Shorten opening hook to under 200 characters")

    # Check paragraph length
    paragraphs = content.split('\n\n')
    long_paragraphs = [p for p in paragraphs if len(p.split()) > 100]
    if long_paragraphs:
        recommendations.append(f"Break up {len(long_paragraphs)} long paragraphs (keep under 100 words)")

    # Check for subheadings
    headings = [line for line in lines if line.startswith('#')]
    if len(headings) < len(content) / 1500:  # Rough estimate: heading every 1500 chars
        recommendations.append("Add more subheadings (every 300-400 words)")

    # Check for lists and formatting
    if '- ' not in content and '1. ' not in content:
        recommendations.append("Add bullet points or numbered lists for better scannability")

    if not recommendations:
        recommendations.append("Structure looks good - well organized")

    return recommendations

def calculate_readability(content: str) -> Dict:
    """Calculate readability metrics."""
    words = content.split()
    sentences = content.split('.')

    # Simple readability approximation
    avg_words_per_sentence = len(words) / max(len(sentences), 1)

    if avg_words_per_sentence < 15:
        grade = "Grade 8-10 (Optimal)"
        status = "excellent"
    elif avg_words_per_sentence < 20:
        grade = "Grade 10-12 (Good)"
        status = "good"
    else:
        grade = "Grade 12+ (Complex)"
        status = "simplify"

    return {
        "grade_level": grade,
        "status": status,
        "avg_words_per_sentence": round(avg_words_per_sentence, 1),
        "total_words": len(words)
    }

def validate_seo_elements(title: Dict, description: Dict, tags: List[str]) -> Dict:
    """Validate all SEO elements against Medium specifications."""
    validation = {
        "title": {
            "valid": title["char_count"] <= MEDIUM_SEO_SPECS["title"]["absolute_max"],
            "optimal": title["status"] == "optimal",
            "message": f"{title['char_count']} chars - {title['status']}"
        },
        "description": {
            "valid": description["char_count"] <= MEDIUM_SEO_SPECS["description"]["absolute_max"],
            "optimal": description["status"] == "optimal",
            "message": f"{description['char_count']} chars - {description['status']}"
        },
        "tags": {
            "valid": len(tags) <= MEDIUM_SEO_SPECS["tags"]["max_count"],
            "message": f"{len(tags)} tags provided (max 5)"
        }
    }

    validation["all_valid"] = all([
        validation["title"]["valid"],
        validation["description"]["valid"],
        validation["tags"]["valid"]
    ])

    validation["all_optimal"] = all([
        validation["title"]["optimal"],
        validation["description"]["optimal"]
    ])

    return validation

def format_output(optimization: Dict) -> str:
    """Format optimization results for display."""
    output = []
    output.append("✨ MEDIUM SEO OPTIMIZATIONS")
    output.append("=" * 50)

    # SEO Title
    best_title = optimization["seo_title"]
    output.append(f"\nSEO Title (for Google):")
    output.append(f'"{best_title["title"]}" ({best_title["char_count"]} chars)')
    output.append(f"✓ Status: {best_title['status']}")
    if best_title["includes_keyword"]:
        output.append("✓ Includes primary keyword")

    # SEO Description
    desc = optimization["seo_description"]
    output.append(f"\nSEO Description:")
    output.append(f'"{desc["description"]}" ({desc["char_count"]} chars)')
    output.append(f"✓ Status: {desc['status']}")

    # Article Title
    article = optimization["article_title"]
    output.append(f"\nArticle Title (for Medium):")
    output.append(f'"{article["title"]}"')
    output.append(f"Note: {article['note']}")

    # Tags
    output.append(f"\nTags: {', '.join(optimization['tags'])}")

    # Structure
    output.append("\nStructure Recommendations:")
    for rec in optimization["structure_recommendations"]:
        output.append(f"• {rec}")

    # Readability
    read = optimization["readability_score"]
    output.append(f"\nReadability: {read['grade_level']} - {read['status']}")

    # Validation
    val = optimization["validation"]
    output.append(f"\nValidation: {'✓ All optimal' if val['all_optimal'] else '⚠ Needs adjustment'}")

    return '\n'.join(output)

def main():
    """Main execution function."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Please provide content or topic to optimize",
            "usage": "python optimize_seo.py 'content or topic' [--json]"
        }, indent=2))
        sys.exit(1)

    content = sys.argv[1]
    json_output = "--json" in sys.argv

    try:
        optimization = optimize_for_medium(content)

        if json_output:
            print(json.dumps(optimization, indent=2))
        else:
            print(format_output(optimization))

    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "content_preview": content[:100] + "..."
        }, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()