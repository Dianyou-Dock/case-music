#!/usr/bin/env bash
set -euo pipefail

backend_dir="$(cd "$(dirname "$0")/.." && pwd)"
core_dir="$(cd "$backend_dir/.." && pwd)"
dist_dir="$backend_dir/target/cef-linux"

cd "$core_dir"
pnpm build
cd "$backend_dir"
cargo build --release --no-default-features --features cef-webview

cef_dir="$(find "$backend_dir/target/release/build" -path '*/out/cef_linux_x86_64/libcef.so' -print -quit)"
if [[ -z "$cef_dir" ]]; then
  echo 'CEF runtime files were not found' >&2
  exit 1
fi
cef_dir="$(dirname "$cef_dir")"

mkdir -p "$dist_dir"
install -m 755 "$backend_dir/target/release/core" "$dist_dir/core"
rsync -a \
  --include='/locales/***' \
  --include='/*.so' \
  --include='/*.so.*' \
  --include='/*.pak' \
  --include='/icudtl.dat' \
  --include='/v8_context_snapshot.bin' \
  --include='/vk_swiftshader_icd.json' \
  --include='/chrome-sandbox' \
  --include='/CREDITS.html' \
  --exclude='*' \
  "$cef_dir/" "$dist_dir/"

cat > "$dist_dir/case-music" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
app_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$app_dir"
export LD_LIBRARY_PATH="$app_dir${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec "$app_dir/core" "$@"
EOF
chmod 755 "$dist_dir/case-music"
echo "$dist_dir/case-music"
