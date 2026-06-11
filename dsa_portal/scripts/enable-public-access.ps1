# Make the Cloud Run service publicly invokable.
# Required so the frontend (and curl) can hit /health and the API.

gcloud run services add-iam-policy-binding kuber-verification `
  --region=asia-south1 `
  --member=allUsers `
  --role=roles/run.invoker
