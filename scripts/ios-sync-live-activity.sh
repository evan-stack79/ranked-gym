#!/usr/bin/env bash
# Sync ios-native → ios/App (plugin + widget UI). Safe before `npx cap sync ios`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/ios-native"
APP_PLUGINS="$ROOT/ios/App/App/Plugins"
WIDGET="$ROOT/ios/App/RestTimerLiveActivityWidget"

mkdir -p "$APP_PLUGINS" "$WIDGET"
cp "$SRC/RestTimerLiveActivity/"*.swift "$APP_PLUGINS/"
cp "$SRC/RestTimerLiveActivityWidget/RestTimerLiveActivityWidget.swift" "$WIDGET/"
cp "$SRC/RestTimerLiveActivityWidget/Info.plist" "$WIDGET/"
rsync -a --delete "$SRC/RestTimerLiveActivityWidget/Assets.xcassets/" "$WIDGET/Assets.xcassets/"

echo "OK — Live Activity sources synced into ios/App (cap sync preserves Plugins/ + custom target)."
