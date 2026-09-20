# ReBanter — Frontend

React Native (Expo + TypeScript) client for ReBanter, a social app for small crews: a home feed (Stream), live discovery (Roam), short-form loops, notifications (Pulse), DMs (Banters), and a profile.

## Stack

- Expo SDK 51, React Native 0.74, TypeScript
- React Navigation (bottom tabs + native stack)
- Talks to [ReBanter-Backend](https://github.com/Prashant007009/ReBanter-Backend) over REST (`EXPO_PUBLIC_API_URL`)

## Getting started

```bash
npm install
npm run start
```

## Structure

```
src/
  api/          fetch client
  components/   shared UI
  navigation/   stack + tab navigators
  screens/      one file per screen
  theme/        colors, type tokens (from the visual design)
```

## Branches

- `main` — active development
- `prod` — production; pushed to directly once a story is verified in QA

## Tracking

Work is tracked as small issues on the repo's GitHub Project board (Backlog → In Progress → In QA → Deployed). See `CLAUDE.md` (local, gitignored) for the working agreement.
