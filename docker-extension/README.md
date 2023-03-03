# Faros CE Docker Desktop Extension

## Installation
1. Edit ./env file for envrionment variables used in docker containers according to your scenario.

2. Edit ./docker-compose.yaml file

  - Replace "\<FAROS\_CONF\_DIR\>" with the absolute path name where the env file locates. (12 occurrences totally)

  - Update ports/pathes accordingly if you changed any values in env file.

3. Build Docker image

  ```shell
  docker build --tag=faros/extension:latest .
  ```

4. Install extension

  ```shell
  docker extension install faros/extension:latest
  ```

## Clean up

  ```shell
  docker extension rm faros/extension:latest
  ```