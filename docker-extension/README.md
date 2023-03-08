# Faros CE Docker Desktop Extension

## Installation

1. Build Docker image

  ```shell
  docker build --tag=farosai/farosdockerextension:latest .
  ```

2. Install extension

  ```shell
  docker extension install farosai/farosdockerextension:latest .
  ```

## Clean up

  ```shell
  docker extension rm farosai/farosdockerextension:latest .
  ```