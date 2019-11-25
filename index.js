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
     * @param {strting} varname
     * @param {Accessory} accessory
     * @param {debug} debug
     * @memberof MotionSensor
     */
    constructor(varname, accessory, debug) {
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
        this.off = false;
        this.debug = debug;
        this.timeoutTurnOff = -1;
        this.lastTurnOffTime = Date.now();
        this.lastTriggerOn = 0;
    }
    get on(){
        return !this.off;
    }
    set on(bool){
        this.off = !bool;
    }
    turnOnNow() {
        if (this.debug) this.debug(`sensor ${this.accessory.displayName}[${this.varname}] turn on now ...`);
        this.off = true;
        this.accessory.getService(Service.MotionSensor)
            .updateCharacteristic(Characteristic.MotionDetected, true);
    }
    /**
     * Will ignore turn on command
     *
     * @param {number} for_ms milliseconds 
     * @memberof MotionSensor
     * @returns {boolean} did turn on
     */
    turnOnIfNotJustOff(for_ms) {
        // last on count
        let timeSinceLastTrigger = Date.now() - this.lastTriggerOn;
        this.lastTriggerOn = Date.now();
        if (this.debug) this.debug(`sensor ${this.accessory.displayName}[${this.varname}] triggered attempt to turn on since last has passed: ${timeSinceLastTrigger} ms.`);

        let timeSinceLastOff = Date.now() - this.lastTurnOffTime;
        if(timeSinceLastOff >=  for_ms){
            this.turnOnNow()
        }else{
            if (this.debug) this.debug(`sensor ${this.accessory.displayName}[${this.varname}] won't turn on bacuase just turn off for ${timeSinceLastOff} ms, wait until configured ${for_ms} ms ...`);
        }

        return timeSinceLastOff >= for_ms;
    }
    turnOffNow() {
        if (this.debug) this.debug(`sensor ${this.accessory.displayName}[${this.varname}] timeout, clearing trigger status...`);
        this.off = false;
        this.accessory.getService(Service.MotionSensor)
            .updateCharacteristic(Characteristic.MotionDetected, false);
        this.timeoutTurnOff = -1;
        this.lastTurnOffTime = Date.now();
    }
    /**
     *
     *
     * @param {number} ms
     * @memberof MotionSensor
     */
    turnOffAfter(ms) {
        if (this.timeoutTurnOff >= 0) {
            if (this.debug) this.debug(`sensor ${this.accessory.displayName}[${this.varname}] turnoff countdown restarted. pass on triggered event.`);
            clearTimeout(this.timeoutTurnOff);
        }
        this.timeoutTurnOff = setTimeout(this.turnOffNow.bind(this), ms);
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
        /**
         * @type {MotionSensor[]}
         */
        this.motionsensors = [];
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
                this.motionsensors.push(new MotionSensor(varname, accessory, this.debug));
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
        var found = false;
        for (let i in this.motionsensors) {
            let sensor = this.motionsensors[i];
            if (sensor.varname == varname) {
                found = true;
                if (sensor.off)
                    callback(null, 1);
                else
                    callback(null, 0);
                break;
            }
        }
        if (!found) {
            this.debug(varname + ' not found for get');
            callback('no sensor found', null);
        }
    }

    debug(debugString) {
        debug(debugString);
    }

    updateStateMotion(varname) {
        let sensor = null;
        for (let i in this.motionsensors) {
            if (this.motionsensors[i].varname == varname) {
                sensor = this.motionsensors[i];
                this.debug(`Received motion from camera ${varname}`);
                break;
            }
        }
        if (!sensor){
            this.debug(`Received motion from camera ${varname}, but no sensor configured found for update!`);
            return;
        }
        if (sensor.on) {
            sensor.turnOnIfNotJustOff(this.config.resttime * 1000);
        }
        if(sensor.on) sensor.turnOffAfter(this.config.timeout * 1000);
    }

    // method called synology, validates whether all accessories already exist and loads them if they do not
    initPlatform() {
        this.log('initalizing platform');
        for (let camera in this.config.cameras) {
            camera = this.config.cameras[camera];
            var exists = false;
            for (let sensor in this.motionsensors) {
                sensor = this.motionsensors[sensor];
                if (sensor.varname == camera.varname) {
                    exists = true;
                    this.log('found ' + sensor.accessory.displayName + ' from cache, skipping config');
                    sensor.accessory.reachable = true;
                    break;
                }
            }
            if (!exists) {
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