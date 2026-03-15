# Agent Guidelines & Repository Context

Welcome to the Everlock repository. This file provides guidelines, context, and commands for AI coding agents operating in this codebase.

## 1. Project Structure
This is a polyglot repository containing:
- **Next.js Web App** (Root): React, Tailwind CSS, NextAuth, Spotify Web API.
- **kdance** (`/kdance`): A Vite + React web app using MediaPipe and TensorFlow.js for pose detection in the browser.
- **Python ML Pipeline** (Root): YOLOv8, OpenCV, and audio processing tools for offline or backend choreographic tracking.

## 2. Build, Lint, and Test Commands

### Next.js App (Root)
- **Install**: `npm install`
- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Lint**: `npm run lint`
- **Typecheck**: `npx tsc --noEmit`
- **Test**: No test framework is currently configured in the root `package.json`. If tests are added (e.g., Jest or Vitest), use the relevant command like `npm run test` or `npx jest path/to/test.ts` for running a single test.

### kdance Vite App (`/kdance`)
- **Install**: `npm install` (run inside `/kdance`)
- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Lint**: `npm run lint`
- **Typecheck**: `npx tsc -b`

### Python Pipeline
- **Install**: `pip install -r requirements.txt`
- **Run Tracker**: `python dance_tracker.py`

## 3. Code Style & Guidelines

### TypeScript / Next.js / React
- **Imports**: Group imports by external libraries first, then internal absolute imports (`@/...`), then relative imports.
- **Formatting**: Use Prettier if configured, otherwise rely on ESLint formatting rules. Use 2 spaces for indentation.
- **Types**: Use strict typing. Avoid `any`. Define interfaces/types for all component props, API responses, and complex state objects.
- **Naming**: 
  - `PascalCase` for React components and types/interfaces.
  - `camelCase` for functions, variables, and hooks.
  - `UPPER_SNAKE_CASE` for global constants.
- **Components**: Use functional components with hooks. Prefer destructuring props.
- **Error Handling**: Use try/catch blocks for async operations. Display user-friendly error messages in the UI. 

### Python
- **Style**: Follow PEP 8 guidelines. Use 4 spaces for indentation.
- **Types**: Use type hints (e.g., `def calculate_speed(x: float, y: float) -> float:`) where possible to improve readability.
- **Naming**: `snake_case` for functions and variables, `PascalCase` for classes.
- **Imports**: Standard library imports first, then third-party (e.g., `cv2`, `torch`, `ultralytics`), then local application imports.
- **Error Handling**: Use explicit `try...except` blocks. Avoid bare `except:` clauses.
- **Performance**: For computer vision and ML tasks, prioritize tensor operations (PyTorch/NumPy) over standard Python loops for efficiency. Minimize moving tensors between GPU and CPU excessively.

## 4. Architectural Rules
- **State Management**: Prefer local component state or React Context over heavy global state libraries unless necessary.
- **API Calls**: In Next.js, use Server Components for initial data fetching where appropriate, or client-side fetching with `useEffect`/SWR/React Query for interactive data.
- **Secrets**: NEVER commit `.env` files, API keys, or credentials. Use the provided `.env.example` pattern if introducing new environment variables.

## 5. Model/Agent Instructions
- Read existing files to understand context before editing.
- Always use absolute paths for file operations.
- Do not proactively refactor code outside the scope of the user's request unless it's a direct necessity.
- Do not run `git commit` or destructive commands without explicit user permission.
