# Open Source Credits & Responsibilities

This document lists the open source libraries and infrastructure components used in this project, their licenses, and your obligations (e.g., attribution, public display).

> [!IMPORTANT]
> **"Separate Page" Recommendation**: For any item marked "Yes" or "Recommended" in the *Public Display* column, you should create a dedicated "Licenses" or "Credits" page (or a modal) in your web application settings/footer. This satisfies the requirement to make license text and attributions accessible to the user.

## Frontend (Web)

Located in `/web`

| Library | License | Purpose | Public Display? | Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **React** (`react`, `react-dom`) | MIT | UI Framework | **Recommended** | Keep copyright; include license text. |
| **Create React App** (`react-scripts`) | MIT | Build Tooling | No (Dev) | Keep copyright in source. |
| **React Router** (`react-router-dom`) | MIT | Routing | **Recommended** | Keep copyright; include license text. |
| **FontAwesome** (`@fortawesome/*`) | MIT (Code), CC BY 4.0 (Icons) | Icons | **YES (Required)** | **Attribution Required** for icons (CC BY). Include MIT license for code. |
| **Chart.js** (`chart.js`, `react-chartjs-2`) | MIT | Charts/Graphs | **Recommended** | Keep copyright; include license text. |
| **DOMPurify** (`dompurify`) | Apache 2.0 | Security | **Recommended** | Keep copyright; include license text. |
| **Markdown-it** (`markdown-it`) | MIT | Parsing | **Recommended** | Keep copyright; include license text. |
| **Web Vitals** (`web-vitals`) | Apache 2.0 | Metrics | **Recommended** | Keep copyright; include license text. |
| **Testing Library** | MIT | Tests | No (Dev) | Keep copyright in source. |

## Backend (API)

Located in `/api`.
*Note: Backend libraries are generally not "distributed" to the user's browser, so "Public Display" is less critical unless you are distributing the server binary itself. However, listing them is good practice.*

| Library | License | Purpose | Public Display? | Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **NestJS** (`@nestjs/*`) | MIT | Framework | Optional | Keep copyright in source. |
| **TypeORM** (`typeorm`) | MIT | ORM | Optional | Keep copyright in source. |
| **PostgreSQL Driver** (`pg`) | MIT | Driver | Optional | Keep copyright in source. |
| **Passport/JWT** | MIT | Auth | Optional | Keep copyright in source. |
| **Winston** | MIT | Logging | Optional | Keep copyright in source. |
| **Systeminformation** | MIT | Monitor | Optional | Keep copyright in source. |

## Server Infrastructure (Docker)

Defined in `docker-compose.yml`.
*Note: These run as separate services. If you are hosting this as a SaaS, you often don't need to display these. If you ship the Docker images to customers, you MUST include these licenses.*

| Component | License | Purpose | Public Display? | Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **Nginx** (`nginx:alpine`) | BSD-2-Clause | Web Server | Optional | Include license if redistributing image. |
| **PostgreSQL** (`postgres:alpine`) | PostgreSQL License | Database | Optional | Include license if redistributing image. |
| **Elasticsearch** (8.9.0) | Elastic License 2.0 | Search Engine | **No (Restricted)** | **Not OSI Open Source**. Free to use (Basic), but source is restricted. Do not label as "Open Source". |
| **Logstash** (8.9.0) | Elastic License 2.0 | Log Pipeline | **No (Restricted)** | Same as above. |
| **Kibana** (8.9.0) | Elastic License 2.0 | Dashboard | **No (Restricted)** | Same as above. |
| **Filebeat** (8.9.0) | Elastic License 2.0 | Log Shipper | **No (Restricted)** | Same as above. |

## Summary of Actions

1.  **Create a UI Page**: Add a "Licenses" or "Credits" link in your web app footer.
2.  **Add FontAwesome Attribution**: Explicitly state "Icons by FontAwesome (CC BY 4.0)" on that page.
3.  **List Frontend Libraries**: Paste the text of the MIT/Apache licenses for React, Chart.js, etc., on that page.
4.  **Backend/Server**: You are generally covered by keeping the license files in the source code folders, unless you are selling on-premise software distributions, in which case you should bundle a `LICENSE` text file with your installer/image.
