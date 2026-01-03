# 🧩 Jigsaw Puzzle - WebXDC App

A beautiful, polished jigsaw puzzle game for the Vector Marketplace. Convert any image into puzzle pieces and have fun rebuilding it!

![Jigsaw Puzzle](icon.svg)

## Features

- **Multiple Difficulty Levels**: Choose from Easy (3×3), Medium (6×6), Hard (10×10), or Expert (16×16)
- **Default Puzzles**: 6 beautiful built-in landscape puzzles to get started
- **Import Your Own Images**: Use the WebXDC file picker to import any JPEG, PNG, GIF, or WebP image
- **Drag & Drop Gameplay**: Intuitive touch and mouse controls
- **Smart Snapping**: Pieces snap into place when close to their correct position
- **Visual Feedback**: Pieces glow green when correctly placed
- **Timer & Move Counter**: Track your progress
- **Preview Mode**: View the original image anytime for reference
- **Hint System**: Get help finding where a piece belongs
- **Victory Celebration**: Confetti animation when you complete the puzzle!
- **Personalized Experience**: Displays your name from the parent app (Vector Messenger, etc.)

## How to Play

1. **Select Difficulty**: Choose how many pieces you want
2. **Choose an Image**: Pick from the default gallery or import your own
3. **Solve the Puzzle**: Drag pieces to their correct positions
4. **Use Hints**: Click the hint button if you get stuck
5. **Preview**: Click the eye icon to see the complete image

## Building the WebXDC Package

To create the `.xdc` file for distribution:

```bash
# Create the WebXDC package (it's just a zip file with .xdc extension)
.build.sh
```

## Development

To test locally, simply open `index.html` in a web browser. The `webxdc.js` file provides a simulator that mocks the WebXDC API for development purposes.

## WebXDC API Usage

This app uses the following WebXDC APIs:

- `window.webxdc.selfName` - Displays the user's name from their messenger app
- `window.webxdc.importFiles()` - Allows importing custom puzzle images

## File Structure

```
├── index.html      # Main HTML structure
├── styles.css      # All styling (dark theme, responsive)
├── game.js         # Game logic and puzzle mechanics
├── webxdc.js       # WebXDC API simulator for development
├── manifest.toml   # WebXDC app manifest
├── icon.svg        # App icon (vector)
├── icon.png        # App icon (raster)
└── README.md       # This file
```

## License

MIT License - Feel free to use, modify, and distribute!

## Credits

Created by JSKitty of Vector Privacy, for the WebXDC marketplace, photographers are fully attributed in-game for each puzzle. Enjoy puzzling! 🧩
