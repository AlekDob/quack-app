#!/usr/bin/env python3
"""
Topic Analyzer for Medium AI Writer Skill
Discovers trending and evergreen topics by domain with format suggestions
"""

import json
import sys
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Topic Database (in production, this would be dynamically updated)
TOPIC_DATABASE = {
    "evergreen": {
        "ai_strategy": [
            "AI integration in legacy systems",
            "ROI measurement for AI initiatives",
            "Build vs buy decisions for AI tools",
            "AI governance and ethics frameworks",
            "Change management for AI adoption"
        ],
        "technical_implementation": [
            "Local LLM deployment strategies",
            "API integration patterns for AI services",
            "Prompt engineering best practices",
            "Context window optimization",
            "Multi-model AI architectures"
        ],
        "team_process": [
            "Building AI-first product teams",
            "AI literacy training programs",
            "Cross-functional AI collaboration",
            "AI code review processes",
            "Testing strategies for AI systems"
        ]
    },
    "trending_2025": {
        "agent_systems": [
            "AI agents in enterprise workflows",
            "Agent Skills and capabilities framework",
            "Progressive disclosure architecture",
            "MCP (Model Context Protocol) servers",
            "Multi-agent orchestration"
        ],
        "dev_tools": [
            "Vibe coding methodology",
            "Claude Code patterns and workflows",
            "Cursor IDE integration strategies",
            "AI pair programming techniques",
            "Automated refactoring with AI"
        ],
        "enterprise_apps": [
            "AI in ERP/CRM systems",
            "Intelligent automation workflows",
            "AI-powered business analytics",
            "Natural language database queries",
            "Predictive maintenance with AI"
        ]
    },
    "format_templates": {
        "tutorial": [
            "How to Build [X] with [AI Tool]",
            "Step-by-Step: Implementing [Feature] with AI",
            "From Zero to Production: [AI System] Guide"
        ],
        "experience": [
            "How We [Achieved X] with [AI Tool]",
            "Lessons from Building [System] with AI",
            "[Number] Months with [AI Tool]: What We Learned"
        ],
        "analysis": [
            "The Hidden Costs of [AI Trend]",
            "Why [Common Belief] About AI is Wrong",
            "[Tool] vs [Tool]: A Pragmatic Comparison"
        ],
        "problem_solution": [
            "Solving [Common Problem] with [AI Approach]",
            "5 Ways AI Can Fix Your [Business Process]",
            "Overcoming [Challenge] in AI Implementation"
        ]
    }
}

def analyze_topics(
    domain: str = "enterprise",
    focus: Optional[str] = None,
    trending_only: bool = False
) -> Dict:
    """
    Analyze and suggest topics based on domain and focus area.

    Args:
        domain: Industry or domain (enterprise, startup, developer, etc.)
        focus: Specific focus area (optional)
        trending_only: Only return trending topics

    Returns:
        Dictionary with topic suggestions and formats
    """

    # Get relevant topics
    topics = discover_topics(domain, focus, trending_only)

    # Score topics by potential
    scored_topics = score_topics(topics, domain)

    # Generate format suggestions
    format_suggestions = suggest_formats(scored_topics[:5])

    # Create content calendar
    content_calendar = generate_content_calendar(scored_topics[:10])

    return {
        "domain": domain,
        "focus": focus if focus else "general",
        "timestamp": datetime.now().isoformat(),
        "top_trending": scored_topics[:5] if trending_only else filter_trending(scored_topics)[:5],
        "top_evergreen": [] if trending_only else filter_evergreen(scored_topics)[:5],
        "format_suggestions": format_suggestions,
        "content_calendar": content_calendar,
        "unique_angles": generate_unique_angles(domain),
        "keywords_to_target": extract_keywords(scored_topics[:10])
    }

