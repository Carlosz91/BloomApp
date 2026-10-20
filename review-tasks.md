# BloomApp - Fase 5: Tasks - Review and Validation

## Original Task Breakdown (from SDD Phase 5)

### Sprint 1: Project Setup & Backend Foundation (Tasks 5.1-5.6)
| # | Task | Description | Status | Notes |
|---|------|-------------|--------|-------|
| 5.1 | Initialize repo | git init, folder structure, .gitignore | Done | Completed: git init in BloomApp folder |
| 5.2 | Node.js + Express | package.json, install dependencies | Done | Installed: express, pg, jsonwebtoken, bcryptjs, cors, dotenv |
| 5.3 | Connect PostgreSQL | CONFIGURATION: Switched to SQLite due to env constraints | Done | Created db.js with better-sqlite3, adjusted .env |
| 5.4 | Create tables | Tables: users, services, appointments | Partially | Created init-db.js but couldn't run due to PostgreSQL not installed in env |
| 5.5 | Auth endpoints | POST /auth/login, POST /auth/register | Partially | Created server.js with routes but couldn't verify due to runtime issues |
| 5.6 | JWT + bcrypt | Token generation, password hashing | Partially | Code written in server.js, not yet verified running |

### Sprint 2: React Native Frontend (Tasks 5.7-5.14)
| # | Task | Description | Status |
|---|------|-------------|--------|
| 5.7 | RN project setup | npx react-native@latest init, react-navigation, TypeScript | Not started |
| 5.8 | Global styles | Paleta ciruela/marfil/salvia, typography | Not started |
| 5.9 | AuthContext | Token management via AsyncStorage, session validator | Not started |
| 5.10 | Login screen | Email/password form, toggle show/hide, validation | Not started |
| 5.11 | Home screen | Services grid, styles, loading/empty/error states | Not started |
| 5.12 | Schedule appointment | Service selector, datepicker, timepicker, client data, validation | Not started |
| 5.13 | My appointments | List with filters (All/Upcoming/Past), status badges, actions | Not started |
| 5.14 | Settings screen | Edit profile, change password modal, logout confirmation | Not started |

### Sprint 3: Frontend-Backend Integration (Tasks 5.15-5.19)
| # | Task | Description | Status |
|---|------|-------------|--------|
| 5.15 | Auth API consumption | Use AuthContext, protect routes, store token | Not started |
| 5.16 | Services API consumption | GET /services, display grid, category filter | Not started |
| 5.17 | Schedule appointment API | POST /appointments, validation, loader, ConfirmationScreen | Not started |
| 5.18 | My appointments API | GET /appointments with filters, flatList, Pull-to-Refresh | Not started |
| 5.19 | Settings API consumption | Change password (PUT), logout (POST) | Not started |

### Sprint 4: Testing & QA (Tasks 5.20-5.24)
| # | Task | Description | Status |
|---|------|-------------|--------|
| 5.21 | Backend unit tests | Jest + Supertest for auth endpoints | Not started |
| 5.22 | Frontend unit tests | React Native Testing Library for critical components | Not started |
| 5.23 | Integration tests | Full flows: login → services → schedule → my appointments | Not started |
| 5.24 | Offline experience testing | Verify error messages when network lost (NetInfo) | Not started (app is online-only) |

### Sprint 5: Deployment & DevOps (Tasks 5.25-5.28)
| # | Task | Description | Status |
|---|------|-------------|--------|
| 5.25 | Environment variables | .env template, DATABASE_URL, JWT_SECRET, NODE_ENV | Partially | .env created with SQLite URL |
| 5.26 | Migration scripts | npm run migrate for table creation | Not started |
| 5.27 | Backend deployment | Railway/Render/Heroku deploy, verify public endpoints | Not started |
| 5.28 | Frontend deployment | Expo Go build, then store builds | Not started |

### Risk Assessment (ask-on-risk triggers)
| Task | Risk Level | Why | Mitigation |
|------|-----------|-----|-----------|
| 5.5 | High | Auth security, JWT, bcrypt | Code review, exhaustive tests |
| 5.12 | High | Date/time validation, API integration | Mock API first, validate both client & server |
| 5.17 | High | Frontend-backend integration | Mock API first, incremental integration |
| 5.23 | High | Full flow testing | Start with happy path, add edge cases |