# Collinson

## Projects

| Project | Type | Description |
|---------|------|-------------|
| `apps/weather-app` | React Router SPA | Frontend. |
| `apps/weather-bff` | Node + GraphQL (Apollo Server) | Backend-for-frontend that ranks activities from Open-Meteo data. See [apps/weather-bff/README.md](apps/weather-bff/README.md). |
| `libs/weather-domain` | TypeScript library | Pure, framework-agnostic domain logic (Open-Meteo client, activity scoring, ranking) shared by the BFF. |

### Backend (weather-bff)

```sh
pnpm exec nx serve weather-bff     # GraphQL dev server at http://localhost:4000/
```

Example query:

```graphql
query { rankActivities(city: "Lisbon") { rankings { activity overallScore } } }
```

See [apps/weather-bff/README.md](apps/weather-bff/README.md) for the full schema, architecture,
and trade-offs.

## Run tasks

To run the dev server for your app, use:

```sh
pnpm exec nx serve weather-app
```

To create a production bundle:

```sh
pnpm exec nx build weather-app
```

To see all available targets to run for a project, run:

```sh
pnpm exec nx show project weather-app
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)


APIs documentation:

 - https://open-meteo.com/en/docs/geocoding-api
 - https://open-meteo.com/en/docs

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/getting-started/tutorials/react-monorepo-tutorial?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:
- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
