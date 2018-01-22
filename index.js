var Accessory, Service, Characteristic, UUIDGen;
var axios = require('axios'); 

module.exports = function(homebridge){
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerPlatform('homebridge-sss-platform', 'alarmdecoder-sss', SSSPlatform, true);
};

class SSSPlatform {
    constructor (log, config, api) {
        this.log = log;
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
        if (publish) {
            this.log('publishing platform accessory '+accessory.displayName);
            this.api.registerPlatformAccessories('homebridge-alarmdecoder-platform', 'alarmdecoder-platform', [accessory]);
        }
        return accessory;
    }

    // method called synology, validates whether all accessories already exist and loads them if they do not
    async initPlatform() {
        this.log('initalizing platform');
    }

    // sets a listener to receive notifications from camera platform
    httpListener(req, res) {
        var data = '';
		
        if (req.method == 'POST') {
            req.on('data', (chunk) => {
                data += chunk;
            });		
            req.on('end', () => {
                this.log('Received notification and body data:');
                this.log(data.toString());
            });
        }	
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end();
        this.log('ping received');
    }
}