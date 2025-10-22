#!/bin/bash

# Create simple valid PNG icons using base64 encoded data
# These are minimal solid orange squares - Chrome will accept them

# 16x16 orange square PNG
echo "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVR42mP8z8DwHwYGBgYGBgYGBgYGBgYGBhgAACAAEAAElKN+AAAAAElFTkSuQmCC" | base64 -D > icon16.png

# 48x48 orange square PNG
cat > icon48.png << 'PNGEOF'
iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAgElEQVR42u3QMQoAIAwDQP3/p3UR
HIpLoUMugiBJkyRJkiRJkiRJkqT/eGCttda6rrvXWmuttdZaa6211lprrbXWWmuttdZaa6211lpr
rbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbX2swYAAAD//wMA
Z8oCDDqB/fIAAAAASUVORK5CYII=
PNGEOF

base64 -D < icon48.png > icon48_temp.png
mv icon48_temp.png icon48.png

# 128x128 orange square PNG  
cat > icon128.png << 'PNGEOF'
iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAmklEQVR42u3QMQoAIAwDQPX/ny4i
OBSXQodcBEGSJkmSJEmSJEmSJEmS/sEDa6211rquWmuttdZaa6211lprrbXWWmuttdZaa6211lpr
rbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa621
1lprrbXWWmuttdZaa6211lprrbX2sw4AAAD//wMArUICDJ7OQ3YAAAAASUVORK5CYII=
PNGEOF

base64 -D < icon128.png > icon128_temp.png
mv icon128_temp.png icon128.png

echo "🦆 Created placeholder icon files"
ls -lh *.png
file *.png
