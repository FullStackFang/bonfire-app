A spark — the droppable one-line plan at the center of Live Pulse. Three fields (title + place + time-or-"now") and an "I'm in" button. It's a statement, not an invite: no Going/Maybe, nobody asks. Multiple sparks live at once; each dies on its `ttl`.

```jsx
<SparkCard fresh title="Sunset at the windmills" place="Oia" time="8:30pm"
  ttl="ends 9:30p" count={4} people={[{initials:'T'},{initials:'M'}]} />
```

- `fresh` gives the ember-glow treatment for a just-dropped spark. Title is display italic (editorial), never a plain sans heading.
- Set `joined` after the user taps in — the button flips to a quiet "you're in".
