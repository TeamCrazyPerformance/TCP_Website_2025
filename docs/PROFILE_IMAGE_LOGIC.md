# Profile Image Logic

This document describes the logic for handling user profile images, specifically the automatic assignment and update of default images.

## 1. Default Image Types
The system uses three types of default images based on user role and status:
- **Admin Image**: `default_admin_profile_image.webp` (For `ADMIN` role)
- **Graduate Image**: `default_graduate_profile_image.webp` (For `GRADUATE` status)
- **General Image**: `default_profile_image.webp` (For all others)

## 2. Priority Rules
When determining which default image to display, the system follows this strict priority:

1.  **Custom User Image**: If the user has uploaded a custom image, it is **ALWAYS** preserved and never automatically changed by the system.
2.  **Admin Role**: If the user is an `ADMIN`, they get the Admin default image, regardless of their education status (e.g., an Admin who is also a Graduate will see the Admin image).
3.  **Graduate Status**: If the user is NOT an Admin but has `GRADUATE` status, they get the Graduate default image.
4.  **General Status**: All other users get the General default image.

## 3. Automatic Update Triggers
The default profile image is automatically updated in the following scenarios **ONLY IF** the user is currently using one of the default images:

### A. Role Change (Admin Panel)
- **Trigger**: An administrator changes a user's role via `AdminMembersService`.
- **Logic**:
    - If Role becomes `ADMIN` → Update to `default_admin_profile_image.webp`.
    - If Role becomes `MEMBER` (from Admin) → Check education status (Graduate vs. General) and update accordingly.

### B. Education Status Change (User Profile & Admin Panel)
- **Trigger**: User updates their own profile (`ProfileService`) or Admin updates a user's profile (`AdminMembersService`).
- **Logic**:
    - If Status becomes `GRADUATE` → Update to `default_graduate_profile_image.webp` (unless User is Admin).
    - If Status becomes `ENROLLED/LEAVE` → Update to `default_profile_image.webp` (unless User is Admin).

## 4. Image Reset
- **Trigger**: User clicks "Reset Profile Image".
- **Logic**: The image is immediately set to the appropriate default image based on the user's *current* role and status, following the priority rules above.
