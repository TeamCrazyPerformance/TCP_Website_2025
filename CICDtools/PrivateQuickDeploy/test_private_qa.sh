#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

test_root="$(mktemp -d)"
cleanup() { rm -rf -- "$test_root"; }
trap cleanup EXIT
test_env="$test_root/private.env"

first_output="$test_root/first-output.log"
printf '\nqa-admin\nqa@example.com\nQA-password-123\n\n\n\n' \
  | PRIVATE_QA_ENV_FILE_OVERRIDE="$test_env" \
    bash -c 'source "$1/_common.sh"; private_qa_ensure_env; private_qa_validate_env' _ "$SCRIPT_DIR" \
    >"$first_output" 2>&1

for key in JWT_SECRET PIPELINE_SERVICE_TOKEN POSTGRES_PASSWORD \
  TECH_ARTICLE_MYSQL_PASSWORD TECH_ARTICLE_MYSQL_ROOT_PASSWORD; do
  value="$(awk -v prefix="$key=" 'index($0,prefix)==1 {print substr($0,length(prefix)+1)}' "$test_env")"
  [[ -n "$value" ]] || fail "$key was not generated"
  ! grep -Fq -- "$value" "$first_output" || fail "$key leaked to stdout"
done
! grep -Fq -- 'QA-password-123' "$first_output" || fail "administrator password leaked to stdout"

cp "$test_env" "$test_root/before.env"
PRIVATE_QA_ENV_FILE_OVERRIDE="$test_env" \
  bash -c 'source "$1/_common.sh"; private_qa_ensure_env; private_qa_validate_env' _ "$SCRIPT_DIR" \
  </dev/null >"$test_root/second-output.log" 2>&1
cmp -s "$test_root/before.env" "$test_env" || fail "environment changed on idempotent rerun"

case "$(uname -s)" in
  MINGW*|MSYS*) ;; # NTFS/MSYS does not expose POSIX mode bits reliably.
  *) [[ "$(stat -c '%a' "$test_env")" == "600" ]] || fail "environment file mode is not 0600" ;;
esac
[[ "$(grep -c '^    ports:$' "$SCRIPT_DIR/docker-compose.private-qa.yml")" == "1" ]] \
  || fail "only the reverse proxy may publish host ports"
grep -q '^name: tcp-private-qa$' "$SCRIPT_DIR/docker-compose.private-qa.yml" \
  || fail "compose project name is not isolated"
! grep -q 'container_name:' "$SCRIPT_DIR/docker-compose.private-qa.yml" \
  || fail "fixed global container names would collide with another stack"
grep -q 'down --volumes --remove-orphans' "$SCRIPT_DIR/private_qa.sh" \
  || fail "reset does not remove the isolated volumes"

printf 'PASS: Private QA isolated environment, secrecy, idempotency, and port contracts\n'
