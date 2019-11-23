# homebridge-sss-platform

A dynamic platform-style homebridge plugin to expose cameras registered to the Synology Survillence Station as homekit motion sensors. By leveraging the motion detection features of the Synology Survillence Station, if both the camera and sensor accessory are placed in the same room, Homekit will provide 'rich' notification when the Synology detects motion. 

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install homebridge-sss-platform using: `npm install -g git+https://github.com/aficustree/homebridge-sss-platform#master`
3. Update your configuration file. See [sample-config.json](./sample-config.json) in this repository for a sample. 

## Configuration

see [sample configuration](./sample-config.json) for the homebridge side configuration

for the configuration of the synology survilence station:
1. Log into the survillence station console
2. Create an action rule to trigger on 'motion detected'
3. Set the action to 'external device' and use `http://yourhost:yourport/?varname=cameraname` as tagged in the homebridge configuration.

You can see an example of this configuration in [issue #1](https://github.com/aficustree/homebridge-sss-platform/issues/1)

### options
#### timeout
waiting time for triggered events to turn off

#### resttime
waiting (cool down) time for next triggered event to occor

## License

Copyright 2018, [aficustree](https://github.com/aficustree)

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the [License](./LICENSE).