def discover_topics(domain: str, focus: Optional[str], trending_only: bool) -> List[Dict]:
    """Discover relevant topics based on parameters."""
    topics = []

    # Map domain to relevant categories
    domain_mapping = {
        "enterprise": ["ai_strategy", "technical_implementation", "enterprise_apps"],
        "developer": ["technical_implementation", "dev_tools", "agent_systems"],
        "product": ["ai_strategy", "team_process", "enterprise_apps"],
        "startup": ["dev_tools", "team_process", "ai_strategy"]
    }

    # Get categories for domain
    categories = domain_mapping.get(domain.lower(), ["ai_strategy", "technical_implementation"])

    # Collect evergreen topics
    if not trending_only:
        for category in TOPIC_DATABASE["evergreen"]:
            if category in categories or not focus:
                for topic in TOPIC_DATABASE["evergreen"][category]:
                    topics.append({
                        "title": topic,
                        "type": "evergreen",
                        "category": category,
                        "domain_fit": calculate_domain_fit(topic, domain)
                    })

    # Collect trending topics
    for category in TOPIC_DATABASE["trending_2025"]:
        if category in categories or not focus:
            for topic in TOPIC_DATABASE["trending_2025"][category]:
                topics.append({
                    "title": topic,
                    "type": "trending",
                    "category": category,
                    "domain_fit": calculate_domain_fit(topic, domain)
                })

    # Filter by focus if provided
    if focus:
        focus_lower = focus.lower()
        topics = [t for t in topics if focus_lower in t["title"].lower() or focus_lower in t["category"]]

    return topics

def calculate_domain_fit(topic: str, domain: str) -> float:
    """Calculate how well a topic fits the domain."""
    topic_lower = topic.lower()
    domain_lower = domain.lower()

    score = 0.5  # Base score

    # Domain-specific keywords
    domain_keywords = {
        "enterprise": ["enterprise", "legacy", "scale", "compliance", "governance"],
        "developer": ["implementation", "code", "api", "deployment", "technical"],
        "product": ["product", "team", "user", "roi", "adoption"],
        "startup": ["fast", "mvp", "iterate", "growth", "agile"]
    }

    keywords = domain_keywords.get(domain_lower, [])

    for keyword in keywords:
        if keyword in topic_lower:
            score += 0.1

    return min(score, 1.0)

def score_topics(topics: List[Dict], domain: str) -> List[Dict]:
    """Score topics by potential and relevance."""
    for topic in topics:
        # Base scoring factors
        trending_score = 1.0 if topic["type"] == "trending" else 0.5
        domain_score = topic["domain_fit"]

        # Additional scoring based on keywords
        keyword_score = 0
        high_value_keywords = ["how", "guide", "practical", "implementation", "production"]

        for keyword in high_value_keywords:
            if keyword in topic["title"].lower():
                keyword_score += 0.1

        # Calculate total score
        topic["score"] = trending_score * 0.4 + domain_score * 0.4 + keyword_score * 0.2

        # Add engagement prediction
        topic["predicted_engagement"] = predict_engagement(topic)

    # Sort by score
    topics.sort(key=lambda x: x["score"], reverse=True)

    return topics

def predict_engagement(topic: Dict) -> str:
    """Predict engagement level for a topic."""
    if topic["score"] > 0.7:
        return "high"
    elif topic["score"] > 0.5:
        return "medium"
    else:
        return "low"

def filter_trending(topics: List[Dict]) -> List[Dict]:
    """Filter for trending topics only."""
    return [t for t in topics if t["type"] == "trending"]

def filter_evergreen(topics: List[Dict]) -> List[Dict]:
    """Filter for evergreen topics only."""
    return [t for t in topics if t["type"] == "evergreen"]

def suggest_formats(topics: List[Dict]) -> List[Dict]:
    """Suggest optimal formats for top topics."""
    suggestions = []

    for topic in topics:
        topic_lower = topic["title"].lower()

        # Determine best format based on topic
        if "how" in topic_lower or "implementation" in topic_lower:
            format_type = "tutorial"
        elif "vs" in topic_lower or "comparison" in topic_lower:
            format_type = "analysis"
        elif any(word in topic_lower for word in ["lessons", "experience", "building"]):
            format_type = "experience"
        else:
            format_type = "problem_solution"

        # Get template
        templates = TOPIC_DATABASE["format_templates"][format_type]
        template = templates[0]  # Pick first template

        # Customize template for topic
        customized = template.replace("[X]", topic["title"].split()[0])
        customized = customized.replace("[AI Tool]", "your chosen tool")
        customized = customized.replace("[Feature]", "the feature")

        suggestions.append({
            "topic": topic["title"],
            "suggested_format": format_type,
            "title_template": customized,
            "estimated_read_time": "6-8 minutes",
            "target_word_count": "1500-2000"
        })

    return suggestions

