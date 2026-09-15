# Scenario v2 release validation

Scenario v2 keeps guest mode local-first and adds optional Google sign-in with Cloud Firestore sync.

Before release, the following flows were tested end-to-end on the GitHub Pages preview:

- Google sign-in
- Firestore write and read access
- deletion tombstones
- explicit guest-scenario import
- sync status reaching `Synced`
- same-account restore in a separate browser storage context
- edit propagation between browser contexts
- delete propagation between browser contexts

The production Firestore rules remain the authorization boundary for cloud data. The rules in this branch bind scenario records to the authenticated user's UID subtree and to their document ID, validate the core record shape, and disallow hard deletes so tombstones can propagate.
