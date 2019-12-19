var Accessory, Service, Characteristic, UUIDGen;
var debug = require('debug')('SynologyCamera');

module.exports = function(homebridge){
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerPlatform('homebridge-sss-platform', 'sss-platform', SSSPlatform, true);
};

class MotionSensor {
    constructor (varname, accessory) {
        this.varname = varname; //name that will be passed by get parameter
        this.accessory = accessory;
        this.faulted=false;
    }
}

class SSSPlatform {
    constructor (log, config, api) {
        this.log = log;
        this.port = config.port;
        this.config = config;
        this.motionsensors = [];
        if(api) {
            this.api = api;
            this.api.on('didFinishLaunching', ()=>{
                this.log('Cached Accessories Loaded');
                this.initPlatform();
                this.listener = require('http').createServer((req, res)=>this.httpListener(req, res));
                this.listener.listen(this.port);
                this.log('listening on port '+this.port);
            });
        }
    }

    // homebridge will restore cached accessories
    configureAccessory(accessory){
        this.log(accessory.displayName, 'Configuring Accessory from Cache');
        accessory.reachable = false; // will turn to true after validated
        this.addAccessory(accessory, false); // don't publish to homekit as they are already active
    }

    // if cached, don't publish, otherwise set publish to true
    // method sets callbacks to accessories by accessory type
    addAccessory(accessory, publish) {
        this.log('adding accessory '+ accessory.displayName);
        accessory.on('identify', (paired, callback) => {
            this.log(accessory.displayName, 'Identify!!!');
            callback();
        });
        if(accessory.getService(Service.MotionSensor)) {
            var varname = null;
            for (let i=0; i<this.config.cameras.length; i++) {
                if(accessory.displayName == this.config.cameras[i].name) {
                    varname = this.config.cameras[i].varname;
                    break;
                }
            }
            if (varname != null) {
                accessory.getService(Service.MotionSensor)
                    .getCharacteristic(Characteristic.MotionDetected)
                    .on('get', (callback)=>{
                        this.getStateMotion(varname,callback);
                    });
                this.motionsensors.push(new MotionSensor(varname, accessory));
            }
            else {
                this.debug('matching varname for accessory not found');
                return null;
            }
        }
        if(accessory.getService(Service.AccessoryInformation)) {
            accessory.getService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Name, accessory.displayName)
                .setCharacteristic(Characteristic.Manufacturer, 'synology')
                .setCharacteristic(Characteristic.Model, 'surv station');
        }
        if (publish) {
            this.log('publishing platform accessory '+accessory.displayName);
            this.api.registerPlatformAccessories('homebridge-sss-platform', 'sss-platform', [accessory]);
        }
        return accessory;
    }

    getStateMotion(varname, callback) {
        var found = false;
        for(let i in this.motionsensors) {
            let sensor = this.motionsensors[i];
            if(sensor.varname == varname) {
                found=true;
                if(sensor.faulted)
                    callback(null,1);
                else
                    callback(null,0);
                break;
            }
        }
        if(!found) {
            this.debug(varname+' not found for get');
            callback('no sensor found', null);
        }
    }

    debug(debugString) {
        debug(debugString);
    }

    flipState(sensor) {
        this.debug('timeout reached for sensor '+sensor.varname+' clearing...');
        sensor.faulted=false;
        sensor.accessory.getService(Service.MotionSensor)
            .updateCharacteristic(Characteristic.MotionDetected, false);
    }

    updateStateMotion(varname) {
        var found = false;
        for(let i in this.motionsensors) {
            let sensor = this.motionsensors[i];
            if(sensor.varname == varname) {
                found=true;
                this.debug('found sensor '+varname);
                if(!sensor.faulted) {
                    this.debug('setting '+varname+' to true');
                    sensor.faulted = true;
                    sensor.accessory.getService(Service.MotionSensor)
                        .updateCharacteristic(Characteristic.MotionDetected, sensor.faulted);
                    setTimeout(()=>this.flipState(sensor),this.config.timeout*1000);
                }
                break;
            }
        }
        if(!found) {
            this.debug(varname+' not found for update');
        }
    }

    // method called synology, validates whether all accessories already exist and loads them if they do not
    initPlatform() {
        this.log('initalizing platform');
        for (let camera in this.config.cameras) {
            camera = this.config.cameras[camera];
            var exists=false;
            for (let sensor in this.motionsensors) {
                sensor = this.motionsensors[sensor];
                if(sensor.varname == camera.varname) {
                    exists = true;
                    this.log('found '+sensor.accessory.displayName+' from cache, skipping config');
                    sensor.accessory.reachable=true;
                    break;
                }
            }
            if(!exists) {
                let uuid = UUIDGen.generate(camera.name);
                let newAccessory = new Accessory(camera.name, uuid);
                newAccessory.addService(Service.MotionSensor, camera.name);
                newAccessory.reachable=true;
                this.addAccessory(newAccessory,true);
            }
        }
    }

    // sets a listener to receive notifications from camera platform
    httpListener(req, res) {
        let data = '';
        let url = '';
        let triggeredCamera=null;
		
        if (req.method == 'POST') {
            req.on('data', (chunk) => {
                data += chunk;
            });		
            req.on('end', () => {
                this.log('Received POST and body data:');
                this.log(data.toString());
                url = require('url').parse(req.url,true);
            });
        }
        if (req.method == 'GET') {
            req.on('end', () => {
                url = require('url').parse(req.url,true); // will parse parameters into query string
                triggeredCamera=url.query.varname;
                if(triggeredCamera)
                    this.updateStateMotion(triggeredCamera);
                else
                    this.debug('motion detected from an unknown camera');
            });
        }
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end();

    }


}
