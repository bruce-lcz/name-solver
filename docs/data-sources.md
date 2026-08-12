# Data sources and provenance

The shipped `fixtures-1.0.0` release is a non-authoritative development fixture. It must not be used to determine legal name registration, stroke counts, or five-element advice.

Production imports record source URL, licence, checksum, source version, parsing method, confidence, and review status. Candidate sources from the implementation plan are CNS11643, Ministry of the Interior name statistics, and the Taiwanese legal-name rules. Each release must be reviewed before publication.

## CNS11643 crawler

Run `npm run crawl:cns` to retrieve the fixed official CNS11643 resources: `release.txt`, `Properties.zip`, `MapingTables.zip`, and `OpenDataFilesList.csv`. The crawler uses HTTPS only, a 90-second timeout, a 250 MiB resource cap, a named user agent, immutable release-versioned snapshots, and SHA-256 checksums. It writes to `data/raw/cns11643/<release-version>/`; downloading does not publish a database release.
