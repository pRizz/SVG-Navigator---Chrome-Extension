# Standards Overrides

Use this file to record deliberate deviations from the canonical coding and architecture standards.

## Active overrides

| Standard                                                         | Local decision                                                                                                         | Rationale                                                                                                                                                                                                              | Owner             | Review date |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------- |
| `core/frontend-ui.md`: Default Frontend Experiences To Dark Mode | The settings popup follows the browser and OS color scheme (`color-scheme: light dark`) instead of defaulting to dark. | A browser toolbar popup sits inside the browser's own chrome; matching the user's chosen theme is the platform convention, and a dark popup under a light browser looks broken. Dark users already get the dark theme. | Peter Ryszkiewicz | 2027-04-07  |
| `core/frontend-ui.md`: Default Frontend Experiences To Dark Mode | SVGs open on a white background by default (`svgBackgroundColor: 'white'`); users can change it in the popup.          | Most SVGs on the web assume a white page: black strokes and text with no background of their own become unreadable on dark. The background is a viewing aid for someone else's artwork, not app chrome.                | Peter Ryszkiewicz | 2027-04-07  |

## Notes

- Prefer narrow, explicit exceptions over broad "this repo is different" statements.
- If local verification is intentionally hook-owned or leaves heavy suites to CI, record that explicitly here.
- Revisit overrides periodically instead of letting them become permanent by accident.
- If an override becomes common across many repos, move it back upstream into the canonical standards repo.
