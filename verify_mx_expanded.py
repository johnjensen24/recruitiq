"""MX-verify all 745 domains in parallel. Caches per-domain so we don't repeat."""
import json
import dns.resolver
import dns.exception
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

DATA = Path("/home/claude/recruitiq/data")


def has_mx(domain: str, timeout: int = 5) -> bool:
    try:
        resolver = dns.resolver.Resolver()
        resolver.lifetime = timeout
        answers = resolver.resolve(domain, "MX")
        return len(answers) > 0
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
        return False
    except dns.exception.Timeout:
        return None
    except Exception:
        return False


def main():
    records = json.loads((DATA / "baseball_raw_expanded.json").read_text())
    # Collect unique domains
    unique_domains = sorted({r["email_domain"] for r in records})
    print(f"Verifying {len(unique_domains)} unique domains across {len(records)} schools...")

    results = {}
    with ThreadPoolExecutor(max_workers=20) as pool:
        future_to_domain = {pool.submit(has_mx, d): d for d in unique_domains}
        done = 0
        for future in as_completed(future_to_domain):
            d = future_to_domain[future]
            results[d] = future.result()
            done += 1
            if done % 100 == 0:
                print(f"  ... {done}/{len(unique_domains)}")

    # Apply to records
    verified, failed, unknown = 0, [], []
    for r in records:
        v = results.get(r["email_domain"])
        if v is True:
            r["email_confidence"] = "verified_inbox"
            verified += 1
        elif v is None:
            r["email_confidence"] = "unverified"
            unknown.append(r)
        else:
            r["email_confidence"] = "domain_failed"
            failed.append(r)

    print(f"\n✓ Verified deliverable: {verified}")
    print(f"? Unknown (timeout):    {len(unknown)}")
    print(f"✗ Domain failed:        {len(failed)}")
    if failed:
        print("\nFailed domains:")
        for r in sorted(failed, key=lambda x: x['email_domain']):
            print(f"  {r['school']:38s} {r['email_domain']}")

    (DATA / "baseball_verified_expanded.json").write_text(json.dumps(records, indent=2))
    print(f"\nWrote {len(records)} records")


if __name__ == "__main__":
    main()
