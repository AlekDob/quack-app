#!/usr/bin/env python3
# Analyze all Claude Code sessions in ~/.claude/projects/ to compare
# Quack-spawned vs CLI-spawned sessions. Marker for Quack: presence of
# "quack-managed-hook" in any system event's hookInfos.
#
# Output:
#   - data/sessions.csv: one row per session with all metrics
#   - data/summary.json: aggregated stats per source (Quack vs CLI)
#   - data/outliers.json: sessions with anomalous cache/efficiency patterns
#
# Brain: claude-usage-spike
import csv
import glob
import json
import os
import statistics
import sys
from collections import Counter, defaultdict

HOME = os.path.expanduser("~")
PROJECTS_DIR = os.path.join(HOME, ".claude", "projects")
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def parse_jsonl(path):
    """Yield records from a JSONL file, skipping malformed lines."""
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def is_quack_spawned(records):
    """A session is Quack-spawned iff at least one system event lists the
    quack-managed-hook in its hookInfos. This hook is injected by the
    Quack Rust bridge (claude_code.rs ensure_pretooluse_hook) and by
    the post-stop idle notification, so it's present whenever Quack
    was the active surface during the session."""
    for r in records:
        if r.get("type") != "system":
            continue
        infos = r.get("hookInfos") or []
        for hi in infos:
            cmd = hi.get("command", "") or ""
            if "quack-managed-hook" in cmd:
                return True
    return False


def extract_metrics(records):
    """Aggregate token usage, cache stats, and structural signals."""
    usage = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
        "cache_creation_ephemeral_5m": 0,
        "cache_creation_ephemeral_1h": 0,
        "web_search_requests": 0,
        "web_fetch_requests": 0,
    }
    models = Counter()
    turns = 0
    user_messages = 0
    assistant_messages = 0
    tool_uses = Counter()
    task_subagents = 0
    thinking_blocks = 0
    thinking_text_chars = 0
    first_ts = None
    last_ts = None
    sidechain_records = 0

    for r in records:
        ts = r.get("timestamp")
        if ts:
            if first_ts is None or ts < first_ts:
                first_ts = ts
            if last_ts is None or ts > last_ts:
                last_ts = ts

        t = r.get("type")
        if t == "user":
            user_messages += 1
            # Skip system-injected user records (tool_result echoes)
            content = r.get("message", {}).get("content")
            if isinstance(content, list):
                if any(b.get("type") == "tool_result" for b in content):
                    continue
            if r.get("isSidechain"):
                sidechain_records += 1
        elif t == "assistant":
            assistant_messages += 1
            msg = r.get("message", {})
            model = msg.get("model")
            if model:
                models[model] += 1
            u = msg.get("usage")
            if u:
                usage["input_tokens"] += u.get("input_tokens", 0) or 0
                usage["output_tokens"] += u.get("output_tokens", 0) or 0
                usage["cache_creation_input_tokens"] += (
                    u.get("cache_creation_input_tokens", 0) or 0
                )
                usage["cache_read_input_tokens"] += (
                    u.get("cache_read_input_tokens", 0) or 0
                )
                cc = u.get("cache_creation", {}) or {}
                usage["cache_creation_ephemeral_5m"] += (
                    cc.get("ephemeral_5m_input_tokens", 0) or 0
                )
                usage["cache_creation_ephemeral_1h"] += (
                    cc.get("ephemeral_1h_input_tokens", 0) or 0
                )
                st = u.get("server_tool_use", {}) or {}
                usage["web_search_requests"] += st.get("web_search_requests", 0) or 0
                usage["web_fetch_requests"] += st.get("web_fetch_requests", 0) or 0
            content = msg.get("content", [])
            if isinstance(content, list):
                for block in content:
                    btype = block.get("type")
                    if btype == "tool_use":
                        name = block.get("name", "?")
                        tool_uses[name] += 1
                        if name in ("Task", "Agent"):
                            task_subagents += 1
                    elif btype == "thinking":
                        thinking_blocks += 1
                        thinking_text_chars += len(block.get("thinking", "") or "")
        elif t == "result":
            # Top-level result events also carry a usage summary + cost.
            u = r.get("usage")
            if u:
                # The result usage is the *last* model call, not cumulative —
                # skip to avoid double-counting; assistant events already
                # covered cumulative per-message usage.
                pass
        if r.get("isSidechain"):
            sidechain_records += 1

    turns = user_messages
    return {
        "usage": usage,
        "models": dict(models),
        "turns": turns,
        "user_messages": user_messages,
        "assistant_messages": assistant_messages,
        "tool_uses": dict(tool_uses),
        "task_subagents": task_subagents,
        "thinking_blocks": thinking_blocks,
        "thinking_text_chars": thinking_text_chars,
        "first_ts": first_ts,
        "last_ts": last_ts,
        "sidechain_records": sidechain_records,
    }


