# NavDhan document scanner

Private Cloud Run service invoked by an Eventarc Google Cloud Storage finalize
trigger. It processes only
`quarantine/<marketplace>/<application>/<document>.pdf` objects, downloads the
exact generation, scans with ClamAV, and posts a signed terminal verdict to the
collection backend.

The request boundary validates CloudEvent 1.0 type, bucket source, object
subject, UUID-only quarantine path, reported size, and immutable GCS
generation. The callback binds the independently calculated SHA-256, Eventarc
event ID, generation, document ID, and verdict. Engine, storage, and callback
failures return `503` so Eventarc retries without converting an infrastructure
failure into a terminal document verdict.

Required environment variables are `GCS_BUCKET`, `BACKEND_URL`, and the Secret
Manager-backed `DOCUMENT_SCAN_CALLBACK_TOKEN`. The runtime identity needs only
object-viewer access to its environment's bucket and secret-accessor access to
that callback token. It must not receive Cloud SQL access or object-write roles.

The image is based on a digest-pinned official ClamAV release, installs the
hash-locked Python graph, refreshes official signatures during the build and
again before accepting traffic, and runs `freshclam` hourly as the non-root
`clamav` user. `clamscan` rejects signature databases older than two days,
encrypted documents, and files that exceed its inspection limits.

`ci/cloudbuild-scanner-staging.yaml` and `ci/cloudbuild-scanner.yaml` are
repository-trigger-only image builders. They intentionally do not deploy,
promote traffic, create Eventarc triggers, or resolve a floating secret
version. An approved operator must deploy the built image by digest, bind a
numeric callback-secret version, keep the service private with internal
ingress and concurrency one, then create the environment-specific trigger.

Use two identities per environment: an Eventarc delivery identity with only
Cloud Run invoker permission on the private scanner, and a scanner runtime
identity with bucket-scoped object-viewer plus access to only its callback
secret. The runtime must not receive Cloud SQL, object-write, backend secret,
or deployment permissions. Cloud Storage direct-event filters must bind the
finalize event type and the exact environment bucket; this service independently
ignores every object outside `quarantine/`.

Run the focused tests with an environment containing the dependencies in
`requirements.lock`:

```bash
python -m unittest -v test_scanner_app.py
```
