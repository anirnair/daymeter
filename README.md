# daymeter

A live dashboard that meters how much of your **day**, **week**, **month**, and
**year** has elapsed. It shows a ticking clock plus animated progress meters that
update every second, with the remaining time for each range.

Built with [Vite](https://vite.dev), [React](https://react.dev), and TypeScript.

## Getting started

Requires Node.js 20+ (developed on Node 22) and npm.

```bash
npm install      # install dependencies
npm run dev      # start the dev server at http://localhost:5173
```

## Scripts

| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Start the Vite dev server (host `0.0.0.0`).    |
| `npm run build`    | Type-check and build a production bundle.       |
| `npm run preview`  | Preview the production build locally.           |
| `npm run lint`     | Run ESLint over the project.                    |
| `npm test`         | Run the unit tests once with Vitest.            |
| `npm run test:watch` | Run Vitest in watch mode.                     |

## Project layout

```
src/
  lib/dayMetrics.ts       # Pure, tested logic for elapsed-time metrics
  components/MeterCard.tsx # Presentational progress-meter card
  App.tsx                 # Ticking clock + meter grid
  main.tsx                # React entry point
```

## Testing

Unit tests cover the metric calculations and the meter component:

```bash
npm test
```
