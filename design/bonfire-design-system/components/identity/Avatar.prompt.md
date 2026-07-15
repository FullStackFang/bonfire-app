Circular avatar. Photo-first (real faces, per brand doctrine); the letter pair on an accent color is only a fallback for a missing photo. `live` adds the breathing spark halo used for the "here now" state; `ring` outlines "you".

```jsx
<Avatar initials="M" color="var(--avatar-purple)" size={40} />
<Avatar initials="J" live size={44} />
```

- Six accent bands, assigned deterministically via `avatarColorFor(name)`.
- Never illustrate or use Bitmoji-style cartoon avatars.
