# homebridge-sss-platform

**NOTE: This is a non-working plug-in at this time, DO NOT USE**

A dynamic platform-style homebridge plugin to expose cameras registered to the Synology Survillence Station as homekit motion sensors. By leveraging the motion detection features of the Synology Survillence Station, if both the camera and sensor accessory are placed in the same room, Homekit will provide 'rich' notification when the Synology detects motion. 

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install homebridge-sss-platform using: `npm install -g git+https://github.com/aficustree/homebridge-sss-platform#master`
3. Update your configuration file. See [sample-config.json](./sample-config.json) in this repository for a sample. 

## Configuration

## License

Copyright 2018, [aficustree](https://github.com/aficustree)

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the [License](./LICENSE).

