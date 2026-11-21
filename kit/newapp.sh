#!/bin/bash
# Usage: newapp.sh <folder> "<App name>" "<Short name>" "<One-line description>" "<Monogram>" "<accent hex>"
set -e
D="$(dirname "$0")/../../$1"; K="$(dirname "$0")"
mkdir -p "$D"
cp $K/kit.css $K/kit.js "$D/"
sed "s/APPID/$1/" $K/sw.js > "$D/sw.js"
printf '{\n  "headers": [{ "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }]\n}\n' > "$D/vercel.json"
cat > "$D/manifest.webmanifest" <<M
{
  "name": "$2",
  "short_name": "$3",
  "description": "$4",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#F7F9FB",
  "theme_color": "#17212E",
  "icons": [{ "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }]
}
M
cat > "$D/icon.svg" <<S
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#17212E"/><rect x="8" y="46" width="48" height="6" rx="3" fill="$6"/><text x="32" y="38" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="24" fill="#F7F9FB">$5</text></svg>
S
echo "created $D"
