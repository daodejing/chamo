# Prototype to Production Adaptation

Expert guidance for adapting HTML/React prototype code into production Next.js 15 + React 19 codebase.

## When to Use
- Adapting prototype UI components to production
- Debugging event handlers that work in isolation but fail in production
- Resolving conditional rendering issues in React 19 + Next.js 15
- Identifying missing production dependencies after prototype integration

## Core Topics

### 1. [Conditional Rendering Issues](conditional-rendering.md)
Most common issue: event handlers don't fire due to parent component conditional returns.

### 2. [Test-Driven Debugging](test-driven-debugging.md)
Systematic approach to isolate prototype integration issues using test routes.

### 3. [React 19 + Next.js 15 Patterns](compatibility-patterns.md)
Required patterns for event handling, 'use client' directive, and startTransition usage.

### 4. [Missing Production Dependencies](missing-dependencies.md)
Detecting and fixing missing exports that exist in prototype but not in production.

### 5. [Cache Management](cache-management.md)
Next.js cache clearing strategies when changes don't appear.

## Quick Diagnosis

**Event handler not firing?** → See [Conditional Rendering Issues](conditional-rendering.md)

**Works in test route but not in production?** → See [Test-Driven Debugging](test-driven-debugging.md)

**"X is not a function" error?** → See [Missing Production Dependencies](missing-dependencies.md)

## [Implementation Checklist](checklist.md)

---
*Based on OurChat authentication flow debugging (2025-10-19)*
