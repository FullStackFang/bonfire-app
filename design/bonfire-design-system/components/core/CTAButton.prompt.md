The chunky 3D-press button — ember face on an ember-deep offset that the face sinks into on press. Bonfire's entire depth vocabulary lives here; never inline a flat rounded `<Pressable>`. Reserve `primary` (ember) for the one committal action on a screen — "I'm in", "Join". Use `outline` for secondary, `ghost` only for skip/not-now.

```jsx
<CTAButton variant="primary"><Ember size={16} /> I’m in</CTAButton>
<CTAButton variant="outline">Save my spot</CTAButton>
<CTAButton variant="ghost">No thanks — I’ll keep checking back</CTAButton>
```

- Pill shape only, height 56 (60 with `sub`). Depth is 5px.
- No ambient shadow anywhere else — this offset IS the elevation system.
