#!/usr/bin/env bash

set -euo pipefail

find_java_21() {
  local candidate
  local version
  local major

  for candidate in \
    "${JAVA_HOME:-}/bin/java" \
    "/opt/homebrew/opt/openjdk@21/bin/java" \
    "/usr/local/opt/openjdk@21/bin/java" \
    "/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home/bin/java"
  do
    if [[ -x "$candidate" ]]; then
      version="$("$candidate" -version 2>&1 | head -n 1)"
      major="$(sed -E 's/.*version "([0-9]+).*/\1/' <<<"$version")"
      if [[ "$major" =~ ^[0-9]+$ ]] && (( major >= 21 )); then
        printf '%s\n' "$candidate"
        return 0
      fi
    fi
  done

  if command -v java >/dev/null 2>&1; then
    candidate="$(command -v java)"
    version="$("$candidate" -version 2>&1 | head -n 1 || true)"
    major="$(sed -E 's/.*version "([0-9]+).*/\1/' <<<"$version")"
    if [[ "$major" =~ ^[0-9]+$ ]] && (( major >= 21 )); then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  return 1
}

if [[ "$#" -eq 0 ]]; then
  echo "Usage: scripts/with-java-21.sh <command> [arguments...]" >&2
  exit 2
fi

if ! java_binary="$(find_java_21)"; then
  echo "Java 21 or newer is required for Firebase rules tests." >&2
  echo "Install it with: brew install openjdk@21" >&2
  exit 1
fi

export JAVA_HOME="$(dirname "$(dirname "$java_binary")")"
export PATH="$(dirname "$java_binary"):$PATH"

exec "$@"
