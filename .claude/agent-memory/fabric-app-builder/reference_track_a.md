---
name: track-a-fabric-items
description: Where Track A's Fabric items live (acme AppBackend item, lh_raw SQL endpoint) and how the local project is linked to them
metadata:
  type: reference
---

- Fabric App item **acme** = item type `AppBackend`, id `9cbd46a1-5541-4aaa-8048-2b1afad7253e`, workspace RAW (`7f065ce8-ffe8-4670-88eb-ed81a3c9c1bd`). Live URL: https://pine-shard-756dd25a7d-northeurope.webapp.fabricapps.net
- `fab ls RAW.Workspace` does not list `AppBackend` items (fab 1.7.0); use `fab api -X get workspaces/<ws>/items` to see them.
- `lh_raw` Lakehouse `b4fdb831-8417-475c-badb-a9a87be796b8`; its SQLEndpoint item `86dc5eb2-9a17-43d6-9c0c-4cf34eb93c8c` (the id the connector stores).
- Local link to the item: gitignored `fabric-app/rayfin/.deployments.json` (`active: acme`). Fresh clone → re-link with `npx rayfin up --workspace-id <RAW>` (verify with `--dry-run` that `targeting.target` is `recorded-deployment`, not a create).
- RAW is a dev capacity; publishing capacity/workspace TBD (CLAUDE.md › Workspaces).
