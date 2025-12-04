#!/usr/bin/env bash
#
# Sign Docker images with Cosign using GitHub OIDC
#
# Usage: sign-image-with-cosign.sh <image:tag>
#   image:tag - Docker image reference with tag (e.g., farosai/airbyte-xyz:1.0.0)
#
# Prerequisites:
#   - cosign must be installed
#   - skopeo must be installed
#   - jq must be installed
#   - Image must exist in docker.io registry
#
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Error: docker image reference (e.g. farosai/<image-name>:1.2.3) is required" >&2
  exit 1
fi

IMAGE_WITH_TAG="$1"
if [[ "${IMAGE_WITH_TAG}" != *:* ]]; then
  echo "Error: docker image reference must include a tag" >&2
  exit 1
fi

IMAGE="docker.io/${IMAGE_WITH_TAG}"
echo "Inspecting remote image: ${IMAGE}"
DIGEST=$(skopeo inspect "docker://${IMAGE}" | jq -r '.Digest')
if [ -z "${DIGEST}" ] || [ "${DIGEST}" = "null" ]; then
  echo "Error: Failed to determine digest for ${IMAGE}" >&2
  exit 1
fi

IMAGE_REF="${IMAGE}@${DIGEST}"
echo "Signing image: ${IMAGE_REF}"
if ! cosign sign --yes "${IMAGE_REF}"; then
  echo "Error: Failed to sign image ${IMAGE_REF}" >&2
  exit 1
fi

echo "Verifying image: ${IMAGE_REF}"
MAX_ATTEMPTS=2
ATTEMPT=1
SLEEP_SECONDS=5
while true; do
  if [ "${ATTEMPT}" -gt "${MAX_ATTEMPTS}" ]; then
    echo "Error: Verification failed after ${MAX_ATTEMPTS} attempts for ${IMAGE_REF}" >&2
    exit 1
  fi

  if cosign verify "${IMAGE_REF}" \
    --certificate-identity-regexp="https://github.com/faros-ai/faros-community-edition/.*" \
    --certificate-oidc-issuer="https://token.actions.githubusercontent.com"; then
    echo "Verification succeeded for ${IMAGE_REF}"
    break
  fi

  echo "Verification failed (attempt ${ATTEMPT}/${MAX_ATTEMPTS}). Retrying in ${SLEEP_SECONDS} seconds."
  ATTEMPT=$(( ATTEMPT + 1 ))
  sleep "${SLEEP_SECONDS}"
done