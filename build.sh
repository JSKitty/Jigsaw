#!/bin/bash

# Build script for Jigsaw Puzzle WebXDC package
# Creates jigsaw.xdc with minified files for production

cd "$(dirname "$0")"

# Remove old package if exists
rm -f jigsaw.xdc

# Create a temporary build directory
BUILD_DIR=$(mktemp -d)
trap "rm -rf $BUILD_DIR" EXIT

# Copy source files to build directory
cp index.html "$BUILD_DIR/"
cp styles.css "$BUILD_DIR/"
cp game.js "$BUILD_DIR/"
cp webxdc.js "$BUILD_DIR/"
cp manifest.toml "$BUILD_DIR/"
cp icon.svg "$BUILD_DIR/"
[ -f icon.png ] && cp icon.png "$BUILD_DIR/"

# Copy assets folder (sounds)
if [ -d "assets" ]; then
    cp -r assets "$BUILD_DIR/"
    # Remove .DS_Store files from assets
    find "$BUILD_DIR/assets" -name ".DS_Store" -delete 2>/dev/null
fi

# Minify JavaScript files using terser (if available)
if command -v npx &> /dev/null && npm list terser &> /dev/null; then
  echo "Minifying JavaScript..."
  for file in "$BUILD_DIR"/*.js; do
    if [ -f "$file" ]; then
      npx terser "$file" \
        --compress \
        --mangle \
        --output "$file"
    fi
  done
else
  echo "Note: Install terser for JS minification (npm install terser)"
fi

# Minify CSS (simple minification)
if [ -f "$BUILD_DIR/styles.css" ]; then
  echo "Minifying CSS..."
  perl -0777 -pe '
    # Remove CSS comments
    s|/\*.*?\*/||gs;
    # Remove leading/trailing whitespace from lines
    s/^\s+//gm;
    s/\s+$//gm;
    # Remove newlines
    s/\n//g;
    # Remove spaces around special characters
    s/\s*([{};:,>+~])\s*/$1/g;
  ' "$BUILD_DIR/styles.css" > "$BUILD_DIR/styles.css.min" && mv "$BUILD_DIR/styles.css.min" "$BUILD_DIR/styles.css"
fi

# Minify HTML file
if [ -f "$BUILD_DIR/index.html" ]; then
  echo "Minifying HTML..."
  perl -0777 -pe '
    # Remove HTML comments
    s/<!--.*?-->//gs;
    # Remove leading/trailing whitespace from lines
    s/^\s+//gm;
    s/\s+$//gm;
    # Remove empty lines
    s/\n\s*\n/\n/g;
  ' "$BUILD_DIR/index.html" > "$BUILD_DIR/index.html.min" && mv "$BUILD_DIR/index.html.min" "$BUILD_DIR/index.html"
fi

# Create zip with maximum compression (-9)
cd "$BUILD_DIR"
zip -9 -r "$OLDPWD/jigsaw.xdc" . \
  -x "*.DS_Store" \
  -x "*.md"

echo ""
echo "✅ Built jigsaw.xdc"
echo "📦 Package size: $(du -h "$OLDPWD/jigsaw.xdc" | cut -f1)"
echo ""
echo "Package contents:"
unzip -l "$OLDPWD/jigsaw.xdc"
