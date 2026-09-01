export const formatPhoneNumber = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export const validatePhoneNumber = (phone) => /^0\d{1,2}-\d{3,4}-\d{4}$/.test(phone);

const readRows = (formData, fieldNames) => {
  const columns = fieldNames.map((fieldName) => formData.getAll(fieldName));
  return (columns[0] || []).map((_, rowIndex) =>
    Object.fromEntries(
      fieldNames.map((fieldName, columnIndex) => [fieldName, columns[columnIndex][rowIndex]])
    )
  );
};

const hasEveryValue = (item, fields) => fields.every((field) => item[field]);

export const buildRecruitmentApplication = (formData, { studentNumber, phoneNumber }) => {
  const projects = readRows(formData, [
    'project_name',
    'project_contribution',
    'project_start_date',
    'project_end_date',
    'project_description',
    'project_tech_stack',
  ]);
  const awards = readRows(formData, [
    'award_name',
    'award_institution',
    'award_date',
    'award_description',
  ]);

  const completeProjects = projects.filter((project) => hasEveryValue(project, [
    'project_name',
    'project_contribution',
    'project_description',
    'project_tech_stack',
  ]));
  const completeAwards = awards.filter((award) => hasEveryValue(award, [
    'award_name',
    'award_institution',
    'award_date',
    'award_description',
  ]));

  return {
    projects,
    awards,
    payload: {
      name: formData.get('name'),
      student_number: studentNumber,
      major: formData.get('major'),
      phone_number: phoneNumber,
      tech_stack: formData.get('techStack') || undefined,
      area_interest: formData.get('interests'),
      self_introduction: formData.get('selfIntroduction'),
      club_expectation: formData.get('expectations'),
      submit_year: new Date().getFullYear(),
      projects: completeProjects.map((project) => ({
        project_name: project.project_name,
        project_contribution: project.project_contribution,
        project_date: project.project_start_date || '',
        project_description: project.project_description,
        project_tech_stack: project.project_tech_stack,
      })),
      awards: completeAwards.map((award) => ({
        award_name: award.award_name,
        award_institution: award.award_institution,
        award_date: award.award_date,
        award_description: award.award_description,
      })),
    },
  };
};

const isValidDate = (dateString) => {
  if (!dateString) return true;
  const year = new Date(dateString).getFullYear();
  return Number.isFinite(year) && year <= 9999;
};

export const hasValidApplicationDates = ({ projects, awards }) =>
  projects.every((project) =>
    isValidDate(project.project_start_date) && isValidDate(project.project_end_date)
  ) && awards.every((award) => isValidDate(award.award_date));
