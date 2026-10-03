const DEMO_ORIGIN = "https://example.invalid";
const PROFILE_IMAGE = "/images/default_profile.webp";
const DAY_MS = 24 * 60 * 60 * 1000;
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

export const createSharedDemoData = (now = new Date()) => {
  const demoDate = (offset) =>
    new Date(now.getTime() + SEOUL_OFFSET_MS + offset * DAY_MS)
      .toISOString()
      .slice(0, 10);
  const studyDate = (offset) => demoDate(offset).replace(/-/g, ".");
  const year = Number(demoDate(0).slice(0, 4));
  const tagSets = [
    ["React", "TypeScript", "프론트엔드"],
    ["Python", "머신러닝"],
    ["Java", "Spring Boot", "백엔드"],
    ["보안", "Linux"],
    ["Flutter", "모바일"],
  ];

  const demoMembers = Array.from({ length: 38 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: `demo-member-${index + 1}`,
      name: `데모 회원 ${number}`,
      education_status: ["재학", "휴학", "졸업"][index % 3],
      self_description:
        index % 4 === 0
          ? null
          : index % 4 === 1
            ? ""
            : `화면 확인을 위한 합성 자기소개 ${number}입니다. 새로운 개발 도구를 배우고 예제 프로젝트를 만드는 가상의 회원입니다.`,
      tech_stack: index % 4 === 0 ? [] : [...tagSets[index % tagSets.length]],
      profile_image: PROFILE_IMAGE,
      github_username: null,
      portfolio_link:
        index % 5 === 0 ? `${DEMO_ORIGIN}/portfolio/${number}` : null,
      current_company:
        index % 3 === 2 ? `데모 소속 ${number} · 가상 개발팀` : null,
    };
  });

  const member = (number) => demoMembers[number - 1];
  const studyMember = (number, role) => ({
    user_id: member(number).id,
    name: member(number).name,
    role,
    major: null,
    profile_image: PROFILE_IMAGE,
  });
  const study = (id, title, leaderNumber, memberNumbers, overrides = {}) => ({
    id,
    study_name: `[데모] ${title}`,
    start_year: 2026,
    study_description: `화면 테스트를 위한 가상의 스터디입니다. 실제 모임이나 참여자 정보를 나타내지 않습니다.\n\n## 예제 학습 계획\n- 첫 모임: 개발 환경 설정\n- 다음 모임: 예제 코드 작성과 리뷰\n\n데모 초대 링크(접속 불가): ${DEMO_ORIGIN}/invites/study-${id}`,
    tag: "컴퓨터과학,개발",
    recruit_count: 10,
    period: "2026.03 ~ 2026.06",
    apply_deadline: "2026-03-15T23:59:59+09:00",
    place: "가상 학습실 A",
    way: "온라인",
    cycle: "주 1회",
    is_public: false,
    leader: {
      user_id: member(leaderNumber).id,
      name: member(leaderNumber).name,
    },
    members: [
      studyMember(leaderNumber, "LEADER"),
      ...memberNumbers.map((number) => studyMember(number, "MEMBER")),
    ],
    ...overrides,
  });

  const demoStudies = [
    study(18, "개발 환경 입문 스터디", 1, [2], {
      tag: "개발자 도구,컴퓨터공학개론",
      period: "2026.03 ~ 2026.05",
      recruit_count: 30,
    }),
    study(19, "AI 도구 탐구 스터디", 3, [4], {
      tag: "AI,LLM,머신러닝",
      period: "2026.03 ~ 2026.05",
      recruit_count: 25,
      is_public: true,
    }),
    study(21, "웹 보안 실습 스터디", 5, [6], {
      tag: "보안,웹해킹",
      recruit_count: 20,
      is_public: true,
    }),
    study(22, "웹 프로젝트 스터디", 7, [], {
      tag: "웹,프론트엔드,백엔드",
      recruit_count: 15,
    }),
    study(23, "머신러닝 기초 스터디", 8, [], {
      tag: "머신러닝,Python",
      recruit_count: 12,
    }),
    study(24, "TypeScript 실전 스터디", 9, [], {
      start_year: year,
      tag: "TypeScript,웹",
      period: `${studyDate(-7)} ~ ${studyDate(30)}`,
      apply_deadline: `${demoDate(-8)}T23:59:59+09:00`,
      recruit_count: 6,
      is_public: true,
    }),
    study(25, "알고리즘 스터디", 10, [], {
      start_year: year,
      tag: "알고리즘",
      period: `${studyDate(14)} ~ ${studyDate(60)}`,
      apply_deadline: `${demoDate(13)}T23:59:59+09:00`,
      recruit_count: 8,
      way: "오프라인",
      place: "가상 학습실 B",
    }),
    study(26, "기간 미정 스터디", 11, [], {
      start_year: year,
      period: null,
      apply_deadline: null,
      recruit_count: 5,
    }),
  ];

  const announcementExamples = [
    [12, "[데모 안내] 가상 모임 일정", "가상 모임의 일정을 확인합니다."],
    [
      11,
      "[데모 공지] 테크 아티클 화면 안내",
      "테크 아티클의 목록과 요약 화면을 확인합니다.",
    ],
    [
      10,
      "[데모 안내] 예제 스터디 신청",
      "공개·비공개 스터디의 표시를 확인합니다.",
    ],
    [
      9,
      "[데모 안내] 예제 활동 공유회",
      "예제 프로젝트를 공유하는 가상의 행사입니다.",
    ],
    [
      8,
      "[데모 모집] 가상 개발팀 모집",
      "가상의 개발팀 모집 화면을 확인합니다.",
    ],
    [
      6,
      "[데모 안내] 화면 확인 방법",
      "개발 환경에서 사용하는 예제 공지입니다.",
    ],
    [
      1,
      "[데모 모집] 예제 커뮤니티 참여 안내",
      "가상의 커뮤니티 참여 안내입니다.",
    ],
  ];
  const demoAnnouncements = announcementExamples.map(
    ([id, title, summary], index) => ({
      id,
      title,
      summary,
      contents: `# ${title}\n\n${summary}\n\n이 글은 화면 테스트를 위해 작성한 합성 공지이며 실제 행사나 모집을 안내하지 않습니다.\n\n## 예제 안내\n- 장소: 가상 행사실 ${index + 1}\n- 준비물: 예제 프로젝트와 질문 목록\n- 문의 담당: ${member(index + 1).name}\n\n문의 주소(발송 불가): announcement-${id}@example.invalid\n\n관련 링크(접속 불가): ${DEMO_ORIGIN}/announcements/${id}`,
      author: { name: member(index + 1).name },
      publishAt: `2026-09-${String(7 - index).padStart(2, "0")}T00:00:00.000Z`,
      createdAt: `2026-09-${String(7 - index).padStart(2, "0")}T01:00:00.000Z`,
      updatedAt: `2026-09-${String(7 - index).padStart(2, "0")}T02:00:00.000Z`,
      views: (index + 1) * 10,
    }),
  );

  const teamExamples = [
    [
      6,
      "예제 알고리즘 대회 팀",
      "공모전",
      "C++, Python",
      ["문제 풀이", "테스트", "기록"],
    ],
    [5, "예제 자동화 도구 팀", "공모전", "TypeScript", ["개발자"]],
    [
      4,
      "예제 웹 프로젝트 팀",
      "프로젝트",
      "React, TypeScript",
      ["프론트엔드 개발자"],
    ],
    [
      3,
      "예제 서비스 운영 팀",
      "프로젝트",
      "",
      ["인프라", "백엔드", "프론트엔드", "디자인", "기획"],
    ],
  ];
  const demoTeams = teamExamples.map(
    ([id, title, category, techStack, roles], index) => ({
      id,
      title: `[데모] ${title}`,
      category,
      status: "closed",
      periodStart: "2026-03-01",
      periodEnd: "2026-06-30",
      deadline: "2026-02-28",
      description: `화면 확인을 위한 합성 모집글 ${index + 1}입니다. 실제 대회, 프로젝트 또는 모집과 관련이 없습니다.\n\n## 예제 활동\n- 요구사항 정리\n- 예제 구현과 코드 리뷰\n- 결과 문서 작성`,
      techStack,
      tag: index % 2 === 0 ? "협업,초보환영" : "",
      executionType: index === 3 ? "hybrid" : "online",
      selectionProc: "예제 지원서 확인 후 데모 안내",
      contact: `team-${id}@example.invalid`,
      goals: "예제 프로젝트 완성,가상 결과 공유",
      projectImage: "/logo192.png",
      link: `${DEMO_ORIGIN}/teams/${id}`,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
      leader: {
        id: member(index + 12).id,
        name: member(index + 12).name,
        profile_image: PROFILE_IMAGE,
      },
      roles: roles.map((roleName, roleIndex) => ({
        id: id * 10 + roleIndex,
        roleName,
        recruitCount: roleIndex === 1 ? 2 : 1,
        currentCount: 0,
      })),
    }),
  );

  return { demoMembers, demoStudies, demoAnnouncements, demoTeams };
};
