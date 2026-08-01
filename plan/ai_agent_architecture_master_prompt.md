# AI Agent Platform Architecture Master Prompt

Purpose

This document defines the architecture, standards, and engineering rules
for building a production-grade AI Agent platform.

The IDE AI agent must follow this guide when generating code,
designing architecture, and implementing features.

The system being built is an AI Agent platform for:

- customer support agents
- sales agents
- knowledge assistants

Agents must be embeddable into external applications.

---

# Technology Stack

Runtime

pnpm

Frontend

Next.js 
React
TypeScript
TailwindCSS

Backend

Elysia.js or nest

Database

PostgreSQL
Neon

Vector Storage

pgvector or Qdrant

AI Providers

Groq
OpenRouter
Ollama fallback

Embeddings

bge-small
text-embedding-3-small equivalent

---

# Global Architecture

The system must follow a modular architecture.

User
 ↓
Chat Interface
 ↓
API Layer
 ↓
Agent Engine
 ↓
Tools / Knowledge / Memory
 ↓
LLM
 ↓
Response

The AI system must never directly answer user questions without passing through the agent engine.

---

# Project Structure

The IDE AI must generate a monorepo architecture.

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

scripts
docker

---

# AI Agent System Design

Agents must be designed as modular reasoning systems.

Each agent must include:

identity
instructions
tools
knowledge sources
memory

Example agent structure

agent

id
name
description
instructions
tools
knowledge_sources

Agents must be dynamically configurable.

---

# Agent Execution Pipeline

All agents must follow this execution pipeline.

User Input

↓

Intent Detection

↓

Context Assembly

↓

Knowledge Retrieval

↓

Tool Selection

↓

Reasoning

↓

Response Generation

↓

Memory Storage

Agents must never skip steps in this pipeline.

---

# Prompt Engineering Rules

All prompts must follow a structured format.

system prompt

role definition
behavior rules
limitations

context

conversation history
knowledge results

task

user message

Never place raw user input inside the system prompt.

Always sanitize inputs.

---

# RAG Architecture

All knowledge queries must use Retrieval Augmented Generation.

RAG Pipeline

Document ingestion

↓

Document chunking

↓

Embedding generation

↓

Vector storage

↓

Similarity search

↓

Context injection

↓

LLM response

Chunking rules

chunk size

400–600 tokens

overlap

50 tokens

Top results

3 to 5 chunks

---

# Knowledge Base System

Supported knowledge sources

PDF

Markdown

DOCX

Website scraping

FAQ lists

Each document must be stored with metadata

document id
source
created_at
agent_id

Chunks must store

text
embedding
document reference

---

# Tool System

Agents must interact with the outside world through tools.

Tools must follow a strict interface.

Tool Definition

name
description
parameters
handler

Example

name

create_ticket

description

create a support ticket

parameters

email
issue

handler

insert ticket into database

Tools must be deterministic.

Tools must never directly call LLMs.

---

# Tool Invocation

The LLM must produce structured tool calls.

Example

tool_call

name
create_ticket

arguments

email
issue

The system must parse the call
execute the tool
return the result to the agent.

---

# Memory Architecture

The system must implement two types of memory.

Short-Term Memory

conversation context
last messages

Long-Term Memory

user history
preferences
past interactions

Short-term memory must remain within token limits.

Long-term memory must be stored in PostgreSQL.

---

# Database Design

Tables required

users

agents

conversations

messages

documents

document_chunks

embeddings

tool_calls

support_tickets

leads

Messages table must include

role

user
assistant
system
tool

---

# Chat System Design

Messages must support streaming responses.

The chat API must support

POST /chat

request

agent_id
conversation_id
message

response

streamed assistant messages

All conversations must be persisted.

---

# Widget System

The platform must provide an embeddable chat widget.

Embed example

<script src="agent-widget.js"></script>

<ai-agent
agent="support"
company="example"
/>

Widget must support

message streaming
markdown rendering
file uploads
theme customization

---

# Admin Dashboard

Admin must be able to

create agents

configure prompts

upload knowledge

view conversations

view analytics

manage leads

---

# Observability

All agent operations must be logged.

Log

prompt

response

tool usage

errors

Use structured logging.

Recommended

Pino

Monitoring

Sentry

Analytics

PostHog

---

# Performance Optimization

Always stream responses.

Cache embeddings.

Use batching for vector insertions.

Avoid blocking operations.

Use background jobs for

document ingestion

embedding generation

---

# Security

Validate all inputs.

Sanitize markdown.

Rate limit chat endpoints.

Protect admin endpoints.

Use role-based access control.

Never expose API keys to the client.

---

# Multi-Agent System

The platform must support multiple agents.

Examples

Support Agent

Sales Agent

Technical Agent

Marketing Agent

Each agent can have

different tools

different knowledge bases

different prompts

---

# Anti-Patterns to Avoid

The IDE AI agent must avoid the following bad practices.

Directly sending user messages to the LLM.

Embedding entire documents without chunking.

Hardcoding prompts inside UI code.

Mixing business logic with API handlers.

Creating agents without tool abstraction.

Using synchronous blocking calls for AI requests.

---

# Development Phases

Phase 1

Project scaffolding

Phase 2

Basic chat API

Phase 3

Agent engine

Phase 4

RAG knowledge system

Phase 5

tool execution framework

Phase 6

admin dashboard

Phase 7

chat widget

Phase 8

analytics

Phase 9

integrations

---

# AI Engineering Philosophy

The system must prioritize

modularity

observability

extensibility

performance

cost efficiency

Agents must be designed to be easily replaceable and scalable.

The architecture must support future capabilities such as

voice agents
workflow automation
multi-agent collaboration
autonomous task execution.

---

# Expected IDE AI Behavior

When generating code, the IDE AI must

follow the architecture defined in this document

produce modular implementations

use strong typing

avoid unnecessary complexity

prefer maintainable solutions

generate production-grade code.