def cache_hit_ratio(u):
    """cache_read / (cache_read + cache_creation + input).
    This is the share of tokens that came from cache (cheap)."""
    cr = u.get("cache_read_input_tokens", 0) or 0
    cc = u.get("cache_creation_input_tokens", 0) or 0
    inp = u.get("input_tokens", 0) or 0
    denom = cr + cc + inp
    return (cr / denom) if denom > 0 else 0.0


def cost_estimate_opus(u):
    """Rough USD cost assuming Claude Opus 4.x pricing.
    input $5/M, output $25/M, cache_write $6.25/M, cache_read $0.50/M.
    Numbers will be approximate but consistent across populations."""
    inp = u.get("input_tokens", 0) or 0
    out = u.get("output_tokens", 0) or 0
    cc = u.get("cache_creation_input_tokens", 0) or 0
    cr = u.get("cache_read_input_tokens", 0) or 0
    return (
        inp * 5.0 / 1e6
        + out * 25.0 / 1e6
        + cc * 6.25 / 1e6
        + cr * 0.50 / 1e6
    )


def cost_estimate_sonnet(u):
    inp = u.get("input_tokens", 0) or 0
    out = u.get("output_tokens", 0) or 0
    cc = u.get("cache_creation_input_tokens", 0) or 0
    cr = u.get("cache_read_input_tokens", 0) or 0
    return (
        inp * 3.0 / 1e6
        + out * 15.0 / 1e6
        + cc * 3.75 / 1e6
        + cr * 0.30 / 1e6
    )


