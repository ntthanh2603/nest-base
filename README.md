# NestJS Clean Architecture Boilerplate

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

🚀 A production-ready NestJS Boilerplate built with **Clean Architecture** and **SOLID** principles. Designed for scalability, maintainability, and developer experience.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-red.svg)](https://nestjs.com/)
[![Better Auth](https://img.shields.io/badge/Better--Auth-1.4.x-blue.svg)](https://better-auth.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

---

## 🌟 Key Features

- **🛡️ Better Auth**: Production-ready authentication with multi-session support, roles, and plugins.
- **🏗️ Clean Architecture**: modular structure with clear separation of concerns.
- **✨ NestJS 11**: Using the latest features of the NestJS framework.
- **📦 TypeORM & Postgres**: Robust ORM integration with support for PGVector.
- **🐳 Dockerized**: Optimization for deployment using Docker and Docker Compose.
- **✅ Automated Testing**: Full Unit and E2E testing setup with Jest.
- **📜 Swagger**: Interactive API documentation at `/api/docs`.
- **🚀 Taskfile**: Simplified workflow using `task` commands.

---

## �️ Tech Stack

- **Framework**: NestJS (v11)
- **Database**: PostgreSQL + TypeORM
- **Authentication**: Better Auth
- **Validation**: Class-validator & Class-transformer
- **Docker**: Node.js 22-alpine base image
- **Package Manager**: NPM / Bun

---

## 📥 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ntthanh2603/nest-base.git
cd nest-base
```

### 2. Environment Setup

Copy the example environment file and fill in your details:

```bash
cp .env.example .env
```

Key variables to check:

- `POSTGRES_DB`, `POSTGRES_USERNAME`, `POSTGRES_PASSWORD`
- `BETTER_AUTH_SECRET`: Generate using `task gen-secret`
- `BETTER_AUTH_BASE_URL`: Usually `http://localhost:3000/api/auth`

### 3. Install Dependencies

```bash
npm install
```

### 4. Running the Application

#### Using Task (Recommended)

```bash
task dev     # Start development server
task build   # Build the project
task test    # Run all tests
```

#### Using NPM

```bash
npm run start:dev
```

---

## 🐳 Docker Usage

Run the entire stack (App + Postgres + PGVector) with a single command:

```bash
docker-compose up -d --build
```

The application will be available at `http://localhost:3000`.

---

## 📂 Project Structure

```text
src/
├── commons/       # Global decorators, filters, guards, interceptors, interfaces
├── database/      # TypeORM configuration and Database module
├── modules/       # Feature modules (Auth, Users, Root)
│   ├── auth/      # Better Auth integration & entities
│   ├── users/     # User management logic
│   └── root/      # System health & metadata
├── utils/         # Helper functions
└── main.ts        # Application entry point
```

---

## 📑 API Documentation

Once the app is running, visit:

- **Swagger UI**: `http://localhost:3000/api/docs`
- **Auth Docs**: `http://localhost:3000/api/auth/docs`

---

## ✅ Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 🤝 Contribution

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📜 License

This project is [MIT licensed](LICENSE).

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/ntthanh2603">Nest Base Application</a>
</p>
