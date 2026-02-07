#!/usr/bin/env python3
"""
Personal-Technical Hybrid Template
Based on "Cretaceous Software Engineering" (689 claps)

This template creates articles that blend:
- Personal storytelling and authentic voice
- Technical depth and expertise
- Contrarian or unique perspectives
- Emotional resonance with readers
"""

import json
from typing import Dict, List

def generate_template(topic: str, your_unique_stance: str) -> Dict:
    """
    Generate Personal-Technical Hybrid article structure.

    Args:
        topic: The technical topic (e.g., "AI Code Generation", "Agent Skills")
        your_unique_stance: Your personal perspective (e.g., "why I still code by hand")

    Returns:
        Complete article structure with blueprint
    """

    template = {
        "pattern_name": "Personal-Technical Hybrid",
        "inspiration": "Alex Suzuki - Cretaceous Software Engineering (689 claps)",
        "key_success_factors": [
            "Contrarian stance against mainstream",
            "Personal storytelling (family, life philosophy)",
            "Authentic emotional tone",
            "Creative metaphors (dinosaurs, Ikigai)",
            "Visual elements (2-3 evocative images)"
        ],

        "structure": {
            "hook": {
                "format": "emoji + bold personal declaration",
                "example": f"👋 Hi! I'm a {topic} skeptic.",
                "length": "1-2 sentences",
                "goal": "Intrigue and surprise the reader"
            },

            "explanation_section": {
                "purpose": "Explain your metaphor or unique angle",
                "format": "Quote from authority OR define your term",
                "example": f"Explain why {topic} reminds you of something unexpected",
                "visual": "Add image that represents your metaphor"
            },

            "main_sections": [
                {
                    "section_1": "The Core Belief",
                    "format": "H2 heading + personal conviction",
                    "example": f"Writing is thinking (applied to {topic})",
                    "includes": ["Personal experience", "Authority quote if possible"]
                },
                {
                    "section_2": "The Practical Benefit",
                    "format": "H2 heading + concrete advantage",
                    "example": f"The mental model I build working with {topic}",
                    "includes": ["Technical insight", "Future productivity payoff"]
                },
                {
                    "section_3": "Current Reality Check",
                    "format": "H2 heading + honest assessment",
                    "example": f"I don't feel unproductive without {topic}",
                    "includes": ["Self-awareness", "Acknowledgment of alternatives"]
                },
                {
                    "section_4": "The Emotional Truth",
                    "format": "H2 heading + vulnerability",
                    "example": f"It doesn't excite me",
                    "includes": ["Personal admission", "Why it's OK to feel this way"]
                },
                {
                    "section_5": "Broader Implications",
                    "format": "H2 heading + future concern",
                    "example": f"What {topic} means for the next generation",
                    "includes": ["Family story", "Societal impact"]
                },
                {
                    "section_6": "The Cultural Perspective",
                    "format": "H2 heading + values statement",
                    "example": f"What I don't like about {topic} ecosystem",
                    "includes": ["Ethical concerns", "Broader web/industry impact"]
                },
                {
                    "section_7": "The Simple Truth",
                    "format": "H2 heading + core reason",
                    "example": f"I simply enjoy [alternative to {topic}]",
                    "includes": ["Joy", "Passion", "Ikigai concept if applicable"]
                }
            ],

            "personal_philosophy_section": {
                "title": "Finding your passion",
                "format": "H2 + personal framework",
                "visual_element": "Ikigai diagram or similar philosophical concept",
                "content": "Connect your stance to a broader life philosophy",
                "example": "How Japanese Ikigai explains my choice"
            },

            "conclusion": {
                "format": "Extended metaphor callback + open ending",
                "tone": "Resilient but realistic",
                "example": f"The {topic} era is coming. I shall continue my way.",
                "visual": "Dramatic image (asteroid, sunset, etc.)",
                "key_element": "Acknowledge change but maintain your stance"
            },

            "optional_hope_section": {
                "purpose": "Balance the contrarian stance",
                "format": "Brief paragraph of optimism",
                "example": "Maybe it's not the craft itself, but the learning",
                "tone": "Thoughtful, not defeated"
            }
        },

        "writing_guidelines": {
            "length": "6-7 minutes (1200-1500 words)",
            "tone": "Personal, authentic, slightly vulnerable",
            "paragraph_structure": "Short paragraphs (3-4 sentences max)",
            "use_of_quotes": "1-2 from authorities to add credibility",
            "visual_elements": "2-3 images minimum (metaphor, concept diagram, dramatic scene)",
            "emoji_usage": "Sparingly in hook only",
            "contrarian_balance": "Acknowledge mainstream view before contradicting it"
        },

        "engagement_elements": {
            "contrarian_hook": "State an unpopular opinion clearly",
            "personal_stories": [
                "Family anecdote (children, partner)",
                "Career evolution",
                "Cultural background (Japanese, Italian, etc.)"
            ],
            "emotional_moments": [
                "Vulnerability about devaluing your craft",
                "Joy in doing things the 'old way'",
                "Concern for future generations"
            ],
            "authority_building": [
                "Quote from respected institution (ETH, etc.)",
                "Reference to philosophy (Ikigai)",
                "Personal expertise credentials"
            ]
        },

        "what_to_avoid": [
            "Being preachy or judgmental",
            "Ignoring the mainstream benefits completely",
            "Long technical explanations",
            "Generic statements without personal examples",
            "Ending with defeat or pessimism"
        ],

        "tags_strategy": {
            "primary": f"{topic.lower().replace(' ', '-')}",
            "secondary": "software-engineering" if "code" in topic.lower() else "technology",
            "tertiary": "programming" if "development" in topic.lower() else "artificial-intelligence",
            "note": "Keep tags broad for maximum reach"
        }
    }

    return template

