# Faros CE Docker Desktop Extension

See Docker extension SDK, especially the UI and VM sections of the metadata.
* The difference between the docker-compose files is the metabase image used.
* The docker-compose files are copies of the original one with all parameters set. It is not possible to easily pass environment variables to the extension.

## Installation (for dev purposes)

1. Build Docker image

  ```shell
  docker build --tag=farosai/faros-ce-docker-extension:latest .
  ```

2. Install extension

  ```shell
  docker extension install farosai/faros-ce-docker-extension:latest
  ```

## Clean up

  ```shell
  docker extension rm farosai/faros-ce-docker-extension:latest
  ```

## Publishing (Faros-only)

```shell
make push-extension TAG=X.Y.Z
```

## Further reading
Docker extension SDK, especially the UI and VM sections of the metadata
We use different docker-compose files 