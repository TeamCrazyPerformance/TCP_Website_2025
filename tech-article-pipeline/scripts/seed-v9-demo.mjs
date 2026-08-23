#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const sourcePath = process.argv[2];

if (!sourcePath) {
  console.error("Usage: node seed-v9-demo.mjs /path/to/public-data.js");
  process.exit(1);
}

const resolvedSourcePath = path.resolve(sourcePath);
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(resolvedSourcePath, "utf8"), context, {
  filename: resolvedSourcePath,
});

const sourceData = context.window.TCPTechArticlesData;
if (!sourceData || !Array.isArray(sourceData.articles)) {
  throw new Error("TCPTechArticlesData.articles를 목업 데이터에서 찾지 못했습니다.");
}

// v9 목업의 표시용 분류를 최종 API의 허용 태그 계약으로 변환한다.
const TAG_MAP = Object.freeze({
  "ai-ml": "AI",
  frontend: "애플리케이션 개발",
  backend: "애플리케이션 개발",
  mobile: "모바일",
  "data-db": "데이터",
  "cloud-devops": "클라우드",
  security: "보안",
  "open-source": "오픈소스",
  "language-framework": "프로그래밍 언어",
  architecture: "소프트웨어 아키텍처",
  "blockchain-web3": "산업 동향",
  "industry-career": "개발 조직",
});

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return sqlString(JSON.stringify(value));
}

function mysqlDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().replace("T", " ").replace("Z", "");
}

function canonicalTags(tags) {
  return [...new Set(tags.map((tag) => TAG_MAP[tag]).filter(Boolean))];
}

function digest(value) {
  return `UNHEX(SHA2(${sqlString(value)}, 256))`;
}

const articles = sourceData.articles;
const crawlRunId = "v9-local-demo-run";
const crawlStartedAt = mysqlDate(articles.at(-1)?.publishedAt);
const crawlCompletedAt = mysqlDate(articles[0]?.collectedAt);
const statements = [
  "SET NAMES utf8mb4;",
  "START TRANSACTION;",
  [
    "INSERT INTO crawl_runs",
    "(crawl_run_id, idempotency_key, body_digest, source_id, status, request_payload, statistics, started_at, completed_at)",
    `VALUES (${sqlString(crawlRunId)}, ${sqlString("v9-local-demo")}, ${digest("v9-local-demo")}, ${sqlString("v9-local-demo")}, 'COMPLETED', ${sqlJson({ fixture: path.basename(resolvedSourcePath) })}, ${sqlJson({ discovered: articles.length, submitted: articles.length, completed: articles.length })}, ${sqlString(crawlStartedAt)}, ${sqlString(crawlCompletedAt)})`,
    "ON DUPLICATE KEY UPDATE status = VALUES(status), request_payload = VALUES(request_payload), statistics = VALUES(statistics), completed_at = VALUES(completed_at);",
  ].join(" "),
];

for (const article of articles) {
  const submissionId = `v9-submission-${article.id}`;
  const payload = {
    source: {
      sourceId: article.sourceId,
      sourceType: article.sourceType,
      name: article.source,
    },
    normalization: { normalizedAt: article.collectedAt },
  };
  const qualityResult = {
    qualityEvaluation: {
      decision: "PASS",
      reason: "v9 로컬 화면 검증용 데이터",
      score: {
        overall: article.score,
        dimensions: {
          relevance: article.scoreBreakdown?.relevance ?? article.score,
          timeliness: article.scoreBreakdown?.freshness ?? article.score,
          sourceReliability: article.scoreBreakdown?.sourceTrust ?? article.score,
        },
      },
    },
  };
  statements.push(
    [
      "INSERT INTO pipeline_submissions",
      "(submission_id, idempotency_key, body_digest, payload, state, article_id, quality_result)",
      `VALUES (${sqlString(submissionId)}, ${sqlString(`v9-local-${article.id}`)}, ${digest(article.id)}, ${sqlJson(payload)}, 'ENRICHED', ${sqlString(article.id)}, ${sqlJson(qualityResult)})`,
      "ON DUPLICATE KEY UPDATE payload = VALUES(payload), state = VALUES(state), article_id = VALUES(article_id), quality_result = VALUES(quality_result);",
    ].join(" "),
  );
}

