# Contributing to @onlineapps/agent-mq-client

Thank you for your interest in contributing to this project! We welcome contributions that improve functionality, fix bugs, enhance documentation, or add new features.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How Can I Contribute?](#how-can-i-contribute)

   * [Reporting Bugs](#reporting-bugs)
   * [Suggesting Enhancements](#suggesting-enhancements)
   * [Submitting Pull Requests](#submitting-pull-requests)
3. [Development Setup](#development-setup)
4. [Coding Standards](#coding-standards)

   * [Linting](#linting)
   * [Testing](#testing)
   * [Commit Messages](#commit-messages)
5. [Release Process](#release-process)
6. [Contact](#contact)

---

## Code of Conduct

Please see [CODE\_OF\_CONDUCT.md](./CODE_OF_CONDUCT.md) for guidelines on respectful interaction within our community.

---

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please open an issue with:

* A clear and descriptive title
* Steps to reproduce
* Expected vs actual behavior
* Relevant logs and error messages

### Suggesting Enhancements

For new features or improvements, please discuss your idea by opening an issue. Include:

* Motivation and use case
* Proposed API or behavior

### Submitting Pull Requests

1. Fork the repository and create a new branch: `git checkout -b feature/your-feature`
2. Write your code, ensuring all tests pass.
3. Add or update documentation if needed.
4. Commit your changes with a descriptive message (see [Commit Messages](#commit-messages)).
5. Push to your fork and open a pull request against `main`.

---

## Development Setup

```bash
# Clone your fork
git clone git@github.com:onlineapps/agent-mq-client.git
cd agent-registry-client

# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint
```

---

## Coding Standards

### Linting

* We use ESLint with the Airbnb style guide.
* Run `npm run lint` to check for issues.

### Testing

* Tests use Jest.
* Write unit tests for new functionality.
* Run `npm test` before submitting a PR.

### Commit Messages

* Use [Conventional Commits](https://www.conventionalcommits.org/):

  * `feat: add new feature`
  * `fix: resolve bug`
  * `docs: update documentation`
  * `chore: maintenance tasks`

---

## Release Process

1. Bump the version in `package.json` according to SemVer.
2. Create a Git tag: `git tag vX.Y.Z`
3. Push commits and tags: `git push origin main --tags`
4. GitHub Actions will publish the package to npm.

---

## Contact

For questions or support, open an issue or contact the maintainers via email:

* [info@onlineapps.cz](mailto:info@onlineapps.cz)
