# Contributing to TierOne AutoBlog

Thank you for your interest in contributing to **TierOne AutoBlog**! This project is an autonomous programmatic SEO and AI content publishing engine built by **Musfiqur Rahman Saimon**.

We welcome contributions of all kinds: bug fixes, documentation improvements, new content source integrations, smarter QA evaluation gates, and SEO enhancements.

## Getting Started

1. **Fork the Repository:** Fork [britsync07-prog/tierone-autoblog](https://github.com/britsync07-prog/tierone-autoblog) to your GitHub account.
2. **Clone Locally:**
   ```bash
   git clone https://github.com/<your-username>/tierone-autoblog.git
   cd tierone-autoblog
   ```
3. **Install Dependencies:**
   ```bash
   npm install
   ```
4. **Run the Test Suite:**
   ```bash
   npm test
   ```
   All test fixtures must pass without external network dependencies.

## Development Workflow

- Create a feature branch: `git checkout -b feature/your-feature-name`
- Follow TypeScript strict standards.
- Ensure any new pipeline stages include automated unit tests under `tests/`.
- Commit with conventional commits:
  - `feat(...)`: new functionality or gate
  - `fix(...)`: bug fix
  - `docs(...)`: documentation or README updates
  - `test(...)`: test additions or adjustments
- Push to your fork and submit a Pull Request to `master`.

## Code of Conduct

Please treat everyone with respect and empathy. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
