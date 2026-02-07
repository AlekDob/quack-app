#!/usr/bin/env python3
"""
Article Fetcher for Medium Analytics Skill
Retrieves Medium articles with engagement metrics via GraphQL API
"""

import json
import sys
import time
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import requests

# Medium GraphQL API endpoint
MEDIUM_GRAPHQL_API = "https://medium.com/_/graphql"

# Rate limiting configuration
RATE_LIMIT_REQUESTS = 30  # requests per minute
RATE_LIMIT_WINDOW = 60  # seconds

# Cache configuration
CACHE = {}
CACHE_TTL = 3600  # 1 hour for article data

class RateLimiter:
    """Simple rate limiter to avoid overwhelming Medium's API"""

    def __init__(self, max_requests: int, window: int):
        self.max_requests = max_requests
        self.window = window
        self.requests = []

    def wait_if_needed(self):
        """Wait if we've hit the rate limit"""
        now = time.time()

        # Remove old requests outside the window
        self.requests = [req for req in self.requests if now - req < self.window]

        if len(self.requests) >= self.max_requests:
            # Calculate wait time
            oldest_request = min(self.requests)
            wait_time = self.window - (now - oldest_request)
            if wait_time > 0:
                time.sleep(wait_time)
                self.requests = []

        self.requests.append(now)

# Global rate limiter
rate_limiter = RateLimiter(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)

def get_cache_key(topic: str, days: int, limit: int) -> str:
    """Generate cache key for request"""
    key_string = f"{topic}_{days}_{limit}"
    return hashlib.md5(key_string.encode()).hexdigest()

def get_cached_data(cache_key: str) -> Optional[Dict]:
    """Retrieve cached data if still valid"""
    if cache_key in CACHE:
        cached_time, data = CACHE[cache_key]
        if time.time() - cached_time < CACHE_TTL:
            return data
    return None

def set_cached_data(cache_key: str, data: Dict):
    """Store data in cache"""
    CACHE[cache_key] = (time.time(), data)

def extract_post_id(url: str) -> Optional[str]:
    """Extract post ID from Medium URL"""
    # Medium URLs format: https://medium.com/@user/title-postId
    parts = url.split('-')
    if parts:
        post_id = parts[-1]
        return post_id
    return None

def get_clap_count(post_id: str) -> int:
    """Fetch clap count for a specific post via GraphQL API"""

    rate_limiter.wait_if_needed()

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

    try:
        response = requests.post(
            MEDIUM_GRAPHQL_API,
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

def search_medium_by_tag(tag: str, limit: int = 10) -> List[Dict]:
    """
    Search Medium articles by tag using the tag/archive approach.
    Uses Medium's archive URL format to discover articles.
    """
    articles = []

    try:
        # Medium tag archive URL (shows recent popular articles for that tag)
        tag_url = f"https://medium.com/tag/{tag}"

        rate_limiter.wait_if_needed()

        response = requests.get(tag_url, timeout=15)

        if response.status_code == 200:
            # Parse the response to extract article URLs
            # Medium embeds article data in script tags
            html_content = response.text

            # Extract article URLs from the HTML
            # Look for patterns like: "https://medium.com/.*-[a-f0-9]{12}"
            import re
            url_pattern = r'https://medium\.com/[^"]*-([a-f0-9]{12})"'
            matches = re.findall(url_pattern, html_content)

            seen_ids = set()
            for post_id in matches:
                if post_id not in seen_ids and len(articles) < limit:
                    seen_ids.add(post_id)

                    # Reconstruct URL (simplified - actual URL might differ)
                    article_url = f"https://medium.com/p/{post_id}"

                    articles.append({
                        "post_id": post_id,
                        "url": article_url,
                        "discovered_from": "tag_search"
                    })

    except Exception as e:
        print(f"Warning: Failed to search tag {tag}: {str(e)}", file=sys.stderr)

    return articles[:limit]

def search_medium_articles(
    topic: str,
    days: int = 30,
    limit: int = 10
) -> List[Dict]:
    """
    Search for Medium articles on a specific topic.
    Uses tag-based discovery + GraphQL API for engagement metrics.
    """

    # Check cache first
    cache_key = get_cache_key(topic, days, limit)
    cached_result = get_cached_data(cache_key)
    if cached_result:
        return cached_result

    # Convert topic to tag format (replace spaces with hyphens)
    tag = topic.lower().replace(' ', '-')

    # Discover articles by tag
    discovered_articles = search_medium_by_tag(tag, limit * 2)  # Get extra for filtering

    articles = []
    cutoff_date = datetime.now() - timedelta(days=days)

    for article_stub in discovered_articles:
        if len(articles) >= limit:
            break

        post_id = article_stub["post_id"]

        try:
            # Fetch clap count via GraphQL
            rate_limiter.wait_if_needed()

            claps = get_clap_count(post_id)

            # Try to get additional metadata via Medium's API
            # (In a production system, you'd scrape the article page)
            article_data = {
                "post_id": post_id,
                "url": article_stub["url"],
                "title": f"Article {post_id[:8]}",  # Placeholder
                "author": "Unknown",  # Would be scraped from article page
                "publication": "Medium",  # Would be scraped from article page
                "published_date": datetime.now().isoformat(),  # Placeholder
                "reading_time": 5,  # Placeholder
                "claps": claps,
                "topic": topic,
                "fetched_at": datetime.now().isoformat()
            }

            articles.append(article_data)

        except Exception as e:
            print(f"Warning: Failed to process article {post_id}: {str(e)}", file=sys.stderr)
            continue

    # Cache results
    set_cached_data(cache_key, articles)

    return articles

def fetch_articles(
    topic: str,
    days: int = 30,
    limit: int = 10,
    sort_by: str = "claps"
) -> Dict:
    """
    Main function to fetch and return Medium articles with engagement data.

    Args:
        topic: Search topic or tag
        days: Number of days to look back
        limit: Maximum number of articles to return
        sort_by: Sorting criteria (claps, date)

    Returns:
        Dictionary with article list and metadata
    """

    articles = search_medium_articles(topic, days, limit)

    # Sort articles
    if sort_by == "claps":
        articles.sort(key=lambda x: x.get("claps", 0), reverse=True)
    elif sort_by == "date":
        articles.sort(key=lambda x: x.get("published_date", ""), reverse=True)

    return {
        "topic": topic,
        "days": days,
        "limit": limit,
        "sort_by": sort_by,
        "total_found": len(articles),
        "articles": articles,
        "timestamp": datetime.now().isoformat(),
        "note": "Uses tag-based discovery + GraphQL API. Full article metadata requires scraping individual article pages."
    }

def main():
    """Main execution function"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Please provide a topic to search",
            "usage": "python fetch_articles.py 'topic' [--days N] [--limit N] [--sort claps|date]"
        }, indent=2))
        sys.exit(1)

    topic = sys.argv[1]
    days = 30
    limit = 10
    sort_by = "claps"

    # Parse arguments
    for i, arg in enumerate(sys.argv[2:], 2):
        if arg == "--days" and i < len(sys.argv) - 1:
            days = int(sys.argv[i + 1])
        elif arg == "--limit" and i < len(sys.argv) - 1:
            limit = int(sys.argv[i + 1])
        elif arg == "--sort" and i < len(sys.argv) - 1:
            sort_by = sys.argv[i + 1]

    try:
        result = fetch_articles(topic, days, limit, sort_by)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "topic": topic
        }, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
