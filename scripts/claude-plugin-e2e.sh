#!/usr/bin/env bash
# SkillHub × Claude Code CLI 真实端到端安装验证
#
# 用真实的 `claude plugin` 命令走完 市场添加 → 插件安装 → 列表校验 → 卸载 → 移除市场 全链路，
# 确保生成的 marketplace.json / plugin.json 符合 Claude Code 当前 schema。
#
# 注意：会读写 ~/.claude/（用户级配置），执行前会自动备份 known_marketplaces.json。
#
# 用法：bash scripts/claude-plugin-e2e.sh [市场地址]
#   默认地址 http://127.0.0.1:3001/skillhub.git
set -uo pipefail

MARKET_URL="${1:-http://127.0.0.1:3001/skillhub.git}"
MARKET_NAME="skillhub"
PASS=0
FAIL=0
FAILED_CASES=()

# 记录一条用例结果
check() {
  local name="$1" ok="$2" detail="${3:-}"
  if [[ "$ok" == "0" ]]; then
    PASS=$((PASS + 1))
    printf '  \033[32m✔\033[0m %s\n' "$name"
  else
    FAIL=$((FAIL + 1))
    FAILED_CASES+=("$name${detail:+ — $detail}")
    printf '  \033[31m✘\033[0m %s%s\n' "$name" "${detail:+ — $detail}"
  fi
}

command -v claude >/dev/null 2>&1 || { echo "未找到 claude CLI，跳过端到端安装验证"; exit 0; }

printf '\n\033[1mClaude Code 插件安装端到端验证\033[0m  market=%s\n' "$MARKET_URL"
printf '%s\n' "────────────────────────────────────────────────────────────"
printf '  CLI 版本: %s\n\n' "$(claude --version 2>/dev/null | head -1)"

# 0. 备份用户级市场配置，测试结束后恢复
BACKUP_DIR="$(mktemp -d)"
KNOWN_JSON="$HOME/.claude/plugins/known_marketplaces.json"
[[ -f "$KNOWN_JSON" ]] && cp "$KNOWN_JSON" "$BACKUP_DIR/" 2>/dev/null

# 1. 先移除同名市场，保证从干净状态开始
claude plugin marketplace remove "$MARKET_NAME" >/dev/null 2>&1

# 2. 添加市场（会校验 marketplace.json schema，owner 缺失时会在此失败）
ADD_OUT="$(claude plugin marketplace add "$MARKET_URL" 2>&1)"
[[ "$ADD_OUT" == *"Successfully added marketplace"* ]]
check "添加插件市场 (marketplace.json schema 校验)" "$?" "$(echo "$ADD_OUT" | tail -1)"

# 3. 从 marketplace.json 中读取全部插件名，逐个真实安装
PLUGIN_NAMES="$(curl -fsS "${MARKET_URL%/skillhub.git}/.claude-plugin/marketplace.json" 2>/dev/null \
  | python3 -c 'import sys,json;print("\n".join(p["name"] for p in json.load(sys.stdin).get("plugins",[])))' 2>/dev/null)"

if [[ -z "$PLUGIN_NAMES" ]]; then
  check "读取市场插件清单" 1 "无法解析 marketplace.json"
else
  check "读取市场插件清单" 0
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    OUT="$(claude plugin install "${name}@${MARKET_NAME}" 2>&1)"
    [[ "$OUT" == *"Successfully installed plugin"* ]]
    check "安装插件 ${name}@${MARKET_NAME} (plugin.json schema 校验)" "$?" "$(echo "$OUT" | tail -1 | cut -c1-160)"
  done <<< "$PLUGIN_NAMES"

  # 4. claude plugin list 中应能看到全部已装插件且状态为 enabled
  LIST_OUT="$(claude plugin list 2>&1)"
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    echo "$LIST_OUT" | grep -q "${name}@${MARKET_NAME}"
    check "plugin list 中可见 ${name}" "$?"
  done <<< "$PLUGIN_NAMES"

  # 5. 校验安装后的插件缓存目录结构（plugin.json + SKILL.md 均落地）
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    CACHE_DIR="$HOME/.claude/plugins/cache/${MARKET_NAME}/${name}"
    [[ -d "$CACHE_DIR" ]] && [[ -n "$(find "$CACHE_DIR" -name plugin.json -print -quit)" ]]
    check "缓存目录含 plugin.json: ${name}" "$?" "$CACHE_DIR"
    [[ -n "$(find "$CACHE_DIR" -name 'SKILL.md' -print -quit)" ]]
    check "缓存目录含 SKILL.md: ${name}" "$?"
    SKILL_FILE="$(find "$CACHE_DIR" -name 'SKILL.md' -print -quit)"
    [[ -n "$SKILL_FILE" ]] && head -1 "$SKILL_FILE" | grep -q '^---$'
    check "SKILL.md 带 YAML frontmatter: ${name}" "$?"
  done <<< "$PLUGIN_NAMES"

  # 6. 卸载全部测试安装的插件
  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    OUT="$(claude plugin uninstall "${name}@${MARKET_NAME}" 2>&1)"
    [[ "$OUT" == *"Successfully uninstalled plugin"* ]]
    check "卸载插件 ${name}" "$?" "$(echo "$OUT" | tail -1 | cut -c1-120)"
  done <<< "$PLUGIN_NAMES"
fi

# 7. 移除市场并恢复原有配置
RM_OUT="$(claude plugin marketplace remove "$MARKET_NAME" 2>&1)"
[[ "$RM_OUT" == *"Successfully removed marketplace"* ]]
check "移除插件市场" "$?" "$(echo "$RM_OUT" | tail -1)"

[[ -f "$BACKUP_DIR/known_marketplaces.json" ]] && cp "$BACKUP_DIR/known_marketplaces.json" "$KNOWN_JSON" 2>/dev/null
rm -rf "$BACKUP_DIR"

printf '%s\n' "────────────────────────────────────────────────────────────"
printf '\033[32m通过 %d\033[0m  \033[31m失败 %d\033[0m  合计 %d\n' "$PASS" "$FAIL" "$((PASS + FAIL))"
if ((FAIL > 0)); then
  printf '\n\033[31m失败明细:\033[0m\n'
  for i in "${!FAILED_CASES[@]}"; do printf '  %d. %s\n' "$((i + 1))" "${FAILED_CASES[$i]}"; done
  echo
  exit 1
fi
echo
