# Changelog

## [Unreleased][]

## [1.9.0][] - 2023-09-25

### Added

-   Support for additional known CSS functions

## [1.8.3][] - 2023-08-24

### Changed

-   Update external dependency referencing when used as ES package

## [1.8.2][] - 2023-07-23

### Fixed

-   Use pure style content first for undefined functions check ([#6](/issues/6))

## [1.8.1][] - 2023-05-01

### Changed

-   Update Sass JSON function signature

## [1.8.0][] - 2021-10-26

### Changed

-   Use PostCSS 8 ([#3](/issues/3))

## [1.7.2][] - 2021-10-26

### Changed

-   Console output parsing

## [1.7.1][] - 2021-09-30

### Changed

-   Optimize known CSS functions list

## [1.7.0][] - 2021-09-30

### Added

-   Support for disallowed known CSS functions

## [1.6.1][] - 2021-09-09

### Fixed

-   Catch error for function with missing arguments

## [1.6.0][] - 2021-09-09

### Added

-   Support for functions in `@else`, `@import`, `@use` and `@forward` blocks

### Changed

-   Optimize undefined functions processing

## [1.5.2][] - 2021-09-08

### Fixed

-   Parsing of function declaration and invocation errors

## [1.5.1][] - 2021-09-08

### Fixed

-   Interpolated strings handling in function names

## [1.5.0][] - 2021-09-07

### Added

-   Support for stack trace

## [1.4.3][] - 2021-09-06

### Changed

-   Return early if there are no undefined functions to check

## [1.4.2][] - 2021-09-06

### Fixed

-   Skip empty function names

## [1.4.1][] - 2021-09-06

### Fixed

-   Report functions with processed variables

## [1.4.0][] - 2021-09-06

### Changed

-   Clear console output on next cycle

## [1.3.0][] - 2021-09-06

### Changed

-   Consolidate console output getter
-   Normalize `stdin` resolving
-   Handle multiple async process output

## [1.2.0][] - 2021-09-03

### Changed

-   Improve regular expression for deprecations
-   Properly return `stdin` as file

### Fixed

-   JSON encode input values

## [1.1.3][] - 2021-09-03

### Added

-   Support for checking inside `@if` at-rules

## [1.1.2][] - 2021-09-03

### Fixed

-   Incorrect parsing of namespaced functions

## [1.1.1][] - 2021-09-02

### Fixed

-   Handle noop plugin for PostCSS 7

## [1.1.0][] - 2021-09-02

### Added

-   Support for checking undefined functions

## [1.0.0][] - 2021-09-01

### Added

-   Initial implementation

[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/niksy/sass-render-errors/tree/v1.0.0
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/niksy/sass-render-errors/tree/v1.1.0
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/niksy/sass-render-errors/tree/v1.1.1
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/niksy/sass-render-errors/tree/v1.1.2
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.1.3...HEAD
[1.1.3]: https://github.com/niksy/sass-render-errors/tree/v1.1.3
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/niksy/sass-render-errors/tree/v1.2.0
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/niksy/sass-render-errors/tree/v1.3.0
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/niksy/sass-render-errors/tree/v1.4.0
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.4.1...HEAD
[1.4.1]: https://github.com/niksy/sass-render-errors/tree/v1.4.1
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.4.2...HEAD
[1.4.2]: https://github.com/niksy/sass-render-errors/tree/v1.4.2
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.4.3...HEAD
[1.4.3]: https://github.com/niksy/sass-render-errors/tree/v1.4.3
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/niksy/sass-render-errors/tree/v1.5.0
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.5.1...HEAD
[1.5.1]: https://github.com/niksy/sass-render-errors/tree/v1.5.1
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.5.2...HEAD
[1.5.2]: https://github.com/niksy/sass-render-errors/tree/v1.5.2
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.6.0...HEAD
[1.6.0]: https://github.com/niksy/sass-render-errors/tree/v1.6.0
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.6.1...HEAD
[1.6.1]: https://github.com/niksy/sass-render-errors/tree/v1.6.1
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.7.0...HEAD
[1.7.0]: https://github.com/niksy/sass-render-errors/tree/v1.7.0
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.7.1...HEAD
[1.7.1]: https://github.com/niksy/sass-render-errors/tree/v1.7.1
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.7.2...HEAD
[1.7.2]: https://github.com/niksy/sass-render-errors/tree/v1.7.2
[unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.8.0...HEAD
[1.8.0]: https://github.com/niksy/sass-render-errors/tree/v1.8.0
[Unreleased]: https://github.com/niksy/sass-render-errors/compare/v1.9.0...HEAD
[1.9.0]: https://github.com/niksy/sass-render-errors/compare/v1.8.3...v1.9.0
[1.8.3]: https://github.com/niksy/sass-render-errors/compare/v1.8.2...v1.8.3
[1.8.2]: https://github.com/niksy/sass-render-errors/compare/v1.8.1...v1.8.2
[1.8.1]: https://github.com/niksy/sass-render-errors/tree/v1.8.1
