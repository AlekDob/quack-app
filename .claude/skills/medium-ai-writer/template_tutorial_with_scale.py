#!/usr/bin/env python3
"""
Tutorial with Scale Template
Based on "How Netflix Built a Real-Time Distributed Graph" (624 claps)

This template creates articles that blend:
- Clear technical tutorials
- Real-world production scale
- Specific metrics and numbers
- Multi-part series structure
- Lessons learned from challenges
"""

import json
from typing import Dict, List

def generate_template(
    topic: str,
    company_or_brand: str,
    scale_metric: str
) -> Dict:
    """
    Generate Tutorial with Scale article structure.

    Args:
        topic: Technical topic (e.g., "Real-Time Graph", "ERP System")
        company_or_brand: Your company/brand (e.g., "Flow", "Netflix")
        scale_metric: Scale indicator (e.g., "8 countries", "1M requests/sec")

    Returns:
        Complete article structure with blueprint
    """

    template = {
        "pattern_name": "Tutorial with Scale",
        "inspiration": "Netflix - How We Built a Real-Time Distributed Graph (624 claps)",
        "key_success_factors": [
            "Brand authority in title",
            "Specific scale metrics (1M/sec, Internet Scale)",
            "Multi-part series promise",
            "Clear diagrams (3+ architectural visuals)",
            "Lessons learned section ('The Hard Way')"
        ],

        "title_formula": {
            "pattern": "How and Why [Brand] Built [Topic]: Part [N] — [Specific Aspect] at [Scale]",
            "examples": [
                f"How and Why {company_or_brand} Built {topic}: Part 1 — Implementation at {scale_metric}",
                f"Building {topic} at Scale: Lessons from {company_or_brand}",
                f"{topic} in Production: How {company_or_brand} Handles {scale_metric}"
            ],
            "length": "Can exceed 60 chars - specificity matters more",
            "seo_title": f"{topic} at Scale: {company_or_brand} Guide"
        },

        "structure": {
            "author_credits": {
                "format": "Authors: [Name 1] and [Name 2]",
                "purpose": "Build credibility and attribution",
                "placement": "Before introduction"
            },

            "series_context": {
                "format": "Italicized note about multi-part series",
                "example": "This is the first entry of a multi-part blog series...",
                "purpose": "Create anticipation for future content",
                "placement": "Top of introduction"
            },

            "introduction": {
                "subsections": [
                    {
                        "name": "Business Context",
                        "purpose": "Explain WHY this was needed",
                        "format": "Real-world scenario",
                        "example": "Our business evolved from X to Y, creating new challenges",
                        "length": "200-300 words"
                    },
                    {
                        "name": "The Problem",
                        "purpose": "Define the challenge clearly",
                        "format": "Concrete example with user journey",
                        "visual": "Simple scenario diagram",
                        "includes": "Numbered steps, specific example (e.g., Stranger Things)"
                    },
                    {
                        "name": "Why Existing Solutions Failed",
                        "purpose": "Justify custom approach",
                        "format": "Bullet list of limitations",
                        "examples": [
                            "Microservices benefits that became drawbacks",
                            "Data isolation problems",
                            "Manual stitching complexity"
                        ]
                    },
                    {
                        "name": "Why We Chose This Approach",
                        "purpose": "Decision rationale",
                        "format": "Bullet list of advantages",
                        "includes": [
                            "Relationship-centric queries",
                            "Flexibility as relationships grow",
                            "Pattern detection capabilities"
                        ]
                    }
                ]
            },

            "technical_sections": [
                {
                    "section_name": "Architecture Overview",
                    "format": "H2 + high-level explanation",
                    "required_elements": [
                        "List of main layers/components",
                        "High-level architecture diagram",
                        "Focus statement (what THIS post covers)"
                    ],
                    "example": "Three main layers: Ingestion, Storage, Serving",
                    "diagram": "System architecture overview"
                },
                {
                    "section_name": "Core Technology Choice",
                    "format": "H2 + technology explanation",
                    "required_elements": [
                        "Why this technology (Kafka, Flink, etc.)",
                        "Specific benefits for use case",
                        "Scale metrics (1M messages/sec)",
                        "Configuration details"
                    ],
                    "example": "Kafka as the Ingestion Backbone",
                    "includes": ["Durability", "Replayability", "Platform support"]
                },
                {
                    "section_name": "Implementation Details",
                    "format": "H2 + step-by-step process",
                    "required_elements": [
                        "Detailed flow diagram",
                        "Numbered steps or bullet points",
                        "Specific technical decisions",
                        "Code samples or configuration examples"
                    ],
                    "diagram": "Detailed flow diagram",
                    "example": "Processing Data with Apache Flink",
                    "specificity": "Mention exact frameworks, versions, patterns"
                },
                {
                    "section_name": "Scaling Challenges",
                    "format": "H2 + lessons learned",
                    "title_pattern": "From [Simple] to [Complex]: Scaling [Tech] the Hard Way",
                    "required_elements": [
                        "What didn't work initially",
                        "Why it failed (operational headaches)",
                        "How we pivoted",
                        "Trade-offs of new approach"
                    ],
                    "example": "From One Job to Many: Scaling Flink the Hard Way",
                    "tone": "Honest about failures, clear about solutions"
                }
            ],

            "metrics_sections": {
                "placement": "Throughout technical sections",
                "format": "Bold numbers with context",
                "examples": [
                    "**1 million messages per second**",
                    "**5 million records per second**",
                    "Hundreds of microservices",
                    "8 European countries"
                ],
                "purpose": "Demonstrate real production scale"
            },

            "acknowledgements": {
                "placement": "Before conclusion",
                "format": "H2 'Acknowledgements'",
                "purpose": "Show collaboration and humility",
                "content": "Thank platform teams, collaborators, infrastructure",
                "tone": "Generous and specific"
            },

            "conclusion": {
                "format": "Series teaser",
                "pattern": "Thanks for Season [N]; stay tuned for Season [N+1] where we'll cover [Next Topic]",
                "purpose": "Create anticipation for next part",
                "example": "Stay tuned for Season 2: Storage Layer",
                "includes": "Clear promise of what's coming"
            }
        },

        "visual_requirements": {
            "minimum_diagrams": 3,
            "types": [
                "User scenario diagram (introduction)",
                "High-level architecture diagram",
                "Detailed flow diagram with steps",
                "Optional: comparison diagrams, before/after"
            ],
            "style": "Clean, professional, clearly labeled",
            "purpose": "Technical readers need to SEE the architecture"
        },

        "writing_guidelines": {
            "length": "7 minutes (1400-1800 words)",
            "tone": "Professional but accessible",
            "paragraph_structure": "Mix short (2-3 sentences) and detailed (5-6 sentences)",
            "use_of_lists": "Heavy - make content scannable",
            "code_samples": "Optional but valuable if relevant",
            "metrics_frequency": "Every major section should have numbers",
            "jargon_level": "Technical but explain complex terms"
        },

        "engagement_elements": {
            "real_world_scenario": {
                "placement": "Introduction",
                "format": "Numbered user journey",
                "example": "Member watches on phone, then TV, then plays game",
                "purpose": "Make abstract technical concepts concrete"
            },
            "lessons_learned": {
                "section_title": "Scaling [X] the Hard Way",
                "honesty": "Admit what didn't work first",
                "value": "Show the evolution of thinking",
                "purpose": "Readers learn from your mistakes"
            },
            "series_promise": {
                "frequency": "Mention in intro AND conclusion",
                "specificity": "Tell exactly what next parts cover",
                "purpose": "Build loyal readership"
            },
            "team_recognition": {
                "acknowledgements_section": true,
                "author_credits": true,
                "purpose": "Show it's a team effort, build community"
            }
        },

        "what_to_avoid": [
            "Being vague about scale or metrics",
            "Skipping the 'why' for the 'how'",
            "Over-simplifying - readers want real technical depth",
            "Ignoring failures and pivots",
            "Making it seem too easy",
            "Forgetting the business context"
        ],

        "tags_strategy": {
            "primary": f"{topic.lower().replace(' ', '-')}",
            "secondary": "software-architecture",
            "tertiary": ["big-data", "data-engineering", "system-design"],
            "note": "Use architecture + domain tags for technical audience"
        },

        "multi_part_series_structure": {
            "part_1": "Context + First layer (often ingestion/processing)",
            "part_2": "Second layer (storage, database)",
            "part_3": "Third layer (serving, querying, API)",
            "optional_part_4": "Operations, monitoring, lessons learned",
            "purpose": "Each part is self-contained but builds on previous"
        }
    }

    return template

