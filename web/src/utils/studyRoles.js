export const STUDY_ROLE = {
  GUEST: 'guest',
  PENDING: 'pending',
  MEMBER: 'member',
  NOMINEE: 'nominee',
  LEADER: 'leader',
};

export const resolveStudyRole = (study, currentUser) => {
  if (!currentUser?.id) return STUDY_ROLE.GUEST;
  if (study.leader?.user_id === currentUser.id) return STUDY_ROLE.LEADER;

  const memberRole = (study.members || []).find(
    (member) => member.user_id === currentUser.id,
  )?.role;

  return {
    LEADER: STUDY_ROLE.LEADER,
    NOMINEE: STUDY_ROLE.NOMINEE,
    MEMBER: STUDY_ROLE.MEMBER,
    PENDING: STUDY_ROLE.PENDING,
  }[memberRole] || STUDY_ROLE.GUEST;
};
