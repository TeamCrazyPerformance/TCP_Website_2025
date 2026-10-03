import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSharedDemoData } from "./shared-demo-data.mjs";

const data = createSharedDemoData();
const stringsOf = (value) => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(stringsOf);
  return [];
};

test("shared fixtures retain representative screen data without real identities", () => {
  assert.equal(data.demoMembers.length, 38);
  assert.equal(data.demoAnnouncements.length, 7);
  assert.equal(data.demoStudies.length, 5);
  assert.equal(data.demoTeams.length, 4);
  assert.equal(new Set(data.demoMembers.map((member) => member.id)).size, 38);
  assert.deepEqual(
    new Set(data.demoMembers.map((member) => member.education_status)),
    new Set(["재학", "휴학", "졸업"]),
  );

  for (const member of data.demoMembers) {
    assert.match(member.id, /^demo-member-\d+$/);
    assert.match(member.name, /^데모 회원 \d{2}$/);
    if (member.self_description)
      assert.match(member.self_description, /합성 자기소개/);
    if (member.current_company)
      assert.match(member.current_company, /^데모 소속 \d{2}/);
    assert.equal(member.github_username, null);
    assert.equal(member.profile_image, "/images/default_profile.webp");
  }
  for (const post of [...data.demoStudies, ...data.demoTeams]) {
    assert.match(post.study_name || post.title, /^\[데모\]/);
    assert.match(post.study_description || post.description, /실제/);
  }
});

test("contacts and external links use reserved .invalid destinations", () => {
  const strings = stringsOf(data);
  const urls = strings.flatMap(
    (value) => value.match(/https?:\/\/[^\s<>"`]+/g) || [],
  );
  const emails = strings.flatMap(
    (value) => value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [],
  );
  assert.ok(urls.length > 0);
  assert.ok(emails.length > 0);
  for (const url of urls)
    assert.equal(new URL(url).hostname, "example.invalid");
  for (const email of emails) assert.match(email, /@example\.invalid$/);
  assert.doesNotMatch(
    strings.join("\n"),
    /open\.kakao\.com|discord\.gg|discord\.com\/invite|\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b/i,
  );
});

test("study and team identities refer to the same synthetic profiles", () => {
  const members = new Map(
    data.demoMembers.map((member) => [member.id, member]),
  );
  const counts = new Map([
    [18, 2],
    [19, 2],
    [21, 2],
    [22, 1],
    [23, 1],
  ]);
  for (const study of data.demoStudies) {
    assert.equal(study.members.length, counts.get(study.id));
    assert.equal(study.leader.name, members.get(study.leader.user_id).name);
    assert.equal(
      study.members.filter((member) => member.role === "LEADER").length,
      1,
    );
    assert.ok(
      study.members.some((member) => member.user_id === study.leader.user_id),
    );
    for (const participant of study.members)
      assert.equal(participant.name, members.get(participant.user_id).name);
  }
  for (const team of data.demoTeams)
    assert.equal(team.leader.name, members.get(team.leader.id).name);
  for (const post of data.demoAnnouncements)
    assert.ok(
      data.demoMembers.some((member) => member.name === post.author.name),
    );
});

test("development fallbacks have synthetic names and no real account/contact destinations", async () => {
  for (const file of ["members.js", "teams.js"]) {
    const source = await readFile(
      new URL(`../src/data/${file}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /데모 대체/);
    const urls = source.match(/https?:\/\/[^\s'"`]+/g) || [];
    for (const url of urls)
      assert.equal(new URL(url).hostname, "example.invalid");
    const emails =
      source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    for (const email of emails) assert.match(email, /@example\.invalid$/);
    assert.doesNotMatch(
      source,
      /github\.com|via\.placeholder\.com|images\.unsplash\.com/,
    );
  }
});

test(
  "the running Mock API serves the synthetic fixtures and existing article contracts",
  { timeout: 15000 },
  async () => {
    const child = spawn(
      process.execPath,
      [new URL("./mock-tech-articles-api.mjs", import.meta.url).pathname],
      {
        env: { ...process.env, PORT: "0", MOCK_HOST: "127.0.0.1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const exited = new Promise((resolve) => child.once("exit", resolve));
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    try {
      const origin = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Mock startup timed out: ${stderr}`)),
          5000,
        );
        let stdout = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
          const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)/);
          if (match && Number(match[1]) > 0) {
            clearTimeout(timer);
            resolve(match[0]);
          }
        });
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error(`Mock exited before startup: ${stderr}`));
        });
      });
      const get = async (path) => {
        const response = await fetch(`${origin}/api/v1/${path}`, {
          signal: AbortSignal.timeout(3000),
        });
        assert.equal(response.status, 200, path);
        return response.json();
      };
      assert.deepEqual(
        await get("members"),
        createSharedDemoData().demoMembers,
      );
      assert.equal((await get("announcements")).length, 7);
      assert.equal((await get("teams")).length, 4);
      const studies = await get("study");
      assert.equal(studies.length, 5);
      assert.ok(studies.some((study) => !study.is_public));
      for (const study of studies)
        assert.equal(study.members_count, study.members.length);
      const detail = await get("study/18");
      assert.equal(detail.members_count, 2);
      assert.match(detail.leader.name, /^데모 회원/);
      const articles = await get("tech-articles?page=1&pageSize=20");
      assert.equal(articles.items.length, 20);
      assert.ok(
        articles.items.every((article) => !Object.hasOwn(article, "authors")),
      );
      const adminArticles = await get(
        "admin/tech-articles?page=1&pageSize=130",
      );
      assert.equal(adminArticles.items.length, 130);
      for (const article of adminArticles.items) {
        assert.ok(article.authors.length > 0);
        for (const author of article.authors)
          assert.match(author, /^데모 작성자 \d{2}$/);
      }
      const activity = await get("main/activity-images");
      assert.ok(stringsOf(activity).every((value) => !value.includes("@")));
    } finally {
      child.kill("SIGTERM");
      await exited;
    }
  },
);
