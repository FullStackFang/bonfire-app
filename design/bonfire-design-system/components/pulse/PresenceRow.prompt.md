One person in the ambient "who's up to what" roster: avatar (halo when `here`), name, a `StatusPill`, and an optional freeform note. Set `you` to highlight the current user's own row in ember.

```jsx
<PresenceRow person={{name:'Maya', initials:'M', color:'var(--avatar-orange)'}} status="around" note="by the harbor, easy to grab" time="2m" />
```

- The note is optional and freeform — context the status alone can't carry. Shows current state only; no history.
