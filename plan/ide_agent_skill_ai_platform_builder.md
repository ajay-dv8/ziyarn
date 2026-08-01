# IDE AI Agent Skill
AI Platform Builder

Purpose

This skill helps the IDE AI agent develop a scalable AI agent platform.

The AI should follow these principles.

---

# Core Development Rules

Use TypeScript everywhere.

Use pnpm runtime.

Backend must use Elysia.js.

Frontend must use React.

Use TailwindCSS for styling.

Prefer API routes instead of heavy client logic.

All schemas must use Zod validation.

---

# Coding Standards

Write modular code.

Avoid monolithic files.

Separate layers

api
services
agents
database

Every feature must have

types
validation
tests

---

# AI Agent Implementation Rules

The AI agent must support

knowledge retrieval
tool usage
conversation memory

Always structure agents like this

Agent

intent detection

tool selection

knowledge retrieval

response generation

---

# Tool Definition Standard

Tools must follow this interface

name
description
parameters
handler

Example

tool name
create_ticket

parameters

email
issue

handler

create support ticket in database

---

# Knowledge Retrieval Standard

Use RAG architecture

document chunk size

500 tokens

overlap

50 tokens

embedding storage

pgvector

retrieval method

cosine similarity

top k

5

---

# API Design

REST style APIs.

Example routes

POST /chat

POST /knowledge/upload

GET /agents

POST /agents

GET /conversations

---

# Chat System Rules

Messages must support

user

assistant

system

tool

Store messages in database.

Enable streaming responses.

---

# Memory Rules

Short term memory

store in request context

Long term memory

store conversation history

---

# Performance Rules

Use streaming responses.

Cache embeddings.

Batch vector inserts.

Avoid blocking operations.

---

# Security Rules

Validate all inputs.

Sanitize markdown output.

Rate limit chat endpoints.

Protect admin endpoints.

---

# Testing Rules

Write tests for

API routes

agent tools

knowledge retrieval

---

# Documentation Rules

Every module must include

README

usage example

---

# Feature Priority

1 chat system

2 agent engine

3 knowledge base

4 tool system

5 admin dashboard

6 widget embed

7 analytics

---

# Expected Behavior

The IDE AI agent should

generate clean modular code

avoid unnecessary complexity

follow architecture strictly

produce production-ready implementations.er actions 
