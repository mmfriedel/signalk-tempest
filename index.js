

/*
 * Copyright 2020 Michael Friedel
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = function (app) {
  var plugin = {};
  var socket;

  plugin.id = 'signalk-tempest';
  plugin.name = 'SignalK Tempest';
  plugin.description = 'This plugin allows you to receive data from the Weatherflow Tempest weather station';

  function station2sealevel(pSta, elev) {
    const ys = 0.0065
    const g = 9.80665
    const rd = 287.05
    const p1 = (rd*ys)/g
    const p2 = g/(rd*ys)
    return pSta * Math.pow(1 + Math.pow(1013.25/pSta,p1) * ((ys*elev)/288.15),p2)
  }
  function degrees2radians(d) {
    return (Math.round(d*0.01745*100)/100);
  }

  plugin.start = function (options, restartPlugin) {
    var dgram = require('dgram');
    socket = dgram.createSocket('udp4');

    socket.on('listening', function () {
      socket.setBroadcast(true);
      socket.addMembership('239.255.255.250');
    });
    socket.on('message', function (message, remote) {
      var values = [];
      var packet = JSON.parse(message)
      // Decode messages.. and add to values
      if (packet.type.localeCompare('obs_st')==0) {
        values.push({ path: 'environment.outside.pressure', value: parseFloat(packet.obs[0][6])*100 });
        values.push({ path: 'environment.outside.temperature', value: parseFloat(packet.obs[0][7])+273});
        values.push({ path: 'environment.outside.relativeHumidity', value: parseFloat(packet.obs[0][8])});
        values.push({ path: 'environment.outside.illuminance', value: parseFloat(packet.obs[0][9])});
        values.push({ path: 'environment.outside.solar', value: parseFloat(packet.obs[0][11])});

        values.push({ path: 'environment.outside.wind.lull', value: parseFloat(packet.obs[0][1])});
        values.push({ path: 'environment.outside.wind.avg', value: parseFloat(packet.obs[0][2])});
        values.push({ path: 'environment.outside.wind.gusts', value: parseFloat(packet.obs[0][3])});
        var wd = parseFloat(packet.obs[0][4]);
        if (wd > 180) { wd -= 360; }
        values.push({ path: 'environment.outside.wind.angle', value: degrees2radians(wd)});
        values.push({ path: 'environment.outside.rain', value: parseFloat(packet.obs[0][12])});
      }
      else if (packet.type.localeCompare('rapid_wind')==0) {
        var wd = parseFloat(packet.ob[2]);
        if (wd > 180) { wd -= 360; }
        values.push({ path: 'environment.wind.angleApparent', value: degrees2radians(wd)});
        values.push({ path: 'environment.wind.speedApparent', value: parseFloat(packet.ob[1])});
      }

      if (values.length) {
        // Notify  of changes
        app.handleMessage('signalk-tempest', {
          updates: [
            {
              values: values
            }
          ]
        });
      }
    });

    socket.bind('50222');
  };

  plugin.stop = function () {
    socket.close();
  };

  plugin.schema = {
    type: 'object',
    properties: {
      temp: {
        type: 'string',
        title: 'SignalK key for temperature',
        default: 'environment.outside.temperature'
      },
      humidity: {
        type: 'string',
        title: 'SignalK key for humidity',
        default: 'environment.outside.relativeHumidity'
      },
      pressure: {
        type: 'string',
        title: 'SignalK key for pressure (Pa)',
        default: 'environment.outside.pressure'
      },
      illuminance: {
        type: 'string',
        title: 'SignalK key for illuminance (Lux)',
        default: 'environment.outside.illuminance'
      },
      solar: {
        type: 'string',
        title: 'SignalK key for solar irradiation (W/m2)',
        default: 'environment.outside.solar',
        units: "W/m2"
      },
      aws: {
        type: 'string',
        title: 'SignalK key for windspeed',
        default: 'environment.wind.speedApparent',
      },
      awa: {
        type: 'string',
        title: 'SignalK key for wind direction (apparent)',
        default: 'environment.wind.angleApparent',
      },
    }
  };

  return plugin;
};