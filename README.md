# homebridge-sss-platform

A dynamic platform-style homebridge plugin to expose cameras registered to the Synology Survillence Station as homekit motion sensors. This *plugin can support any other survillence system capable of generating HTTP GET calls when motion is detected*. It has been tested with [Xeoma](https://felenasoft.com/xeoma/en/) as well.

By leveraging the motion detection features, if both the camera and sensor accessory are placed in the same room, Homekit will provide 'rich' notification in iOS 12 and before. *When using iOS 13+*, rich notifications are only generated when the motion sensor is part of the camera accessory itself. A workaround exists for cameras setup with the popular [camera-ffmpeg homebridge plugin](https://github.com/KhaosT/homebridge-camera-ffmpeg). Specifically, the 'motion' option, after configuring this plugin, use an automation to flip the switch which will then allow the rich notification to return.

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install homebridge-sss-platform using: `npm install -g git+https://github.com/aficustree/homebridge-sss-platform#master`
3. Update your configuration file. See [sample-config.json](./sample-config.json) in this repository for a sample.

## Configuration

see [sample configuration](./sample-config.json) for the homebridge side configuration

for the configuration of the synology survilence station:

1. Log into the survillence station console
2. Create an action rule to trigger on 'motion detected' (on a synology this is called a 'webhook' action peripheral and the method a HTTP 'GET')
3. Set the action to 'external device' and use `http://yourhost:yourport/?varname=cameraname` as tagged in the homebridge configuration.

Note: `yourhost` is the host running this plugin (as in the ip address or the hostname), `yourport` is the port homebridge is listening on. You set that up in homebridge and it can be wahtever you want (though setting it 'high' meaning 1023 < port < 65535 is normal).

You can see an example of this configuration in [issue #1](https://github.com/aficustree/homebridge-sss-platform/issues/1)

### options

+ timeout - waiting time for triggered events to turn off, default if not passed is 30sec
+ resttime - waiting (cool down) time for next triggered event to occur, default if not passed is 1sec

## License

Copyright 2020, [aficustree](https://github.com/aficustree)

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the [License](./LICENSE).
