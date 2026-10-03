const demoTagSets = [
  ['React', 'TypeScript', '프론트엔드'],
  ['Python', '머신러닝'],
  ['Java', 'Spring', '백엔드'],
];

export const allMembers = Array.from({ length: 9 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  const alumni = index >= 6;
  return {
    name: `데모 대체 회원 ${number}`,
    role: '데모 개발자',
    description: `화면 확인을 위한 합성 자기소개 ${number}입니다.`,
    tags: [...demoTagSets[index % demoTagSets.length]],
    profileImageUrl: '/images/default_profile.webp',
    portfolioUrl: `https://example.invalid/portfolio/fallback-${number}`,
    status: alumni ? 'alumni' : 'current',
    educationStatus: alumni ? '졸업' : index % 3 === 2 ? '휴학' : '재학',
    ...(alumni && { currentCompany: `데모 소속 ${number}` }),
  };
});
