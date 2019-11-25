# Changelog

## [Unreleased]

## [0.1.0] - 2019-11-23
### Added
- `resttime` option
- more debug message

### Fixed
- early timeout for multiple event triggering in single timeout timeframe
- a problem caused Accessory not removed after removed in option
- a problem caused Accessory reachable state not updated
- missing default option caused crash app
- slow lookup for triggers, may have caused very long response time when large amount configured
- mutiple configration for single varname not responding

### Changed
- code formatting
- move logics to MotionSensor class
- move logics to MotionSensors class
- string interpolation style

### [0.0.3]