def generate_example_outline(topic: str = "AI Code Generation") -> str:
    """Generate a concrete example outline."""
    outline = f"""
# Example: Personal-Technical Hybrid Article

Topic: {topic}
Stance: "Why I Still Code by Hand"

## Structure:

👋 Hi! I'm a Manual Coding Advocate.

### The Dinosaur Explanation
> In software development, there's a new divide: those who use AI to write their code, and those who don't. I'm proudly in the latter camp, and here's why.

[IMAGE: Dinosaur/craftsman visual]

### Section 1: Coding is Thinking
Quote from computer science professor about how writing code creates mental models.
Personal experience: when I generate code with AI, I lose the mental model.

### Section 2: The Mental Model Investment
Explaining how "the hard way" is a down payment for future productivity.
Example from maintaining complex systems.

### Section 3: I Don't Feel Unproductive
Honest assessment: I was productive before AI coding tools.
Acknowledgment: Maybe I'm "holding it wrong" but no urge to explore further.

### Section 4: It Doesn't Excite Me
Personal admission about lack of excitement for generated code.
Contrast with what DOES excite about coding.

### Section 5: Concern for My Craft
Story about teaching your child to code.
Hesitation now that didn't exist before.
Honest vulnerability: "have I devalued my own craft?"

### Section 6: The Ecosystem Impact
Broader concerns about code quality, authenticity.
Reference to "enslopification" of the web.

### Section 7: The Simple Joy
"I simply enjoy writing code."
That's reason enough.

### Finding Your Ikigai
[IKIGAI DIAGRAM]
Connection to Japanese concept of purpose.
Rare to find work that checks all boxes.

### Conclusion
The era of manual coding is ending. I shall continue to bang these rocks together.

[DRAMATIC IMAGE]

But maybe I'll find new crafts to learn along the way.

---

**Result**: Personal, authentic, technically credible, emotionally resonant.
**Expected engagement**: High comments, strong emotional responses, shared widely.
"""
    return outline

if __name__ == "__main__":
    # Generate template
    template = generate_template(
        topic="AI Code Generation",
        your_unique_stance="I code by hand because writing is thinking"
    )

    print(json.dumps(template, indent=2))
    print("\n" + "="*80 + "\n")
    print(generate_example_outline())
