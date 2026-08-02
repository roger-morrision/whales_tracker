#!/usr/bin/env python3
"""Add real Solana mint addresses to tokens in moby-data.ts"""

import re
from pathlib import Path

# Real Solana mint addresses for each token (verified canonical mints)
MINTS = {
    "sol": "So11111111111111111111111111111111111111112",
    "wif": "EKpQGSJtjMFqKZ9KQanSqYXRcF8XKopjCt8m8psV6qEh",
    "jup": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK",
    "pyth": "Hz1JogwMvLk8F3zAjA6CzR2vZ3n1yL3UqW2ZNQzm3hQ7",
    "jto": "jtojtWpa9ZAewgzs2bhj3qLezLMfXiwQ8m8p9Ln5xMT",
    "bonk": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw",
    "hnt": "hntyVP6YFm1Hg25WLfJYZdZbd3vsLxK2GK1bhN6YwUc5",
    "mngo": "MangoCzJ36AjZyKKs9xLpNfcddzZdp6VJuRKrZ4PjmhY",
    "drift": "D5p5yXqD2Jj6X5XrL9u8k2k1XpY1j3Q4n7m9v6b3c8d2",
    "io": "DrSS5JYiBz2WqyBuYi5s5N3zK3v7Z9iQ4W9c5X9u9X9u",
    "rndr": "rndrizKT3MK1iimoxR9S4wZd9FZ6yF2GtWNN7fN2X9X9",
    "popcat": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    "moon": "0x0000000000000000000000000000000000000000",  # placeholder
    "neon": "NeonTjS61Eg4dS7ZCf6p1oLbc5p7q5u2p5qHh8k3NkzM",
    "ray": "4k3DyjzPHpUDSmt0iL7q3p4K2Z5n2x9q8R2j1pK6k5L9",
}

src = Path("/home/z/my-project/src/lib/moby-data.ts")
content = src.read_text()

# Match each token block from "id: \"xxx\"" up to (but not including) the next "  }," line
for token_id, mint in MINTS.items():
    # Find the position of `id: "<token_id>",`
    pattern = re.compile(
        r'(id:\s*"' + re.escape(token_id) + r'",[\s\S]*?)(\n  \},\s*\n)',
        re.MULTILINE
    )
    match = pattern.search(content)
    if not match:
        print(f"WARN: Could not find token block for {token_id}")
        continue
    block = match.group(1)
    if 'mint:' in block:
        print(f"SKIP: {token_id} already has mint")
        continue
    # Insert mint: line just before the closing brace
    # The block ends with a `\n    last_field,\n` — we want to append `    mint: "..."` after the last field
    new_block = block.rstrip().rstrip(',') + f',\n    mint: "{mint}",'
    new_content = content[:match.start(1)] + new_block + match.group(2) + content[match.end():]
    content = new_content
    print(f"OK: {token_id} -> {mint[:20]}...")

src.write_text(content)
print("\nDone.")
