# Adaptive Task Dashboard

A small task dashboard whose interface changes at runtime based on how the
person uses it. Built for an HCI course project on AI-based adaptive
human-computer interaction.

No build step, no server, no accounts. Open `index.html` in a browser and it runs.

## What adapts

| # | Adaptation | Trigger | Technique |
|---|---|---|---|
| 1 | **Quick Actions bar** — the three controls you use most move to the top | after 6 interactions | naive Bayes over context + decayed frequency |
| 2 | **Next step highlight** — the control you usually pick next is outlined | 5+ observations of that transition, 40%+ confidence | first-order Markov chain |
| 3 | **Help level** — instructions expand for people who hesitate or undo a lot, and hide for confident users | undo rate > 20% or hesitation rate > 30% | threshold rules over the user model |
| 4 | **Readability** — larger text and higher contrast are *offered* | late-night use or a high undo rate | threshold rule, user confirms |

Nothing is ever deleted from the interface. Controls are only reordered,
promoted, or highlighted, so the user never loses a feature they knew was there.

## How the learning works

Every click is recorded in `js/model.js` with a timestamp and the time the user
spent before clicking. Old events decay: after 20 new interactions an old one
counts for half as much. That keeps the interface tracking current habits.

`js/predictor.js` holds two models, both trained online with no training set:

- **Naive Bayes** scores `P(action | time of day, weekday/weekend)` with add-one
  smoothing so an unused action can still recover.
- **Markov chain** counts `previous action -> next action` and only returns a
  guess once it has seen the transition at least five times with 40% confidence.

The Quick Actions ranking blends the two: `0.6 * frequency + 0.4 * context`.

## Transparency and control

- **Adaptation** toggle switches all of it off; the layout then stays fixed.
- **Why am I seeing this?** opens a panel showing the raw scores and counts.
- Hovering a promoted button explains in plain words why it was promoted.
- **Reset learning** erases the model.
- All data stays in `localStorage`. Nothing is uploaded anywhere.

## Files

```
index.html          markup and the fixed control set
css/styles.css      styling plus the adaptive states (help level, readability)
js/model.js         user model: decayed counts, context table, transition matrix
js/predictor.js     naive Bayes + Markov chain
js/storage.js       localStorage wrapper with an in-memory fallback
js/adaptive.js      the four adaptation rules and the DOM updates
js/app.js           the base task dashboard
```

## Running it

```bash
git clone <your-repo-url>
cd adaptive-ui-project
open index.html        # or: python3 -m http.server 8000
```

To see the adaptation quickly: add and complete six or seven tasks in a row.
The Quick Actions bar appears, and after a few repeats "Complete task" gets
outlined as the predicted next step.

## Starting point

The base task dashboard was written from scratch for this project rather than
forked from an existing sample, so that the interaction set could be kept small
and fully instrumented. No UI framework or component library is used.

## AI tool disclosure

Anthropic's Claude was used to help draft and comment portions of the JavaScript
in `js/predictor.js` and `js/adaptive.js` and to help structure the accompanying
report. All code was reviewed, tested, and edited before submission. The
adaptation rules, thresholds, and blending weights were chosen and tuned by hand.

## License

MIT