def main():
    if not os.path.isdir(PROJECTS_DIR):
        print(f"ERR: {PROJECTS_DIR} not found", file=sys.stderr)
        sys.exit(1)

    rows = []
    project_dirs = sorted(
        d for d in glob.glob(os.path.join(PROJECTS_DIR, "*")) if os.path.isdir(d)
    )
    for proj in project_dirs:
        encoded_cwd = os.path.basename(proj)
        for jpath in sorted(glob.glob(os.path.join(proj, "*.jsonl"))):
            try:
                records = list(parse_jsonl(jpath))
            except Exception as e:
                print(f"WARN: skipping {jpath}: {e}", file=sys.stderr)
                continue
            if not records:
                continue
            quack = is_quack_spawned(records)
            m = extract_metrics(records)
            u = m["usage"]
            ch = cache_hit_ratio(u)
            # Pick cost estimator by dominant model.
            primary_model = (
                max(m["models"].items(), key=lambda x: x[1])[0]
                if m["models"]
                else ""
            )
            if "opus" in primary_model.lower():
                cost = cost_estimate_opus(u)
                pricing = "opus"
            elif "sonnet" in primary_model.lower():
                cost = cost_estimate_sonnet(u)
                pricing = "sonnet"
            else:
                cost = cost_estimate_opus(u)
                pricing = "opus-fallback"
            rows.append({
                "project": encoded_cwd,
                "session_id": os.path.basename(jpath).replace(".jsonl", ""),
                "source": "quack" if quack else "cli",
                "primary_model": primary_model,
                "pricing_tier": pricing,
                "turns": m["turns"],
                "user_messages": m["user_messages"],
                "assistant_messages": m["assistant_messages"],
                "tool_uses_total": sum(m["tool_uses"].values()),
                "task_subagents": m["task_subagents"],
                "thinking_blocks": m["thinking_blocks"],
                "thinking_chars": m["thinking_text_chars"],
                "input_tokens": u["input_tokens"],
                "output_tokens": u["output_tokens"],
                "cache_creation_tokens": u["cache_creation_input_tokens"],
                "cache_read_tokens": u["cache_read_input_tokens"],
                "cache_creation_5m": u["cache_creation_ephemeral_5m"],
                "cache_creation_1h": u["cache_creation_ephemeral_1h"],
                "cache_hit_ratio": round(ch, 4),
                "estimated_cost_usd": round(cost, 4),
                "first_ts": m["first_ts"],
                "last_ts": m["last_ts"],
                "sidechain_records": m["sidechain_records"],
            })

    if not rows:
        print("No sessions found.")
        return

    # Write CSV.
    csv_path = os.path.join(OUT_DIR, "sessions.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} sessions to {csv_path}")

    # Aggregate per source.
    by_source = defaultdict(list)
    for r in rows:
        by_source[r["source"]].append(r)

    def stats(values):
        if not values:
            return {}
        s = {
            "n": len(values),
            "min": round(min(values), 4),
            "max": round(max(values), 4),
            "mean": round(statistics.mean(values), 4),
            "median": round(statistics.median(values), 4),
        }
        if len(values) >= 2:
            try:
                s["stdev"] = round(statistics.stdev(values), 4)
            except statistics.StatisticsError:
                s["stdev"] = 0
        if len(values) >= 4:
            s["p25"] = round(statistics.quantiles(values, n=4)[0], 4)
            s["p75"] = round(statistics.quantiles(values, n=4)[2], 4)
            s["p95"] = round(statistics.quantiles(values, n=20)[18], 4)
        return s

    summary = {"by_source": {}, "totals": {}}
    for src, group in by_source.items():
        summary["by_source"][src] = {
            "n_sessions": len(group),
            "input_tokens": stats([r["input_tokens"] for r in group]),
            "output_tokens": stats([r["output_tokens"] for r in group]),
            "cache_read_tokens": stats([r["cache_read_tokens"] for r in group]),
            "cache_hit_ratio": stats([r["cache_hit_ratio"] for r in group]),
            "estimated_cost_usd": stats([r["estimated_cost_usd"] for r in group]),
            "turns": stats([r["turns"] for r in group]),
            "task_subagents": stats([r["task_subagents"] for r in group]),
            "thinking_blocks": stats([r["thinking_blocks"] for r in group]),
            "thinking_chars": stats([r["thinking_chars"] for r in group]),
            "models": dict(Counter(r["primary_model"] for r in group)),
        }

    summary["totals"] = {
        "input_tokens": sum(r["input_tokens"] for r in rows),
        "output_tokens": sum(r["output_tokens"] for r in rows),
        "cache_creation_tokens": sum(r["cache_creation_tokens"] for r in rows),
        "cache_read_tokens": sum(r["cache_read_tokens"] for r in rows),
        "estimated_cost_usd": round(sum(r["estimated_cost_usd"] for r in rows), 4),
        "task_subagents": sum(r["task_subagents"] for r in rows),
    }
    summary["totals"]["cache_hit_ratio_overall"] = round(
        summary["totals"]["cache_read_tokens"]
        / (
            summary["totals"]["input_tokens"]
            + summary["totals"]["cache_creation_tokens"]
            + summary["totals"]["cache_read_tokens"]
        ),
        4,
    ) if (summary["totals"]["input_tokens"] + summary["totals"]["cache_creation_tokens"] + summary["totals"]["cache_read_tokens"]) > 0 else 0

    summary_path = os.path.join(OUT_DIR, "summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Wrote summary to {summary_path}")

    # Outliers: sessions with cache hit ratio < 30% AND > 50k input tokens
    # (cache miss hurts more at scale); OR thinking_blocks > 50 (forced
    # max thinking on a non-trivial task).
    outliers = []
    for r in rows:
        reasons = []
        if r["cache_hit_ratio"] < 0.30 and (r["input_tokens"] + r["cache_read_tokens"] + r["cache_creation_tokens"]) > 50000:
            reasons.append(f"low_cache_hit({r['cache_hit_ratio']:.1%})")
        if r["thinking_blocks"] > 50 and r["thinking_chars"] > 200000:
            reasons.append(f"heavy_thinking({r['thinking_blocks']} blocks, {r['thinking_chars']} chars)")
        if r["task_subagents"] > 5:
            reasons.append(f"many_subagents({r['task_subagents']})")
        if reasons:
            outliers.append({
                "session_id": r["session_id"],
                "source": r["source"],
                "project": r["project"],
                "primary_model": r["primary_model"],
                "turns": r["turns"],
                "cache_hit_ratio": r["cache_hit_ratio"],
                "estimated_cost_usd": r["estimated_cost_usd"],
                "input_tokens": r["input_tokens"],
                "output_tokens": r["output_tokens"],
                "thinking_blocks": r["thinking_blocks"],
                "task_subagents": r["task_subagents"],
                "first_ts": r["first_ts"],
                "reasons": reasons,
            })
    outliers_path = os.path.join(OUT_DIR, "outliers.json")
    with open(outliers_path, "w", encoding="utf-8") as f:
        json.dump(outliers, f, indent=2)
    print(f"Wrote {len(outliers)} outliers to {outliers_path}")

    # Print top-level takeaway.
    print()
    print("=" * 70)
    print("QUACK vs CLI — TOP-LINE NUMBERS")
    print("=" * 70)
    for src in ("quack", "cli"):
        s = summary["by_source"].get(src)
        if not s:
            continue
        print(f"\n[{src.upper()}]  n={s['n_sessions']}")
        print(f"  cost/session  median=${s['estimated_cost_usd']['median']:.3f}  "
              f"mean=${s['estimated_cost_usd']['mean']:.3f}  "
              f"p95=${s['estimated_cost_usd']['p95']:.3f}")
        print(f"  cache hit     median={s['cache_hit_ratio']['median']:.1%}  "
              f"mean={s['cache_hit_ratio']['mean']:.1%}  "
              f"p25={s['cache_hit_ratio'].get('p25', 0):.1%}")
        print(f"  turns/session median={s['turns']['median']:.0f}  "
              f"p95={s['turns'].get('p95', 0):.0f}")
        print(f"  thinking      median blocks={s['thinking_blocks']['median']:.0f}  "
              f"p95={s['thinking_blocks'].get('p95', 0):.0f}")
        print(f"  models        {s['models']}")

    quack_cost = summary["by_source"].get("quack", {}).get("estimated_cost_usd", {}).get("mean", 0)
    cli_cost = summary["by_source"].get("cli", {}).get("estimated_cost_usd", {}).get("mean", 0)
    quack_chr = summary["by_source"].get("quack", {}).get("cache_hit_ratio", {}).get("mean", 0)
    cli_chr = summary["by_source"].get("cli", {}).get("cache_hit_ratio", {}).get("mean", 0)
    if cli_cost > 0:
        print(f"\n  RATIO Quack/CLI on mean cost/session: {quack_cost / cli_cost:.2f}x")
    if cli_chr > 0:
        print(f"  RATIO Quack/CLI on mean cache-hit ratio: {quack_chr / cli_chr:.2f}x")


if __name__ == "__main__":
    main()