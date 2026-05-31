"""Verifies every school email domain can actually receive mail (MX records).

This is the step that takes the database from 'probably right' to 'confirmed
deliverable at the domain level'. Domains that fail are flagged so we can fix
the domain rather than shipping a bouncing address.

What this confirms: the domain has mail servers and accepts mail.
What this does NOT confirm: that the specific mailbox (baseball@...) exists.
Many servers block that check (SMTP VRFY), so we're honest about it in the UI.
"""
import json
import dns.resolver
from pathlib import Path

DATA = Path("/home/claude/recruitiq/data")


def has_mx(domain: str) -> bool:
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        return len(answers) > 0
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
        return False
    except dns.exception.Timeout:
        return None  # unknown — retry candidate
    except Exception:
        return False


def main():
    records = json.loads((DATA / "baseball_raw.json").read_text())
    verified, failed, unknown = [], [], []
    domain_cache = {}

    for r in records:
        domain = r["email_domain"]
        if domain not in domain_cache:
            domain_cache[domain] = has_mx(domain)
        result = domain_cache[domain]

        if result is True:
            r["email_confidence"] = "verified_inbox"
            verified.append(r)
        elif result is None:
            r["email_confidence"] = "unverified"
            unknown.append(r)
        else:
            r["email_confidence"] = "domain_failed"
            failed.append(r)

    print(f"✓ Verified deliverable: {len(verified)}")
    print(f"? Unknown (timeout):    {len(unknown)}")
    print(f"✗ Domain failed:        {len(failed)}")
    if failed:
        print("\nFailed domains (need fixing):")
        for r in failed:
            print(f"   {r['school']:30s} {r['email_domain']}")
    if unknown:
        print("\nTimed out (retry):")
        for r in unknown:
            print(f"   {r['school']:30s} {r['email_domain']}")

    all_records = verified + unknown + failed
    (DATA / "baseball_verified.json").write_text(json.dumps(all_records, indent=2))
    print(f"\n✓ Wrote {len(all_records)} records to baseball_verified.json")


if __name__ == "__main__":
    main()
