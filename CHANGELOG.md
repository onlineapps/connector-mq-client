## [1.0.1](https://github.com/onlineapps/agent-mq-client/compare/v1.0.0...v1.0.1) (2025-05-31)


### Bug Fixes

* test of semantic release versioning dummy update of readme ([7b4f120](https://github.com/onlineapps/agent-mq-client/commit/7b4f1204c494bae8a811ba0041212ce60e5b5647))

# 1.0.0 (2025-05-31)


### Features

* first commit ([f261c32](https://github.com/onlineapps/agent-mq-client/commit/f261c32a40d9c27175d78afd223e5aa4ecb97320))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), 
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
- Placeholder for upcoming changes

## [1.0.0] - 2025-06-01
### Added
- Initial release of `@onlineapps/agent-mq-client`
- Support for RabbitMQ: connect, disconnect, publish, consume, ack, nack
- Configuration validation via AJV schema
- Custom error classes: `ConnectionError`, `PublishError`, `ConsumeError`, `ValidationError`, `SerializationError`
- Utility modules: logger abstraction, serializer, error handler
- Examples: `producerExample.js` and `consumerExample.js`
- Basic RabbitMQ transport implementation using `amqplib`
- Unit tests for all core modules and utilities
- Linting (ESLint) and formatting (Prettier) configurations
- Documentation: `README.md`, `API.md`

## [0.1.0] - 2025-05-15
### Added
- Project scaffolding and initial directory structure
- Empty stubs for client, transportFactory, RabbitMQClient
- Default configuration and schema files

[Unreleased]: https://github.com/onlineapps/agent-mq-client/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/onlineapps/agent-mq-client/releases/tag/v1.0.0
[0.1.0]: https://github.com/onlineapps/agent-mq-client/releases/tag/v0.1.0
