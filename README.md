# ![](img/faros.ico) Faros Community Edition

[![GitHub Stars](https://img.shields.io/github/stars/faros-ai/faros-community-edition?style=social)](https://github.com/faros-ai/faros-community-edition/stargazers/) [![Community Slack](https://img.shields.io/badge/chat-Slack-%234a154b)](https://community.faros.ai/docs/slack) [![Release](https://github.com/faros-ai/faros-community-edition/actions/workflows/release.yml/badge.svg)](https://github.com/faros-ai/faros-community-edition/actions/workflows/release.yml) [![PR Cycle Time](https://img.shields.io/badge/dynamic/json?color=informational&label=PR%20Cycle%20Time&query=%24%5B0%5D.pr_cycle_time&suffix=%20days&url=https%3A%2F%2Fmetabase.faros-ce.onplural.sh%2Fapi%2Fpublic%2Fcard%2Fba76dbdf-a77b-4948-9efe-df29aa4667fc%2Fquery%2Fjson)](https://metabase.faros-ce.onplural.sh/public/dashboard/b2ab64dc-e343-45df-8f78-fb912306e12e?relative_date=past30days&repository=faros-community-edition)

Faros Community Edition (CE) is an open-source engineering operations platform that connects the dots between all your operational data sources for a single-pane view across the software development life cycle.

![DORA Metrics](img/dora_metrics.png)
![JIRA Metrics](img/jira_metrics.png)
## 🏁 Quickstart

Follow our [🏁 Quickstart Guide](https://community.faros.ai/docs/quickstart) to connect your engineering systems and explore the metrics, all in a matter of minutes!

## ✨ Features

- **Rich Data Schema**: Connected canonical models for the whole SDLC; 50+ entities, from tasks to deployments
- **Import from a variety of sources**: Easy data import onto our models from Task Management, Version Control, Incident Management, and CI/CD systems
- **Flexible GraphQL API**: Leverage imported data for automation / exploration in our canonical representation
- **Preconfigured dashboards**: View well known engineering metrics such as [DORA](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance) and [SPACE](https://queue.acm.org/detail.cfm?id=3454124)
- **Extensibility and shareability**: Build and share custom metrics and dashboards
- **Container-based deployment**: Run on your laptop, private or public cloud, with no external dependencies

## ℹ️ Components

![Architecture](img/architecture.png)

Built **100%** with open-source components:

- **[Airbyte](https://airbyte.com)**: Data integration platform for importing data from a [variety of sources](https://github.com/faros-ai/airbyte-connectors) (even [more sources](https://github.com/airbytehq/airbyte/tree/master/airbyte-integrations/connectors))
- **[Hasura](https://hasura.io)**: GraphQL engine that makes your data accessible over a real-time GraphQL API
- **[Metabase](https://metabase.com)**: Business Intelligence (BI) tool for generating metrics and rendering charts and dashboards from your data
- **[dbt](https://www.getdbt.com)**: Data transformations to convert raw data into usable metrics
- **[n8n](https://n8n.io/)**: Extendable workflow automation of top of your data
- **[PostgreSQL](https://www.postgresql.org)**: Stores all the your data in canonical representation
- **[Docker](https://www.docker.com)**: Container runtime to run the services
- **[Flyway](https://flywaydb.org)**: Schema evolution for the database schema
- **[Faros Events CLI](https://github.com/faros-ai/faros-events-cli)**: CLI for reporting events to Faros platform, e.g builds & deployments from your CI/CD pipelines

## 🤗 Community support

For general help using Faros CE, please refer to the [official documentation](https://community.faros.ai). For additional help, you can use one of these channels to ask a question:

- **[Slack](https://community.faros.ai/docs/slack)**: Live discussions with the Community and Faros team
- **[GitHub Issues](https://github.com/faros-ai/faros-community-edition/issues)**: Bug reports, suggestions, contributions

Check out our [website](https://faros.ai). Follow us on [Twitter](https://twitter.com/Faros_AI) or [LinkedIn](https://www.linkedin.com/company/faros-ai/) to get the latest company news.

## 📜 License

[Apache License 2.0](LICENSE)
