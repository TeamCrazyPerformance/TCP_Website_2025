export class PublicUserDto {
  name: string;            
  profile_image: string;   
  self_description: string | null;  

  email?: string;
  tech_stack?: string[] | null;
  education_status?: string;
  github_username?: string;
  portfolio_link?: string | null;
}
