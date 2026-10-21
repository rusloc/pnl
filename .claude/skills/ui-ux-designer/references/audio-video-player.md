# Audio / Video Player — Sketching Guide

## What this block exists to do

Play media. The user came to consume content — audio, video, podcast, live stream — and the block exists to let them do that with zero fumbling. Controls must be **instantly recognizable** and the embed surface (the video frame or album art) should be the visual anchor of the block.

## Primary action

For a player block, the primary action is almost always:
- **Play** (if not yet playing)
- **Pause** (if currently playing)

Everything else — seek, volume, fullscreen, chapters, queue, share — is secondary. The play/pause control should be the biggest, most central, most tappable element on the block.

## Skeleton — video player

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│         EMBED SURFACE (video frame)                 │
│         - Poster image when not playing             │
│         - BIG centered play button overlay          │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [▶/⏸]  [──●────────]  0:42 / 12:15   [🔊] [⛶]     │
│   play   scrub/progress                 vol  full   │
├─────────────────────────────────────────────────────┤
│  TITLE / METADATA                                   │
│  Description, uploader, timestamp                   │
├─────────────────────────────────────────────────────┤
│  SECONDARY ACTIONS  [share] [save] [transcript]     │
└─────────────────────────────────────────────────────┘
```

## Skeleton — audio player (full-width / page block)

```
┌─────────────────────────────────────────────────────┐
│  [cover art]   TRACK / EPISODE TITLE                │
│  ┌────────┐    Artist / Show                        │
│  │        │    ──────────────────────────           │
│  │  art   │    [──●─────────────]  2:11 / 45:30    │
│  │        │                                         │
│  └────────┘    [⏮]  [   ▶/⏸   ]  [⏭]  [🔊] [⋯]   │
│                 prev    play       next  vol  more  │
└─────────────────────────────────────────────────────┘
```

## Skeleton — mini / persistent audio bar (e.g., bottom of app)

```
┌─────────────────────────────────────────────────────┐
│  [art] Title — Artist   [▶/⏸] [⏭]   [──●─────]     │
└─────────────────────────────────────────────────────┘
```

## Skeleton — embed placement on a content page

When the player is embedded *within* a larger page (blog post, episode page, artist page), the embed surface should:
- Sit near the **top** of the content area, above the long-form text
- Be **full content-width** (not squeezed into a sidebar)
- Have a clear visual boundary (a frame, a slight background contrast) so users see it as a distinct playable element
- Not be the first thing on the entire page — the page title and a short context line come first, so the user knows *what* they're about to play before they press play

```
┌─────────────────────────────────────────────────────┐
│  PAGE TITLE                                         │
│  One-line context (episode number, date, guest)     │
├─────────────────────────────────────────────────────┤
│                                                     │
│       [ PLAYER EMBED — full content width ]         │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Show notes, transcript, long-form content...       │
└─────────────────────────────────────────────────────┘
```

## Discoverability priorities for players

### Play/pause is the biggest thing
The play button is visually the largest control. It's centered in the transport bar (or overlaid on the video frame). It changes shape between play (▶) and pause (⏸) but stays in the same position. Never move it based on state.

### Use universally recognized icons
- ▶ play, ⏸ pause, ⏭ next, ⏮ previous, 🔊 volume, ⛶ fullscreen
- Don't invent custom icons for transport controls. Users have decades of muscle memory — honor it.

### Touch targets are generous
On mobile, transport controls need at least 44×44px touch targets (Apple HIG) or 48×48dp (Material). A tiny play button on mobile is a design failure even if it looks elegant on desktop.

### Progress bar is scrubbable, not just a progress indicator
Users expect to click/drag anywhere on the bar to seek. Display the current time and total duration next to the bar, not hidden in a tooltip.

### Embed surface signals "this is playable"
When the video/audio is paused and not yet started, the embed surface shows:
- A poster image (for video) or cover art (for audio)
- A large, centered, obvious play button overlay
- Subtle hover treatment on desktop (tint or zoom) to reinforce interactivity

A black rectangle with no play button is a broken player in the user's eyes, even if it works.

### Keep secondary controls in their lane
Volume, speed, quality, chapters, share, save, transcript — these are secondary. Group them on one side of the transport bar, or hide them behind a "..." more menu if the bar is crowded. They should never compete visually with play/pause.

### Respect the user's browsing context
- **Never autoplay with sound.** It's jarring, often blocked, and almost always unwanted.
- **If autoplay is used at all, mute by default** and show a clear "unmute" affordance.
- **Persistent playback** (keeps playing when user scrolls away) requires a mini-bar — see the persistent audio skeleton above.

## Common player traps

- **Play button hidden in the album art** with no visible indicator. Users don't know the art is tappable.
- **Custom transport icons that aren't universally understood.** (A stylized triangle that doesn't read as "play.")
- **Progress bar without time display.** User can't tell how long is left.
- **Volume slider that obscures the progress bar on hover.** (Common on cramped designs.)
- **Mobile: transport controls rendered at desktop size** — too small to tap.
- **Autoplay with sound.** Just don't.
- **Fullscreen button that doesn't actually fullscreen** (just expands to viewport), or no fullscreen at all on video.
- **The entire player is the same dark gray as the page background**, so the boundary of the embed is invisible.
- **Seek bar jumps around when buffering.** Layout stability matters here.
- **No keyboard controls.** Space should play/pause, arrow keys should seek. Required for accessibility.

## What the user often forgets to think about

- **Loading state.** What do they see between clicking play and audio/video actually starting? A spinner overlay on the embed surface.
- **Error state.** If the media fails to load, is there a clear, non-scary error message with a retry option?
- **Captions / transcript.** For video, a CC button is table stakes. For audio/podcast, a transcript link is increasingly expected.
- **Chromecast / AirPlay / cast buttons.** If the content is long-form, users want to send it to a bigger screen.
- **Chapter markers.** For long content, chapters or timestamps in the transcript dramatically improve discoverability of specific moments.
- **Dark mode / light mode** — players often look great in one mode and broken in the other. Check both.

## Output checklist

When sketching a player, your response should include:
- The named primary action (play/pause)
- Transport control layout with play/pause as visually dominant
- Embed surface treatment (poster, play overlay)
- Mobile vs. desktop variants if relevant
- Context/page placement if it's an embedded player on a larger page
- Secondary-controls grouping
- Explicit notes on autoplay behavior