# Restore Drill

## Schedule

- Quarterly for Tier 1 data
- Annually for full disaster recovery

## Steps

1. Spin up staging environment
2. Restore backup to staging
3. Run smoke tests
4. Verify RLS policies
5. Verify privacy delete consistency
6. Record results

## Record template

| Field                | Value |
| -------------------- | ----- |
| Date                 |       |
| Backup source        |       |
| Restore time         |       |
| Smoke test result    |       |
| RLS check result     |       |
| Privacy check result |       |
| Issues found         |       |
| Next improvement     |       |