for (const article of articles) {
  const crawlItemId = `v9-crawl-${article.id}`;
  const submissionId = `v9-submission-${article.id}`;
  statements.push(
    [
      "INSERT INTO crawl_items",
      "(crawl_item_id, crawl_run_id, item_payload, normalization_payload, submission_id, produced_at)",
      `VALUES (${sqlString(crawlItemId)}, ${sqlString(crawlRunId)}, ${sqlJson({ title: article.title, url: article.originalUrl })}, ${sqlJson({ normalizedAt: article.collectedAt })}, ${sqlString(submissionId)}, ${sqlString(mysqlDate(article.collectedAt))})`,
      "ON DUPLICATE KEY UPDATE item_payload = VALUES(item_payload), normalization_payload = VALUES(normalization_payload), submission_id = VALUES(submission_id), produced_at = VALUES(produced_at);",
    ].join(" "),
  );
}

for (const article of articles) {
  const checkId = `v9-check-${article.id}`;
  const crawlItemId = `v9-crawl-${article.id}`;
  statements.push(
    [
      "INSERT INTO duplicate_checks",
      "(check_id, request_key, check_kind, crawl_run_id, crawl_item_id, input_digest, status, decision, policy_version, fingerprint_version, content_sha256, new_article_id, matched_by, candidates, candidate_search_status, checked_at)",
      `VALUES (${sqlString(checkId)}, ${sqlString(`v9-check-${article.id}`)}, 'INITIAL', ${sqlString(crawlRunId)}, ${sqlString(crawlItemId)}, ${digest(article.id)}, 'SUCCESS', 'UNIQUE', 'v9-local', 'v9-local', ${digest(article.summaryMarkdown)}, ${sqlString(article.id)}, JSON_ARRAY(), JSON_ARRAY(), 'COMPLETED', ${sqlString(mysqlDate(article.collectedAt))})`,
      "ON DUPLICATE KEY UPDATE status = VALUES(status), decision = VALUES(decision), content_sha256 = VALUES(content_sha256), new_article_id = VALUES(new_article_id), checked_at = VALUES(checked_at);",
    ].join(" "),
  );
}

for (const article of articles) {
  const crawlItemId = `v9-crawl-${article.id}`;
  const checkId = `v9-check-${article.id}`;
  const tags = canonicalTags(article.tags);
  const sourceId = article.source;
  const content = article.summaryMarkdown || article.oneLineSummary;
  statements.push(
    [
      "INSERT INTO articles",
      "(article_id, origin_check_id, crawl_run_id, crawl_item_id, ingest_input_digest, source_id, final_url, final_url_sha256, canonical_url, canonical_url_sha256, title, authors, content, language, original_published_at, normalizer_version, processing_status, review_status, publication_status, quality_score, quality_decision, localized_title, tags, one_line_summary, summary, localized_content, published_at)",
      `VALUES (${sqlString(article.id)}, ${sqlString(checkId)}, ${sqlString(crawlRunId)}, ${sqlString(crawlItemId)}, ${digest(article.id)}, ${sqlString(sourceId)}, ${sqlString(article.originalUrl)}, ${digest(article.originalUrl)}, ${sqlString(article.originalUrl)}, ${digest(article.originalUrl)}, ${sqlString(article.title)}, JSON_ARRAY(), ${sqlString(content)}, ${sqlString(article.originalLanguage?.code || "ko")}, ${sqlString(mysqlDate(article.publishedAt))}, 'v9-local', 'ENRICHED', 'NOT_REQUIRED', 'PUBLISHED', ${Number(article.score)}, 'PASS', ${sqlString(article.title)}, ${sqlJson(tags)}, ${sqlString(article.oneLineSummary)}, ${sqlString(article.summaryMarkdown)}, ${sqlString(content)}, ${sqlString(mysqlDate(article.publishedAt))})`,
      "ON DUPLICATE KEY UPDATE source_id = VALUES(source_id), final_url = VALUES(final_url), final_url_sha256 = VALUES(final_url_sha256), canonical_url = VALUES(canonical_url), canonical_url_sha256 = VALUES(canonical_url_sha256), title = VALUES(title), content = VALUES(content), language = VALUES(language), original_published_at = VALUES(original_published_at), processing_status = VALUES(processing_status), review_status = VALUES(review_status), publication_status = VALUES(publication_status), quality_score = VALUES(quality_score), quality_decision = VALUES(quality_decision), localized_title = VALUES(localized_title), tags = VALUES(tags), one_line_summary = VALUES(one_line_summary), summary = VALUES(summary), localized_content = VALUES(localized_content), published_at = VALUES(published_at);",
    ].join(" "),
  );
}

statements.push("COMMIT;");
process.stdout.write(`${statements.join("\n")}\n`);
