#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
backend="$project_root/backend"
version="$(node -p "require('$project_root/package.json').version")"
input_deb="${1:-$backend/target/release/bundle/deb/case-music_${version}_amd64.deb}"
cef_dir="$(find "$backend/target/release/build" -path '*/out/cef_linux_x86_64/libcef.so' -printf '%h\n' | head -n 1)"
if [[ -z "$cef_dir" || ! -f "$input_deb" ]]; then
  echo 'Missing desktop deb or Chromium runtime' >&2
  exit 1
fi
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
dpkg-deb -R "$input_deb" "$stage"
mkdir -p "$stage/opt/case-music" "$stage/usr/bin"
chmod 755 "$stage" "$stage/opt" "$stage/opt/case-music" "$stage/usr" "$stage/usr/bin"
mv "$stage/usr/bin/core" "$stage/opt/case-music/core"
for pattern in '*.so' '*.so.1' '*.pak' '*.dat' '*.bin' '*icd.json'; do
  find "$cef_dir" -maxdepth 1 -type f -name "$pattern" -exec cp -a '{}' "$stage/opt/case-music/" \;
done
cp -a "$cef_dir/locales" "$stage/opt/case-music/"
strip --strip-debug "$stage/opt/case-music/libcef.so"
cat > "$stage/usr/bin/core" <<'WRAPPER'
#!/usr/bin/env bash
cd /opt/case-music
export LD_LIBRARY_PATH="/opt/case-music${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec /opt/case-music/core "$@"
WRAPPER
chmod 755 "$stage/usr/bin/core"
cat > "$stage/DEBIAN/postinst" <<'POSTINST'
#!/bin/sh
set -e
chmod 755 /opt/case-music
POSTINST
chmod 755 "$stage/DEBIAN/postinst"
sed -i "s/^Version: .*/Version: ${version}-1/" "$stage/DEBIAN/control"
output="$backend/target/release/bundle/deb/case-music_${version}-1_amd64.deb"
dpkg-deb --build --root-owner-group -Zxz -z3 "$stage" "$output"
echo "$output"
