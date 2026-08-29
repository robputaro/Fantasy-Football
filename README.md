# Fantasy Draft Command Center

Static fantasy football draft assistant built for a short-lived draft-season use case.

## What it does

- Tracks every team/manager in a snake draft
- Automatically knows who is on the clock
- Assigns players to specific teams
- Tracks all rosters and recent picks
- Shows live recommendations for your roster
- Blends:
  - ADP / draft-market value
  - ESPN positional rank signal where available
  - FantasyPros ECR signal where explicitly captured
  - roster construction
  - tier scarcity
  - value vs current pick
  - probability a player survives to your next turn
- Detects positional runs
- Lets you save targets
- Lets you add any missing player manually
- Search is fail-safe: if a name is not in the ranked dataset, the app offers to add that exact player instantly
- Custom/unranked players remain fully draftable but show `0/3` source confidence rather than receiving fake consensus data
- Limits long player lists so the app stays usable during a live draft

## Deploy to Vercel

### Fastest option

1. Create a new GitHub repository.
2. Upload all files in this folder to the repo root.
3. Go to Vercel.
4. Select **Add New → Project**.
5. Import the GitHub repository.
6. No build command is required.
7. Deploy.

This is a static HTML/CSS/JS site.

## Update rankings before draft day

Edit:

`data/players.json`

Each player can include:

```json
{
  "adp": 1,
  "name": "Player Name",
  "nfl": "DET",
  "pos": "RB",
  "bye": 6,
  "espn_rank": 1,
  "fantasypros_ecr": 1
}
```

`espn_rank` and `fantasypros_ecr` may be `null`.

The app intentionally lowers source confidence when a player does not have all three signals instead of inventing missing data.

## Notes

This is intended as a draft assistant, not a predictive guarantee. Rankings and ADP move quickly during draft season, so refresh `players.json` shortly before using it.

Snapshot currently packaged: **August 28, 2026**.
