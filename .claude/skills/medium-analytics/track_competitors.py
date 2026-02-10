#!/usr/bin/env python3
"""
Competitor Tracker for Medium Analytics Skill
Monitors specific authors or publications for new articles and performance changes
"""

import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List
import requests
import time
import hashlib

# Configuration
TRACK_DATABASE_FILE = "competitors_tracking.json"
RATE_LIMIT_DELAY = 2  # seconds between requests

def load_tracking_database() -> Dict:
    """Load the competitors tracking database"""
    try:
        with open(TRACK_DATABASE_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {
            "competitors": [],
            "last_updated": None,
            "tracking_history": []
        }

def save_tracking_database(database: Dict):
    """Save the competitors tracking database"""
    with open(TRACK_DATABASE_FILE, 'w') as f:
        json.dump(database, f, indent=2)

def get_medium_user_rss(username: str) -> str:
    """Generate Medium RSS feed URL for a user"""
    # Medium RSS feed format: https://medium.com/feed/@username
    if username.startswith('@'):
        return f"https://medium.com/feed/{username}"
    else:
        return f"https://medium.com/feed/@{username}"

def get_publication_rss(publication: str) -> str:
    """Generate Medium RSS feed URL for a publication"""
    # Medium publication RSS: https://medium.com/feed/publication-name
    return f"https://medium.com/feed/{publication}"

def parse_rss_feed(feed_url: str) -> List[Dict]:
    """
    Parse Medium RSS feed and extract articles.
    Returns list of articles with basic metadata.
    """
    articles = []

    try:
        time.sleep(RATE_LIMIT_DELAY)  # Rate limiting

        response = requests.get(feed_url, timeout=15)

        if response.status_code == 200:
            # Parse RSS XML
            # Note: For production, use feedparser library
            # Here we do basic string parsing
            content = response.text

            # Extract title, link, pubDate from RSS items
            # This is simplified - use feedparser for robust parsing
            import re

            items = re.findall(r'<item>(.*?)</item>', content, re.DOTALL)

            for item in items:
                # Extract title
                title_match = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', item)
                title = title_match.group(1) if title_match else "Unknown"

                # Extract link
                link_match = re.search(r'<link>(.*?)</link>', item)
                link = link_match.group(1) if link_match else ""

                # Extract pubDate
                date_match = re.search(r'<pubDate>(.*?)</pubDate>', item)
                pub_date = date_match.group(1) if date_match else ""

                # Extract post ID from link
                post_id_match = re.search(r'-([a-f0-9]{12})$', link)
                post_id = post_id_match.group(1) if post_id_match else ""

                articles.append({
                    "title": title,
                    "url": link,
                    "post_id": post_id,
                    "published_date": pub_date,
                    "discovered_at": datetime.now().isoformat()
                })

    except Exception as e:
        print(f"Warning: Failed to parse RSS feed {feed_url}: {str(e)}", file=sys.stderr)

    return articles

def get_clap_count(post_id: str) -> int:
    """Fetch clap count for a post via GraphQL API"""
    if not post_id:
        return 0

    try:
        time.sleep(RATE_LIMIT_DELAY)  # Rate limiting

        query_data = [{
            "operationName": "ClapCountQuery",
            "variables": {"postId": post_id},
            "query": """query ClapCountQuery($postId: ID!) {
                postResult(id: $postId) {
                    __typename
                    ... on Post {
                        id
                        clapCount
                        __typename
                    }
                }
            }"""
        }]

        response = requests.post(
            "https://medium.com/_/graphql",
            json=query_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                result = data[0].get('data', {}).get('postResult', {})
                return result.get('clapCount', 0)
    except Exception as e:
        print(f"Warning: Failed to fetch claps for {post_id}: {str(e)}", file=sys.stderr)

    return 0

def add_competitor(identifier: str, competitor_type: str = "user") -> Dict:
    """
    Add a competitor to track.

    Args:
        identifier: Username (with @) or publication name
        competitor_type: "user" or "publication"

    Returns:
        Status message
    """
    database = load_tracking_database()

    # Check if already tracking
    for comp in database["competitors"]:
        if comp["identifier"] == identifier and comp["type"] == competitor_type:
            return {
                "status": "already_tracking",
                "message": f"Already tracking {competitor_type} '{identifier}'"
            }

    # Add new competitor
    new_competitor = {
        "identifier": identifier,
        "type": competitor_type,
        "added_at": datetime.now().isoformat(),
        "last_checked": None,
        "article_count": 0,
        "total_claps": 0
    }

    database["competitors"].append(new_competitor)
    save_tracking_database(database)

    return {
        "status": "added",
        "message": f"Now tracking {competitor_type} '{identifier}'",
        "competitor": new_competitor
    }

def remove_competitor(identifier: str) -> Dict:
    """Remove a competitor from tracking"""
    database = load_tracking_database()

    original_count = len(database["competitors"])
    database["competitors"] = [
        comp for comp in database["competitors"]
        if comp["identifier"] != identifier
    ]

    if len(database["competitors"]) < original_count:
        save_tracking_database(database)
        return {
            "status": "removed",
            "message": f"Stopped tracking '{identifier}'"
        }
    else:
        return {
            "status": "not_found",
            "message": f"'{identifier}' not found in tracking list"
        }

def check_competitor(competitor: Dict) -> Dict:
    """
    Check a competitor for new articles and engagement changes.

    Returns:
        Updated competitor data with recent articles
    """
    identifier = competitor["identifier"]
    comp_type = competitor["type"]

    # Get RSS feed
    if comp_type == "user":
        rss_url = get_medium_user_rss(identifier)
    else:
        rss_url = get_publication_rss(identifier)

    # Parse feed
    articles = parse_rss_feed(rss_url)

    # Enrich with clap counts
    for article in articles[:10]:  # Limit to 10 most recent
        if article["post_id"]:
            article["claps"] = get_clap_count(article["post_id"])
        else:
            article["claps"] = 0

    # Calculate stats
    total_claps = sum(article.get("claps", 0) for article in articles)
    avg_claps = round(total_claps / len(articles), 0) if articles else 0

    # Update competitor data
    competitor["last_checked"] = datetime.now().isoformat()
    competitor["article_count"] = len(articles)
    competitor["total_claps"] = total_claps
    competitor["avg_claps"] = avg_claps
    competitor["recent_articles"] = articles[:5]  # Store 5 most recent

    return competitor

def update_all_competitors() -> Dict:
    """Check all tracked competitors for updates"""
    database = load_tracking_database()

    if not database["competitors"]:
        return {
            "status": "no_competitors",
            "message": "No competitors are being tracked. Use 'add' command first."
        }

    updated_competitors = []

    for competitor in database["competitors"]:
        print(f"Checking {competitor['identifier']}...", file=sys.stderr)
        updated = check_competitor(competitor)
        updated_competitors.append(updated)

    # Update database
    database["competitors"] = updated_competitors
    database["last_updated"] = datetime.now().isoformat()

    # Add to history
    database["tracking_history"].append({
        "timestamp": datetime.now().isoformat(),
        "competitors_checked": len(updated_competitors)
    })

    save_tracking_database(database)

    return {
        "status": "updated",
        "competitors": updated_competitors,
        "last_updated": database["last_updated"]
    }

def get_report() -> Dict:
    """Generate a report of all tracked competitors"""
    database = load_tracking_database()

    if not database["competitors"]:
        return {
            "status": "no_competitors",
            "message": "No competitors are being tracked."
        }

    # Sort competitors by total claps
    sorted_competitors = sorted(
        database["competitors"],
        key=lambda x: x.get("total_claps", 0),
        reverse=True
    )

    return {
        "status": "success",
        "total_competitors": len(sorted_competitors),
        "last_updated": database["last_updated"],
        "competitors": sorted_competitors,
        "summary": {
            "total_articles_tracked": sum(c.get("article_count", 0) for c in sorted_competitors),
            "total_claps_combined": sum(c.get("total_claps", 0) for c in sorted_competitors),
            "top_performer": sorted_competitors[0]["identifier"] if sorted_competitors else None
        }
    }

def main():
    """Main execution function"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Please specify a command",
            "usage": "python track_competitors.py [add|remove|update|report] [args...]",
            "commands": {
                "add": "track_competitors.py add @username [--type user|publication]",
                "remove": "track_competitors.py remove @username",
                "update": "track_competitors.py update (checks all competitors)",
                "report": "track_competitors.py report (shows current status)"
            }
        }, indent=2))
        sys.exit(1)

    command = sys.argv[1].lower()

    try:
        if command == "add":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Please provide identifier to track"}, indent=2))
                sys.exit(1)

            identifier = sys.argv[2]
            comp_type = "user"

            # Check for --type flag
            if "--type" in sys.argv:
                type_index = sys.argv.index("--type")
                if type_index + 1 < len(sys.argv):
                    comp_type = sys.argv[type_index + 1]

            result = add_competitor(identifier, comp_type)
            print(json.dumps(result, indent=2))

        elif command == "remove":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Please provide identifier to remove"}, indent=2))
                sys.exit(1)

            identifier = sys.argv[2]
            result = remove_competitor(identifier)
            print(json.dumps(result, indent=2))

        elif command == "update":
            result = update_all_competitors()
            print(json.dumps(result, indent=2))

        elif command == "report":
            result = get_report()
            print(json.dumps(result, indent=2))

        else:
            print(json.dumps({
                "error": f"Unknown command '{command}'",
                "available_commands": ["add", "remove", "update", "report"]
            }, indent=2))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "command": command
        }, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