def generate_content_calendar(topics: List[Dict]) -> List[Dict]:
    """Generate a content calendar with topics."""
    calendar = []
    week_num = 1

    for i, topic in enumerate(topics):
        calendar.append({
            "week": week_num,
            "topic": topic["title"],
            "type": topic["type"],
            "priority": "high" if i < 3 else "medium" if i < 7 else "low",
            "estimated_impact": topic["predicted_engagement"]
        })

        # Two articles per week for first month, then one per week
        if i < 8 and i % 2 == 1:
            week_num += 1
        elif i >= 8:
            week_num += 1

    return calendar

def generate_unique_angles(domain: str) -> List[str]:
    """Generate unique angles based on domain expertise."""
    base_angles = [
        f"Enterprise perspective on {domain} AI adoption",
        f"Multi-country implementation insights",
        f"Production-scale {domain} solutions",
        f"Cost optimization strategies for {domain}",
        f"Team transformation in {domain} organizations"
    ]

    # Add domain-specific angles
    if domain.lower() == "enterprise":
        base_angles.extend([
            "Legacy system integration strategies",
            "Compliance and governance considerations",
            "Cross-department AI coordination"
        ])
    elif domain.lower() == "developer":
        base_angles.extend([
            "Hands-on implementation guides",
            "Performance optimization techniques",
            "Real-world debugging scenarios"
        ])

    return base_angles[:5]

def extract_keywords(topics: List[Dict]) -> List[str]:
    """Extract keywords to target from topics."""
    keywords = set()

    for topic in topics:
        # Extract significant words
        words = topic["title"].lower().split()
        for word in words:
            if len(word) > 4 and word not in ["with", "from", "about", "through"]:
                keywords.add(word)

    # Add category keywords
    for topic in topics:
        if topic["category"]:
            keywords.add(topic["category"].replace("_", "-"))

    return list(keywords)[:15]

def format_output(analysis: Dict) -> str:
    """Format analysis results for display."""
    output = []
    output.append("📊 TOPIC ANALYSIS REPORT")
    output.append("=" * 50)
    output.append(f"Domain: {analysis['domain'].title()}")
    output.append(f"Focus: {analysis['focus'].title()}")
    output.append("")

    # Trending topics
    if analysis["top_trending"]:
        output.append("🔥 TOP TRENDING TOPICS:")
        for i, topic in enumerate(analysis["top_trending"], 1):
            output.append(f"{i}. {topic['title']}")
            output.append(f"   Score: {topic['score']:.2f} | Engagement: {topic['predicted_engagement']}")

    # Evergreen topics
    if analysis["top_evergreen"]:
        output.append("\n🌲 TOP EVERGREEN TOPICS:")
        for i, topic in enumerate(analysis["top_evergreen"], 1):
            output.append(f"{i}. {topic['title']}")
            output.append(f"   Score: {topic['score']:.2f} | Engagement: {topic['predicted_engagement']}")

    # Format suggestions
    output.append("\n✍️ RECOMMENDED FORMATS:")
    for suggestion in analysis["format_suggestions"][:3]:
        output.append(f"• {suggestion['suggested_format'].title()}: {suggestion['title_template']}")

    # Unique angles
    output.append("\n🎯 YOUR UNIQUE ANGLES:")
    for angle in analysis["unique_angles"][:3]:
        output.append(f"• {angle}")

    # Keywords
    output.append("\n🔑 KEYWORDS TO TARGET:")
    output.append(", ".join(analysis["keywords_to_target"][:10]))

    return '\n'.join(output)

def main():
    """Main execution function."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Please provide a domain to analyze",
            "usage": "python analyze_topics.py 'domain' [--focus area] [--trending-only] [--json]",
            "domains": ["enterprise", "developer", "product", "startup"]
        }, indent=2))
        sys.exit(1)

    domain = sys.argv[1]
    focus = None
    trending_only = False
    json_output = False

    # Parse additional arguments
    for i, arg in enumerate(sys.argv[2:], 2):
        if arg == "--focus" and i < len(sys.argv) - 1:
            focus = sys.argv[i + 1]
        elif arg == "--trending-only":
            trending_only = True
        elif arg == "--json":
            json_output = True

    try:
        analysis = analyze_topics(domain, focus, trending_only)

        if json_output:
            print(json.dumps(analysis, indent=2))
        else:
            print(format_output(analysis))

    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "domain": domain
        }, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()