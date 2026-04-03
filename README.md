# 🚀 NestJS Clean Architecture Boilerplate

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

🚀 A production-ready NestJS Boilerplate built with **Clean Architecture** and **SOLID** principles. Designed for scalability, maintainability, and high-performance media handling.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-red.svg)](https://nestjs.com/)
[![Better Auth](https://img.shields.io/badge/Better--Auth-1.4.x-blue.svg)](https://better-auth.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

---

## 📑 Project Documentation

Find detailed implementation guides for our core services here:

- [📦 **Storage & Media**](docs/STORAGE.md) - S3, SeaweedFS, and Sharp image optimization.
- [📡 **Kafka Messaging**](docs/KAFKA.md) - Event-driven architecture with Redpanda.
- [🔍 **Search Engine**](docs/SEARCH.md) - Full-text search with OpenSearch.
- [🛡️ **Authentication**](docs/AUTH.md) - Better Auth integration and security.
- [⚠️ **Exception Handling**](docs/EXCEPTIONS.md) - Standardized error responses.

---

## 🌟 Key Features

- **🛡️ Better Auth**: Production-ready authentication with multi-session support and roles.
- **📦 Advanced Storage**: S3-compatible storage (**SeaweedFS**) with automated **Sharp** image optimization (WebP).
- **📡 Event-Driven**: High-performance messaging using **Redpanda (Kafka)** for background tasks.
- **🔍 Full-Text Search**: Integrated **OpenSearch** cluster for lightning-fast search capabilities.
- **🏗️ Clean Architecture**: Modular structure with strict separation of concerns.
- **🐳 Dockerized**: Full infrastructure setup including Postgres, Redis, Kafka, and SeaweedFS.
- **📜 Swagger**: Interactive API documentation at `/api/docs`.
- **🚀 Taskfile**: Simplified workflow using `task` commands.

---

## 🛠️ Tech Stack

- **Core**: NestJS (v11), TypeScript
- **Database**: PostgreSQL (v18) + TypeORM
- **Cache**: Redis (v8)
- **Messaging**: Redpanda (Kafka-compatible)
- **Storage**: SeaweedFS (S3-compatible)
- **Search**: OpenSearch (v2.11)
- **Auth**: Better Auth (v1.4)
- **Processing**: Sharp (Image processing)

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

- `POSTGRES_DB`, `REDIS_URL`
- `S3_ENDPOINT`, `S3_EXTERNAL_URL`
- `KAFKA_HOST`, `KAFKA_PORT`

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

---

## 🐳 Docker Usage

Run the entire infrastructure stack (App + Postgres + Redis + Kafka + SeaweedFS + OpenSearch) with a single command:

```bash
docker-compose up -d --build
```

The application will be available at `http://localhost:3000`.

---

## 📂 Project Structure

```text
src/
├── commons/       # Global decorators, filters, guards, interceptors, pipes
├── database/      # TypeORM configuration and Database module
├── modules/       # Feature modules (Auth, Users, Root)
├── services/      # Shared infrastructure services (Storage, Kafka, etc.)
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
