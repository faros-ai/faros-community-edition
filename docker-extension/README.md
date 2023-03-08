# Faros CE Docker Desktop Extension

## Installation

1. Build Docker image

  ```shell
  docker build --tag=farosai/faros-ce-docker-extension:latest .
  ```

2. Install extension

  ```shell
  docker extension install farosai/faros-ce-docker-extension:latest .
  ```

## Clean up

  ```shell
  docker extension rm farosai/faros-ce-docker-extension:latest .
  ```