def generate_example_outline(
    topic: str = "Real-Time Agent Skills System",
    company: str = "Flow",
    scale: str = "8 European Countries"
) -> str:
    """Generate concrete example outline."""
    outline = f"""
# Example: Tutorial with Scale Article

Title: How and Why {company} Built {topic}: Part 1 — Processing Skills at Scale

Authors: [Your Name] and [Co-Author if applicable]

## Structure:

_This is the first entry of a multi-part blog series describing how we built {topic} for {scale}. In Part 1, we discuss the motivation and the processing pipeline._

### Introduction

**Business Context:**
{company}'s operations span {scale}. Our software needs to adapt to multiple regulations, languages, and workflows. When Anthropic released Agent Skills, we saw an opportunity to revolutionize our AI integration.

**The Problem:**
[DIAGRAM: User journey across countries]
1. German user invokes an agent skill
2. System needs to validate GDPR compliance
3. Agent skill processes in real-time
4. Result must be stored for audit in local jurisdiction

Why traditional approaches failed:
- Microservices created data silos
- Manual compliance checks were error-prone
- Scalability was a constant challenge

Why we chose Agent Skills:
- Progressive disclosure reduced token costs
- Built-in validation hooks for compliance
- Easier to maintain than MCP servers

### Architecture Overview

[DIAGRAM: Three-layer system architecture]

Three main layers:
1. **Ingestion & Processing** ← THIS POST
2. Storage (covered in Part 2)
3. Serving (covered in Part 3)

### Kafka as the Event Backbone

We process **50,000 skill invocations per second** across our 8-country deployment.

Why Kafka:
- Durable, replayable event streams
- Natural fit with our existing infrastructure
- Strong consistency guarantees for compliance

Configuration details:
- 30-day retention for audit
- Exactly-once semantics
- Multi-region replication

### Processing Skills with Python Workers

[DIAGRAM: Detailed flow from invocation to execution]

Processing pipeline:
1. Skill invocation arrives via Kafka
2. Country-specific validator checks compliance
3. Python worker executes skill script
4. Results cached and stored
5. Audit log generated

**Key metric**: **200ms average latency** for skill execution.

### From One Worker to Many: Scaling Python the Hard Way

Initially, we had one monolithic processor. This quickly became an operational nightmare.

What failed:
- Single point of failure
- Different countries had different loads
- Tuning was impossible (CPU vs memory tradeoffs)

How we pivoted:
- 1:1 mapping from country to worker pool
- Independent scaling per jurisdiction
- Specialized compliance validators

Trade-off: More operational complexity, but much better resilience.

### Acknowledgements

Special thanks to the platform team who built our Kafka infrastructure, and to the compliance team who validated our approach across 8 legal jurisdictions.

### Conclusion

Thanks for reading Part 1 of the {topic} series. Stay tuned for Part 2, where we'll cover the storage layer handling **1TB of skill execution data daily**.

---

**Tags**: agent-skills, software-architecture, data-engineering, enterprise-software, distributed-systems

**Result**: Authoritative, specific, tutorial-like, builds series anticipation
**Expected engagement**: Technical audience, high bookmark rate, series followers
"""
    return outline

if __name__ == "__main__":
    # Generate template
    template = generate_template(
        topic="Real-Time Agent Skills System",
        company_or_brand="Flow",
        scale_metric="8 European Countries"
    )

    print(json.dumps(template, indent=2))
    print("\n" + "="*80 + "\n")
    print(generate_example_outline())
