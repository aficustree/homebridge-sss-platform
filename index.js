var Accessory, Service, Characteristic, UUIDGen;
var debug = require('debug')('SynologyCamera');

module.exports = function (homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerPlatform('homebridge-sss-platform', 'sss-platform', SSSPlatform, true);
};

class MotionSensor {
    /**
     *Creates an instance of MotionSensor.
     * @param {string} varname
     * @param {Accessory} accessory
     * @param {debug.Debugger} namespaced_debug
     * @memberof MotionSensor
     */
    constructor(varname, accessory, namespaced_debug) {
        /**
         * name that will be passed by get parameter
         * @type {string} 
         */
        this.varname = varname;
        /**
         * @type {Accessory} 
         */
        this.accessory = accessory;
        /**
         * @type {boolean}
         */
        this.on = false;

        let debugg = namespaced_debug || debug;
        /**
         * @type {debug.Debugger}
         */
        this.debug = debugg.extend(this.varname);

        this.timeoutTurnOff = 0;
        this.lastTurnOffTime = Date.now();
        this.lastTriggerOn = 0;

        this.passOnTime = 0;
        this.passOnTimes = 0;
    }
    get off() {
        return !this.on;
    }
    set off(bool) {
        this.on = !bool;
    }
    turnOnNow() {
        if (this.on) {
            this.debug(`already on, do nothing.`);
        } else {
            this.debug(`turn on now ...`);
            this.on = true;
            this.accessory.getService(Service.MotionSensor)
                .updateCharacteristic(Characteristic.MotionDetected, true);
        }
    }
    /**
     * Will ignore turn on command
     *
     * @param {number} for_ms milliseconds 
     * @memberof MotionSensor
     * @returns {boolean} did turn on
     */
    turnOnIfNotJustOff(for_ms) {
        let timeSinceLastOff = Date.now() - this.lastTurnOffTime;
        if (timeSinceLastOff >= for_ms) {
            this.turnOnNow()
        } else {
            this.debug(`won't turn on bacuase just turn off for ${timeSinceLastOff} ms, wait until configured ${for_ms} ms ...`);
        }

        return timeSinceLastOff >= for_ms;
    }
    turnOffNow() {
        this.debug(`timeout, clearing trigger status... (turn off trigger) || after ${this.passOnTimes} time pass-on in ${this.passOnTime} ms`);
        this.on = false;
        this.accessory.getService(Service.MotionSensor)
            .updateCharacteristic(Characteristic.MotionDetected, false);
        this.timeoutTurnOff = 0;
        this.lastTurnOffTime = Date.now();

        this.passOnTime = 0;
        this.passOnTimes = 0;
    }
    /**
     *
     *
     * @param {number} ms
     * @memberof MotionSensor
     */
    turnOffAfter(ms) {
        if (this.timeoutTurnOff == 0) {
            this.debug(`turnoff countdown started, will turn off after ${ms} ms.`);
        } else {
            this.debug(`turnoff countdown restarted. Pass on triggered event, will turn off after ${ms} ms.`);
            clearTimeout(this.timeoutTurnOff);
            // last on count
            let timeSinceLastTrigger = Date.now() - this.lastTriggerOn;
            this.debug(`triggered attempt to turn on (set turn off timer) since last has passed: ${timeSinceLastTrigger} ms.`);
            this.passOnTime += timeSinceLastTrigger;
            this.passOnTimes += 1;
        }
        this.lastTriggerOn = Date.now();
        this.timeoutTurnOff = setTimeout(this.turnOffNow.bind(this), ms);
    }
}

class MotionSensors {
    constructor() {
        /**
         * @type {MotionSensor[]}
         */
        this.sensors = [];
        /**
         * @type {Record<string, MotionSensor[]>}
         */
        this.varname2sensor = {};
        /**
         * @type {Record<string, MotionSensor[]>}
         */
        this.displayName2sensor = {};
    }
    /**
     *
     *
     * @param {MotionSensor} sensor
     * @memberof MotionSensors
     */
    push(sensor) {
        this.sensors.push(sensor);
        if (this.varname2sensor[sensor.varname]) {
            this.varname2sensor[sensor.varname].push(sensor);
        } else {
            this.varname2sensor[sensor.varname] = [sensor]
        }

        if (this.displayName2sensor[sensor.accessory.displayName]) {
            this.displayName2sensor[sensor.accessory.displayName].push(sensor);
        } else {
            this.displayName2sensor[sensor.accessory.displayName] = [sensor]
        }
    }
    /**
     *
     *
     * @param {string} varname
     * @returns {MotionSensor[]} 
     * @memberof MotionSensors
     */
    getByVarname(varname) {
        return this.varname2sensor[varname] || [];
    }
    /**
     *
     *
     * @param {string} displayName
     * @returns {MotionSensor[]} 
     * @memberof MotionSensors
     */
    getByDisplayname(displayName) {
        return this.displayName2sensor[displayName] || [];
    }
}

class SSSPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;

        // default parameters
        /**
         * @type {number}
         */
        this.config.port = this.config.hasOwnProperty('port') ? this.config.port : 8888;
        /**
         * @type {number}
         */
        this.config.resttime = this.config.hasOwnProperty('resttime') ? this.config.resttime : 1;

        this.port = this.config.port;

        this.motionsensors = new MotionSensors();
        if (api) {
            this.api = api;
            this.api.on('didFinishLaunching', () => {
                this.log('Cached Accessories Loaded');
                this.initPlatform();
                this.listener = require('http').createServer((req, res) => this.httpListener(req, res));
                this.listener.listen(this.port);
                this.log('listening on port ' + this.port);
            });
        }
    }

    // homebridge will restore cached accessories
    configureAccessory(accessory) {
        this.log(accessory.displayName, 'Configuring Accessory from Cache');
        accessory.reachable = false; // will turn to true after validated
        this.addAccessory(accessory, false); // don't publish to homekit as they are already active
    }

    // if cached, don't publish, otherwise set publish to true
    // method sets callbacks to accessories by accessory type
    addAccessory(accessory, publish) {
        this.log('adding accessory ' + accessory.displayName);
        // this.log(accessory);
        accessory.on('identify', (paired, callback) => {
            this.log(accessory.displayName, 'Identify!!!');
            callback();
        });
        let varname = null;
        if (accessory.getService(Service.MotionSensor)) {
            for (let i = 0; i < this.config.cameras.length; i++) {
                if (accessory.displayName == this.config.cameras[i].name) {
                    varname = this.config.cameras[i].varname;
                    break;
                }
            }
            if (varname != null) {
                accessory.getService(Service.MotionSensor)
                    .getCharacteristic(Characteristic.MotionDetected)
                    .on('get', (callback) => {
                        this.getStateMotion(varname, callback);
                    });
                accessory.reachable = true;
                this.motionsensors.push(new MotionSensor(varname, accessory, debug));
                this.log(`New MotionSensor ${accessory.displayName}[${varname}]`)
            }
            else {
                this.debug('matching varname for accessory not found, removing...');
                this.api.unregisterPlatformAccessories("homebridge-sss-platform", "sss-platform", [accessory]);
                return null;
            }
        }
        if (accessory.getService(Service.AccessoryInformation)) {
            accessory.getService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Name, accessory.displayName)
                .setCharacteristic(Characteristic.Manufacturer, 'synology')
                .setCharacteristic(Characteristic.Model, 'surv station')
                .setCharacteristic(Characteristic.SerialNumber, varname || 'unknown');
        }
        if (publish) {
            this.log('publishing platform accessory ' + accessory.displayName);
            this.api.registerPlatformAccessories('homebridge-sss-platform', 'sss-platform', [accessory]);
        }
        return accessory;
    }

    getStateMotion(varname, callback) {
        let sensors = this.motionsensors.getByVarname(varname);
        if (sensors.length > 0) {
            // TODO: better way to determine <???>
            // needs to explain what is <???>
            let sensor = sensors[0];
            if (sensor.on)
                callback(null, 1);
            else
                callback(null, 0);
        } else {
            this.debug(varname + ' not found for get');
            callback('no sensor found', null);
        }
    }

    debug(debugString) {
        debug(debugString);
    }

    updateStateMotion(varname) {
        let sensors = this.motionsensors.getByVarname(varname);
        if (sensors.length == 0) {
            this.debug(`Received motion from camera ${varname}, but no sensor configured found for update!`);
        } else {
            this.debug(`Received motion from camera ${varname}, ${sensors.length} configured triggers`);
            for (const sensor of sensors) {
                sensor.turnOnIfNotJustOff(this.config.resttime * 1000);
                if (sensor.on) sensor.turnOffAfter(this.config.timeout * 1000);
            }
        }
    }

    // method called synology, validates whether all accessories already exist and loads them if they do not
    initPlatform() {
        this.log('initalizing platform');
        for (let camera in this.config.cameras) {
            camera = this.config.cameras[camera];

            let sensors = this.motionsensors.getByVarname(camera.varname);
            if (sensors.length > 0) {
                for (const sensor of sensors) {
                    this.log('found ' + sensor.accessory.displayName + ' from cache, skipping config');
                    sensor.accessory.reachable = true;
                }
            } else {
                let uuid = UUIDGen.generate(camera.name);
                let newAccessory = new Accessory(camera.name, uuid);
                newAccessory.addService(Service.MotionSensor, camera.name);
                newAccessory.reachable = true;
                this.addAccessory(newAccessory, true);
            }
        }
    }

    // sets a listener to receive notifications from camera platform
    httpListener(req, res) {
        let data = '';
        let url = '';
        let triggeredCamera = null;

        if (req.method == 'POST') {
            req.on('data', (chunk) => {
                data += chunk;
            });
            req.on('end', () => {
                this.log('Received POST and body data:');
                this.log(data.toString());
                url = require('url').parse(req.url, true);
            });
        }
        if (req.method == 'GET') {
            req.on('end', () => {
                url = require('url').parse(req.url, true); // will parse parameters into query string
                triggeredCamera = url.query.varname;
                // this.log('Received motion from camera ' + triggeredCamera);
                if (triggeredCamera)
                    this.updateStateMotion(triggeredCamera);
                else
                    this.debug('motion detected from an unknown camera');
            });
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end();

    }
}