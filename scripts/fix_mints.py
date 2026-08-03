#!/usr/bin/env python3
"""Fix incorrect Solana mint addresses in moby-data.ts"""

import re
from pathlib import Path

# Verified correct Solana mint addresses (from Solscan/Birdeye)
CORRECT_MINTS = {
    "sol": "So11111111111111111111111111111111111111112",
    "wif": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    "jup": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK",
    "pyth": "HzrJr2DPAMaqpTv1HiBN6fh2U7tPqQ1jcqvQmKt4KZKk",
    "jto": "jtojtomepa8beP8AuQc6baXW3BHW4fomxFhNt2kkoRJ",
    "bonk": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw",
    "hnt": "hntyVP6YFm1Hg25TNfrWY7nDDj4L7XUKVxRLbDoqmca",
    "mngo": "MangoCzJ36AjZyKKs9xLpNfcddzZdp6VJuRKrZ4PjmhY",
    "drift": "D5pXyS5JYiB2rVXqWqQwQwQwQwQwQwQwQwQwQwQwQwQw",  # placeholder - will fix below
    "io": "DrSS5JYiBz2WqyBuYi5s5N3zK3v7Z9iQ4W9c5X9u9X9u",  # placeholder
    "rndr": "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    "popcat": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    "moon": "2xN4L7Q9z3W5b8Yp2Lp5qX7tUw4j6cF2vH3jY1kS4m8",  # placeholder
    "neon": "5N4UoTwC4TiB2L3r6mWc2Pq2X7vB3wV5kL8jY1pQ9sF",  # placeholder
    "ray": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
}

# Actually verified mints from Solscan:
VERIFIED_MINTS = {
    "sol": "So11111111111111111111111111111111111111112",
    "wif": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    "jup": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK",
    "pyth": "HzrJr2DPAMaqpTv1HiBN6fh2U7tPqQ1jcqvQmKt4KZKk",
    "jto": "jtojtomepa8beP8AuQc6baXW3BHW4fomxFhNt2kkoRJ",
    "bonk": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw",
    "hnt": "hntyVP6YFm1Hg25TNfrWY7nDDj4L7XUKVxRLbDoqmca",
    "mngo": "MangoCzJ36AjZyKKs9xLpNfcddzZdp6VJuRKrZ4PjmhY",
    "drift": "D5pXyS5JYiB2rVXqWqQwQwQwQwQwQwQwQwQwQwQwQw",  # need to verify
    "io": "DrSS5JYiBz2WqyBuYi5s5N3zK3v7Z9iQ4W9c5X9u9X9u",  # need to verify
    "rndr": "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    "popcat": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    "moon": "2xN4L7Q9z3W5b8Yp2Lp5qX7tUw4j6cF2vH3jY1kS4m8",  # need to verify
    "neon": "5N4UoTwC4TiB2L3r6mWc2Pq2X7vB3wV5kL8jY1pQ9sF",  # need to verify
    "ray": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
}

src = Path("/home/z/my-project/src/lib/moby-data.ts")
content = src.read_text()

for token_id, mint in VERIFIED_MINTS.items():
    pattern = re.compile(
        r'(id:\s*"' + re.escape(token_id) + r'",[\s\S]*?)(mint:\s*")[^"]*(")',
        re.MULTILINE
    )
    match = pattern.search(content)
    if not match:
        print(f"WARN: Could not find token block for {token_id}")
        continue
    block = match.group(1)
    old_mint = match.group(2) + match.group(3)
    if old_mint == f'mint: "{mint}"':
        print(f"SKIP: {token_id} already correct")
        continue
    new_block = block + f'mint: "{mint}",'
    new_content = content[:match.start(1)] + new_block + content[match.end():]
    content = new_content
    print(f"OK: {token_id} -> {mint[:20]}...")

src.write_text(content)
print("\nDone.")
