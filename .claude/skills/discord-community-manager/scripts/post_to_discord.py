#!/usr/bin/env python3
"""
Discord Webhook Poster

This script posts messages to Discord webhooks with proper JSON escaping,
emoji support, and image attachments.

Usage:
    python3 post_to_discord.py "Your message here"
    python3 post_to_discord.py "Your message here" --image /path/to/image.png
    python3 post_to_discord.py --file message.txt --image screenshot.png
"""

import argparse
import json
import sys
import requests
from pathlib import Path

# Quack Discord webhook URL
WEBHOOK_URL = "https://discord.com/api/webhooks/1432322294201581569/KG2eqmKPm6MIYTAAZzKmexICqfTJYtT5MouTVnwSPLSDoxSk-JQwSAEjT4K1BtzXABeZ"


def post_to_discord(message: str, image_path: str = None) -> bool:
    """
    Post a message to Discord webhook, optionally with an image attachment.

    Args:
        message: The message content to post
        image_path: Optional path to image file to attach

    Returns:
        bool: True if successful, False otherwise
    """

    if image_path:
        # Post with image attachment using multipart/form-data
        try:
            with open(image_path, 'rb') as f:
                files = {'file': f}
                payload = {'content': message}
                # Use json.dumps for proper escaping
                data = {'payload_json': json.dumps(payload)}

                response = requests.post(WEBHOOK_URL, files=files, data=data)
                response.raise_for_status()
                print(f"✅ Posted to Discord with image: {image_path}")
                return True

        except FileNotFoundError:
            print(f"❌ Error: Image file not found: {image_path}")
            return False
        except requests.exceptions.RequestException as e:
            print(f"❌ Error posting to Discord: {e}")
            if hasattr(e.response, 'text'):
                print(f"Response: {e.response.text}")
            return False
    else:
        # Post text-only message
        try:
            headers = {'Content-Type': 'application/json'}
            payload = {'content': message}

            response = requests.post(WEBHOOK_URL, headers=headers, json=payload)
            response.raise_for_status()
            print("✅ Posted to Discord")
            return True

        except requests.exceptions.RequestException as e:
            print(f"❌ Error posting to Discord: {e}")
            if hasattr(e.response, 'text'):
                print(f"Response: {e.response.text}")
            return False


def main():
    parser = argparse.ArgumentParser(
        description='Post messages to Quack Discord community',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Post simple message:
    %(prog)s "Hello Discord! 🦆"

  Post with image:
    %(prog)s "Check out this feature!" --image screenshot.png

  Post from file:
    %(prog)s --file update.txt --image demo.png
        """
    )

    parser.add_argument('message', nargs='?', help='Message content to post')
    parser.add_argument('--file', '-f', help='Read message from file')
    parser.add_argument('--image', '-i', help='Path to image file to attach')

    args = parser.parse_args()

    # Get message content
    if args.file:
        try:
            message = Path(args.file).read_text()
        except FileNotFoundError:
            print(f"❌ Error: Message file not found: {args.file}")
            sys.exit(1)
    elif args.message:
        message = args.message
    else:
        parser.print_help()
        sys.exit(1)

    # Validate message
    if not message.strip():
        print("❌ Error: Message cannot be empty")
        sys.exit(1)

    # Post to Discord
    success = post_to_discord(message, args.image)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
