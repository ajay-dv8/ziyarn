# AI Agent Helpdesk / Sales Platform
Development Guide

Project Goal:
Develop an AI Agent platform that businesses can embed into apps or websites
to provide:

- AI helpdesk agents
- AI sales agents
- customer support automation
- knowledge base assistants

This guide is designed to be used by an IDE AI agent while developing the project.

---

# 1 Technology Stack

Runtime
pnpm

Frontend
Next.js 
React
TypeScript
TailwindCSS

Backend
Elysia.js / nest

Database
Neon (PostgreSQL)

Vector Storage
Supabase pgvector
or
Qdrant

AI Models

Primary
OpenRouter
Groq
Ollama (local)

Embeddings
bge-small
text-embedding models

---

# 2 Recommended Libraries

Frontend

State Management
TanStack Query
Zustand

Forms
React Hook Form
Zod

UI Components
shadcn/ui
Base UI

Chat Interface
Vercel AI SDK
ai/react

Markdown Rendering
react-markdown
remark-gfm

---

Backend

Framework
Elysia.js/ nest or express

Validation
Zod

Auth
better Auth


Queues
Upstash QStash
or
BullMQ

File Storage
Supabase Storage

---

AI / Agent Framework

LangChain JS
or
LlamaIndex TS

Embeddings
transformers.js
or
OpenAI embeddings

Vector Search
pgvector
or
Qdrant

---

# 3 Project Folder Structure

repo-root

apps
    web
    admin
    widget

services
    api
    ai
    agents

packages
    database
    shared
    ui

infrastructure
    docker
    scripts

---

# 4 Application Architecture

User
 ↓
Chat Widget
 ↓
API Gateway
 ↓
Agent System
 ↓
Tools / Knowledge Base
 ↓
LLM
 ↓
Response

---

# 5 Core System Components

Chat System
Agent Engine
Knowledge Base (RAG)
Tool System
Memory System
Admin Dashboard
Analytics System

---

# 6 AI Agent Engine

Agent responsibilities

Interpret user intent
Retrieve knowledge
Use tools
Maintain conversation context
Generate response

Agent Flow

User Message
 ↓
Intent detection
 ↓
Tool check
 ↓
Knowledge retrieval
 ↓
Response generation

---

# 7 Knowledge Base (RAG)

Supported sources

PDF
DOCX
Markdown
Websites
FAQs

Pipeline

Upload document
 ↓
Chunk document
 ↓
Generate embeddings
 ↓
Store vectors
 ↓
Retrieve relevant chunks

---

# 8 Agent Tools

Examples

check_order()

create_support_ticket()

refund_order()

get_pricing()

schedule_demo()

Tools are exposed to the LLM through structured function calls.

---

# 9 Conversation Memory

Short Term

Conversation context
stored in Redis or memory cache

Long Term

User history stored in PostgreSQL

---

# 10 Database Schema

users

agents

conversations

messages

knowledge_documents

document_chunks

embeddings

leads

support_tickets

---

# 11 Chat Widget

Embeddable script

Example

<script src="agent-widget.js"></script>

<ai-agent
  agent="sales"
  company="example"
/>

Widget features

real-time streaming
markdown support
typing indicator
file upload
theme customization

---

# 12 Admin Dashboard

Admin should be able to

create agents

upload knowledge

view conversations

see analytics

manage leads

---

# 13 AI Model Providers

Primary

Groq
OpenRouter

Fallback

Ollama

Reason

reduce cost

---

# 14 Lead Capture

Sales agents should collect

name
email
company
interest

Leads stored in database.

Optional integrations

HubSpot
Salesforce

---

# 15 Human Escalation

If agent confidence is low

escalate to human

methods

Slack notification
email
support dashboard

---

# 16 Security

JWT authentication

rate limiting

input validation

role based access

---

# 17 Observability

Logging

Pino

Monitoring

Sentry

Analytics

PostHog

---

# 18 Deployment

Recommended infrastructure

Vercel
Fly.io
Railway
or
self-hosted

Database

Supabase
or
Neon

---

# 19 Development Roadmap

Phase 1

Project setup
monorepo structure

Phase 2

basic chat system

Phase 3

AI agent engine

Phase 4

RAG knowledge base

Phase 5

tool system

Phase 6

admin dashboard

Phase 7

chat widget

Phase 8

analytics

Phase 9

integrations

---

# 20 Final Vision

Create a platform similar to

Intercom AI
Zendesk AI
Drift AI

but open and developer friendly.
