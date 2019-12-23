'use strict';

// Note: You probably do not want to change any values in here because this
//       file might need to be updated with new default values for new
//       configuration options. Use the [config.local.js] file instead!

window.mumbleWebConfig = {
  // Which fields to show on the Connect to Server dialog
  'connectDialog': {
    'address': true,
    'port': true,
    'token': true,
    'username': true,
    'password': true,
    'channel': true
  },
  // Default values for user settings
  // You can see your current value by typing `localStorage.getItem('mumble.$setting')` in the web console.
  'settings': {
    'voiceMode': 'vad', // one of 'cont' (Continuous), 'ptt' (Push-to-Talk), 'vad' (Voice Activity Detection)
    'pttKey': 'ctrl + shift',
    'vadLevel': 0.3,
    'toolbarVertical': false,
    'showAvatars': 'always', // one of 'always', 'own_channel', 'linked_channel', 'minimal_only', 'never'
    'userCountInChannelName': false,
    'audioBitrate': 40000, // bits per second
    'samplesPerPacket': 960
  },
  // Default values (can be changed by passing a query parameter of the same name)
  'defaults': {
    // Connect Dialog
    'address': window.location.hostname,
    'port': '64737',
    'token': '',
    'username': '',
    'password': '',
    'joinDialog': false, // replace whole dialog with single "Join Conference" button
    'matrix': false, // enable Matrix Widget support (mostly auto-detected; implies 'joinDialog')
    'avatarurl': '', // download and set the user's Mumble avatar to the image at this URL
    // General
    'theme': 'MetroMumbleLight'
  },
  'defaultChannel': ''
};
'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

require('stream-browserify');

require('subworkers');

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _bytebuffer = require('bytebuffer');

var _bytebuffer2 = _interopRequireDefault(_bytebuffer);

var _mumbleClient = require('mumble-client');

var _mumbleClient2 = _interopRequireDefault(_mumbleClient);

var _workerClient = require('./worker-client');

var _workerClient2 = _interopRequireDefault(_workerClient);

var _webAudioBufferQueue = require('web-audio-buffer-queue');

var _webAudioBufferQueue2 = _interopRequireDefault(_webAudioBufferQueue);

var _audioContext = require('audio-context');

var _audioContext2 = _interopRequireDefault(_audioContext);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } } // see https://github.com/ericgundrum/pouch-websocket-sync-example/commit/2a4437b013092cc7b2cd84cf1499172c84a963a3
// polyfill for https://bugs.chromium.org/p/chromium/issues/detail?id=31666


var GlobalBindings = function GlobalBindings(config) {
  var _this = this;

  _classCallCheck(this, GlobalBindings);

  this.config = config;
  this.connector = new _workerClient2.default();
  this.client = null;
  this.socketURL = 'wss://<unset>';

  this.connect = function (username, host, port, token, password, initialChannelName) {
    _this.resetClient();

    console.log('Connecting to server ' + host);

    // Note: This call needs to be delayed until the user has interacted with
    // the page in some way (which at this point they have), see: https://goo.gl/7K7WLu
    _this.connector.setSampleRate((0, _audioContext2.default)().sampleRate);

    _this.socketURL = 'wss://' + host + ':' + port;

    document.querySelector('#loading b').innerHTML = '[(42%): Breaking down language barriers...]';

    // TODO: token
    _this.connector.connect(_this.socketURL, {
      username: username,
      password: password
    }).done(function (client) {

      console.log('Connected!');
      document.querySelector('#loading b').innerHTML = '[(69%): Cracking enigma...]';

      _this.client = client;
      // Prepare for connection errors
      client.on('error', function (err) {
        console.log('Connection error: ' + err);
        _this.resetClient();
      });

      // Register all channels, recursively
      var initialChannel = undefined;
      var registerChannel = function registerChannel(channel) {
        if (channel.name == initialChannelName) {
          initialChannel = channel;
          return;
        }
        channel.children.forEach(registerChannel);
      };
      registerChannel(client.root);

      // Register all users
      client.users.forEach(function (user) {
        return _this._newUser(user);
      });

      // Register future users in case the sender drops out
      client.on('newUser', function (user) {
        return _this._newUser(user);
      });

      // move to initial channel
      if (initialChannel) {
        client.self.setChannel(initialChannel);
      }

      // Tell server this device is muted
      _this.client.setSelfMute(true);

      document.getElementById('loading').style.display = 'none';
      document.getElementById('pauseButton').style.display = 'block';
      document.getElementById('statsButton').style.display = 'inline-block';
    }, function (err) {

      var alertText = "Connection error!\n";

      console.log('Connection error: ' + err);

      if (err.$type && err.$type.name === 'Reject') {

        alertText += 'Type' + err.type + ' ';

        switch (type) {
          case 1:
            alertText += '(incompatible version)';
          case 2:
            alertText += '(username rejected)';
          case 3:
          case 4:
            alertText += '(password incorrect)';
          case 5:
            alertText += '(username in use)';
          case 6:
            alertText += '(server full)';
          case 7:
            alertText += '(certificate required)';
          default:
            alertText += '(connection refused)';
        }

        alertText += '\n';

        alertText += 'Reason: ' + err.reason + '\n';
      }

      alert(alertText);
    });

    document.querySelector('#loading b').innerHTML = '[(92%): Spreading compassion...]';
  };

  this._newUser = function (user) {

    user.on('voice', function (stream) {

      console.log('User ' + user.username + ' started talking');

      var userNode = new _webAudioBufferQueue2.default({
        audioContext: (0, _audioContext2.default)()
      });
      userNode.connect((0, _audioContext2.default)().destination);

      stream.on('data', function (data) {
        userNode.write(data.buffer);
      }).on('end', function () {
        console.log('User ' + user.username + ' stopped talking');
        userNode.end();
      });
    });
  };

  this.resetClient = function () {
    if (_this.client) {
      _this.client.disconnect();
    }
    _this.client = null;
  };

  this.connected = function () {
    return _this.thisUser() != null;
  };
};

var ui = new GlobalBindings(window.mumbleWebConfig);

// Used only for debugging
window.mumbleUi = ui;

var queryParams = null;

function playStream() {

  document.getElementById('playButton').style.display = 'none';
  document.getElementById('loading').style.display = 'block';

  document.querySelector('#loading b').innerHTML = '[(16%): Translating rosetta stone...]';

  console.log("Connecting...");
  ui.connect('web-' + Math.random().toString(36).substring(6), queryParams.address, queryParams.port, queryParams.token, queryParams.password, queryParams.channel);
}

function pauseStream() {

  document.getElementById('pauseButton').style.display = 'none';
  document.getElementById('playButton').style.display = 'block';
  document.getElementById('statsButton').style.display = 'none';

  if (showStats) toggleStats();

  console.log("Disconnecting.");
  ui.resetClient();
}

var showStats = false;
var statTimer;

function updateStats(statEl) {

  var c = ui.client,
      sv = c.serverVersion;

  var latency = c.dataStats ? c.dataStats.mean.toFixed(2) : '--',
      latencyDev = c.dataStats ? Math.sqrt(c.dataStats.variance).toFixed(2) : '--';

  var codec = 'Opus',
      spp = window.mumbleWebConfig.settings.samplesPerPacket;

  var brm = (c.getMaxBitrate(spp, false) / 1000).toFixed(1),
      bwm = (c.maxBandwidth / 1000).toFixed(1),
      brc = (c.getActualBitrate(spp, false) / 1000).toFixed(1),
      bwc = (_mumbleClient2.default.calcEnforcableBandwidth(brc, spp, false) / 1000).toFixed(1);

  var text = '\n    <h4>Server</h4>\n    <p>\n      Mumble Version: ' + sv.major + '.' + sv.minor + '.' + sv.patch + ' Rev ' + sv.release + ' <br>\n      OS: ' + sv.os + ' ' + sv.osVersion + '\n    </p>\n    <h4>Control</h4>\n    <p>\n      Average latency: ' + latency + ' ms <br>\n      Latency deviation: ' + latencyDev + '<br>\n      WebSocket URL: ' + ui.socketURL + '\n    </p>\n    <h4>Audio</h4>\n    <p>\n      Codec: ' + codec + ' <br>\n      Samples per Packet: ' + spp + ' <br>\n      Maximum Bandwidth: ' + brm + ' kbit/s (' + bwm + ' with overhead) <br>\n      Current Bandwidth: ' + brc + ' kbit/s (' + bwc + ' with overhead) <br>\n    </p>\n  ';

  statEl.innerHTML = text;
}

function toggleStats() {

  var statEl = document.getElementById('stats');

  showStats = !showStats;

  if (showStats) {

    statEl.style.display = 'block';
    statTimer = setInterval(updateStats, 1000, statEl);
  } else {

    statEl.style.display = 'none';
    statEl.innerHTML = '';
    clearInterval(statTimer);
  }
}

window.onload = function () {

  queryParams = _url2.default.parse(document.location.href, true).query;

  queryParams = Object.assign({}, window.mumbleWebConfig.defaults, queryParams);

  console.log(queryParams);

  var _queryParams$channel$ = queryParams.channel.split('-'),
      _queryParams$channel$2 = _slicedToArray(_queryParams$channel$, 2),
      hall = _queryParams$channel$2[0],
      language = _queryParams$channel$2[1];

  document.querySelector('#greeter h1').innerHTML = hall;
  document.querySelector('#greeter h2').innerHTML = language;

  document.getElementById('playButton').addEventListener('click', playStream, false);
  document.getElementById('pauseButton').addEventListener('click', pauseStream, false);
  document.getElementById('statsButton').addEventListener('click', toggleStats, false);
};
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mumbleClient = require('mumble-client');

var _mumbleClient2 = _interopRequireDefault(_mumbleClient);

var _promise = require('promise');

var _promise2 = _interopRequireDefault(_promise);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _stream = require('stream');

var _toArraybuffer = require('to-arraybuffer');

var _toArraybuffer2 = _interopRequireDefault(_toArraybuffer);

var _bytebuffer = require('bytebuffer');

var _bytebuffer2 = _interopRequireDefault(_bytebuffer);

var _webworkify = require('webworkify');

var _webworkify2 = _interopRequireDefault(_webworkify);

var _worker = require('./worker');

var _worker2 = _interopRequireDefault(_worker);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Creates proxy MumbleClients to a real ones running on a web worker.
 * Only stuff which we need in mumble-web is proxied, i.e. this is not a generic solution.
 */
var WorkerBasedMumbleConnector = function () {
  function WorkerBasedMumbleConnector() {
    _classCallCheck(this, WorkerBasedMumbleConnector);

    this._worker = (0, _webworkify2.default)(_worker2.default);
    this._worker.addEventListener('message', this._onMessage.bind(this));
    this._reqId = 1;
    this._requests = {};
    this._clients = {};
    this._nextVoiceId = 1;
    this._voiceStreams = {};
  }

  _createClass(WorkerBasedMumbleConnector, [{
    key: 'setSampleRate',
    value: function setSampleRate(sampleRate) {
      this._postMessage({
        method: '_init',
        sampleRate: sampleRate
      });
    }
  }, {
    key: '_postMessage',
    value: function _postMessage(msg, transfer) {
      try {
        this._worker.postMessage(msg, transfer);
      } catch (err) {
        console.error('Failed to postMessage', msg);
        throw err;
      }
    }
  }, {
    key: '_call',
    value: function _call(id, method, payload, transfer) {
      var reqId = this._reqId++;
      console.debug(method, id, payload);
      this._postMessage({
        clientId: id.client,
        channelId: id.channel,
        userId: id.user,
        method: method,
        reqId: reqId,
        payload: payload
      }, transfer);
      return reqId;
    }
  }, {
    key: '_query',
    value: function _query(id, method, payload, transfer) {
      var _this = this;

      var reqId = this._call(id, method, payload, transfer);
      return new _promise2.default(function (resolve, reject) {
        _this._requests[reqId] = [resolve, reject];
      });
    }
  }, {
    key: '_addCall',
    value: function _addCall(proxy, name, id) {
      var self = this;
      proxy[name] = function () {
        self._call(id, name, Array.from(arguments));
      };
    }
  }, {
    key: 'connect',
    value: function connect(host, args) {
      var _this2 = this;

      return this._query({}, '_connect', { host: host, args: args }).then(function (id) {
        return _this2._client(id);
      });
    }
  }, {
    key: '_client',
    value: function _client(id) {
      var client = this._clients[id];
      if (!client) {
        client = new WorkerBasedMumbleClient(this, id);
        this._clients[id] = client;
      }
      return client;
    }
  }, {
    key: '_onMessage',
    value: function _onMessage(ev) {
      var data = ev.data;
      if (data.reqId != null) {
        console.debug(data);
        var reqId = data.reqId,
            result = data.result,
            error = data.error;

        var _requests$reqId = _slicedToArray(this._requests[reqId], 2),
            resolve = _requests$reqId[0],
            reject = _requests$reqId[1];

        delete this._requests[reqId];
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      } else if (data.clientId != null) {
        console.debug(data);
        var client = this._client(data.clientId);

        var target = void 0;
        if (data.userId != null) {
          target = client._user(data.userId);
        } else if (data.channelId != null) {
          target = client._channel(data.channelId);
        } else {
          target = client;
        }

        if (data.event) {
          target._dispatchEvent(data.event, data.value);
        } else if (data.prop) {
          target._setProp(data.prop, data.value);
        }
      } else if (data.voiceId != null) {
        var stream = this._voiceStreams[data.voiceId];
        var buffer = data.buffer;
        if (buffer) {
          stream.write({
            target: data.target,
            buffer: Buffer.from(buffer)
          });
        } else {
          delete this._voiceStreams[data.voiceId];
          stream.end();
        }
      }
    }
  }]);

  return WorkerBasedMumbleConnector;
}();

var WorkerBasedMumbleClient = function (_EventEmitter) {
  _inherits(WorkerBasedMumbleClient, _EventEmitter);

  function WorkerBasedMumbleClient(connector, clientId) {
    _classCallCheck(this, WorkerBasedMumbleClient);

    var _this3 = _possibleConstructorReturn(this, (WorkerBasedMumbleClient.__proto__ || Object.getPrototypeOf(WorkerBasedMumbleClient)).call(this));

    _this3._connector = connector;
    _this3._id = clientId;
    _this3._users = {};
    _this3._channels = {};

    var id = { client: clientId };
    connector._addCall(_this3, 'setSelfDeaf', id);
    connector._addCall(_this3, 'setSelfMute', id);
    connector._addCall(_this3, 'setSelfTexture', id);
    connector._addCall(_this3, 'setAudioQuality', id);

    connector._addCall(_this3, 'disconnect', id);
    var _disconnect = _this3.disconnect;
    _this3.disconnect = function () {
      _disconnect.apply(_this3);
      delete connector._clients[id];
    };

    connector._addCall(_this3, 'createVoiceStream', id);
    var _createVoiceStream = _this3.createVoiceStream;
    _this3.createVoiceStream = function () {
      var voiceId = connector._nextVoiceId++;

      var args = Array.from(arguments);
      args.unshift(voiceId);
      _createVoiceStream.apply(this, args);

      return new _stream.Writable({
        write: function write(chunk, encoding, callback) {
          chunk = (0, _toArraybuffer2.default)(chunk);
          connector._postMessage({
            voiceId: voiceId,
            chunk: chunk
          });
          callback();
        },
        final: function final(callback) {
          connector._postMessage({
            voiceId: voiceId
          });
          callback();
        }
      });
    };

    // Dummy client used for bandwidth calculations
    _this3._dummyClient = new _mumbleClient2.default({ username: 'dummy' });
    var defineDummyMethod = function defineDummyMethod(name) {
      _this3[name] = function () {
        return this._dummyClient[name].apply(this._dummyClient, arguments);
      };
    };
    defineDummyMethod('getMaxBitrate');
    defineDummyMethod('getActualBitrate');
    var _setAudioQuality = _this3.setAudioQuality;
    _this3.setAudioQuality = function () {
      this._dummyClient.setAudioQuality.apply(this._dummyClient, arguments);
      _setAudioQuality.apply(this, arguments);
    };
    return _this3;
  }

  _createClass(WorkerBasedMumbleClient, [{
    key: '_user',
    value: function _user(id) {
      var user = this._users[id];
      if (!user) {
        user = new WorkerBasedMumbleUser(this._connector, this, id);
        this._users[id] = user;
      }
      return user;
    }
  }, {
    key: '_channel',
    value: function _channel(id) {
      var channel = this._channels[id];
      if (!channel) {
        channel = new WorkerBasedMumbleChannel(this._connector, this, id);
        this._channels[id] = channel;
      }
      return channel;
    }
  }, {
    key: '_dispatchEvent',
    value: function _dispatchEvent(name, args) {
      var _this4 = this;

      if (name === 'newChannel') {
        args[0] = this._channel(args[0]);
      } else if (name === 'newUser') {
        args[0] = this._user(args[0]);
      } else if (name === 'message') {
        args[0] = this._user(args[0]);
        args[2] = args[2].map(function (id) {
          return _this4._user(id);
        });
        args[3] = args[3].map(function (id) {
          return _this4._channel(id);
        });
        args[4] = args[4].map(function (id) {
          return _this4._channel(id);
        });
      }
      args.unshift(name);
      this.emit.apply(this, args);
    }
  }, {
    key: '_setProp',
    value: function _setProp(name, value) {
      if (name === 'root') {
        name = '_rootId';
      }
      if (name === 'self') {
        name = '_selfId';
      }
      if (name === 'maxBandwidth') {
        this._dummyClient.maxBandwidth = value;
      }
      this[name] = value;
    }
  }, {
    key: 'root',
    get: function get() {
      return this._channel(this._rootId);
    }
  }, {
    key: 'channels',
    get: function get() {
      return Object.values(this._channels);
    }
  }, {
    key: 'users',
    get: function get() {
      return Object.values(this._users);
    }
  }, {
    key: 'self',
    get: function get() {
      return this._user(this._selfId);
    }
  }]);

  return WorkerBasedMumbleClient;
}(_events2.default);

var WorkerBasedMumbleChannel = function (_EventEmitter2) {
  _inherits(WorkerBasedMumbleChannel, _EventEmitter2);

  function WorkerBasedMumbleChannel(connector, client, channelId) {
    _classCallCheck(this, WorkerBasedMumbleChannel);

    var _this5 = _possibleConstructorReturn(this, (WorkerBasedMumbleChannel.__proto__ || Object.getPrototypeOf(WorkerBasedMumbleChannel)).call(this));

    _this5._connector = connector;
    _this5._client = client;
    _this5._id = channelId;

    var id = { client: client._id, channel: channelId };
    connector._addCall(_this5, 'sendMessage', id);
    return _this5;
  }

  _createClass(WorkerBasedMumbleChannel, [{
    key: '_dispatchEvent',
    value: function _dispatchEvent(name, args) {
      var _this6 = this;

      if (name === 'update') {
        var _args = args,
            _args2 = _slicedToArray(_args, 2),
            actor = _args2[0],
            props = _args2[1];

        Object.entries(props).forEach(function (entry) {
          _this6._setProp(entry[0], entry[1]);
        });
        if (props.parent != null) {
          props.parent = this.parent;
        }
        if (props.links != null) {
          props.links = this.links;
        }
        args = [this._client._user(actor), props];
      } else if (name === 'remove') {
        delete this._client._channels[this._id];
      }
      args.unshift(name);
      this.emit.apply(this, args);
    }
  }, {
    key: '_setProp',
    value: function _setProp(name, value) {
      var _this7 = this;

      if (name === 'parent') {
        name = '_parentId';
      }
      if (name === 'links') {
        value = value.map(function (id) {
          return _this7._client._channel(id);
        });
      }
      this[name] = value;
    }
  }, {
    key: 'parent',
    get: function get() {
      if (this._parentId != null) {
        return this._client._channel(this._parentId);
      }
    }
  }, {
    key: 'children',
    get: function get() {
      var _this8 = this;

      return Object.values(this._client._channels).filter(function (it) {
        return it.parent === _this8;
      });
    }
  }]);

  return WorkerBasedMumbleChannel;
}(_events2.default);

var WorkerBasedMumbleUser = function (_EventEmitter3) {
  _inherits(WorkerBasedMumbleUser, _EventEmitter3);

  function WorkerBasedMumbleUser(connector, client, userId) {
    _classCallCheck(this, WorkerBasedMumbleUser);

    var _this9 = _possibleConstructorReturn(this, (WorkerBasedMumbleUser.__proto__ || Object.getPrototypeOf(WorkerBasedMumbleUser)).call(this));

    _this9._connector = connector;
    _this9._client = client;
    _this9._id = userId;

    var id = { client: client._id, user: userId };
    connector._addCall(_this9, 'requestTexture', id);
    connector._addCall(_this9, 'clearTexture', id);
    connector._addCall(_this9, 'setMute', id);
    connector._addCall(_this9, 'setDeaf', id);
    connector._addCall(_this9, 'sendMessage', id);
    _this9.setChannel = function (channel) {
      connector._call(id, 'setChannel', channel._id);
    };
    return _this9;
  }

  _createClass(WorkerBasedMumbleUser, [{
    key: '_dispatchEvent',
    value: function _dispatchEvent(name, args) {
      var _this10 = this;

      if (name === 'update') {
        var _args3 = args,
            _args4 = _slicedToArray(_args3, 2),
            actor = _args4[0],
            props = _args4[1];

        Object.entries(props).forEach(function (entry) {
          _this10._setProp(entry[0], entry[1]);
        });
        if (props.channel != null) {
          props.channel = this.channel;
        }
        if (props.texture != null) {
          props.texture = this.texture;
        }
        args = [this._client._user(actor), props];
      } else if (name === 'voice') {
        var _args5 = args,
            _args6 = _slicedToArray(_args5, 1),
            id = _args6[0];

        var stream = new _stream.PassThrough({
          objectMode: true
        });
        this._connector._voiceStreams[id] = stream;
        args = [stream];
      } else if (name === 'remove') {
        delete this._client._users[this._id];
      }
      args.unshift(name);
      this.emit.apply(this, args);
    }
  }, {
    key: '_setProp',
    value: function _setProp(name, value) {
      if (name === 'channel') {
        name = '_channelId';
      }
      if (name === 'texture') {
        if (value) {
          var buf = _bytebuffer2.default.wrap(value.buffer);
          buf.offset = value.offset;
          buf.limit = value.limit;
          value = buf;
        }
      }
      this[name] = value;
    }
  }, {
    key: 'channel',
    get: function get() {
      return this._client._channels[this._channelId];
    }
  }]);

  return WorkerBasedMumbleUser;
}(_events2.default);

exports.default = WorkerBasedMumbleConnector;
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (self) {
  var sampleRate = void 0;
  var nextClientId = 1;
  var nextVoiceId = 1;
  var voiceStreams = [];
  var clients = [];

  function postMessage(msg, transfer) {
    try {
      self.postMessage(msg, transfer);
    } catch (err) {
      console.error('Failed to postMessage', msg);
      throw err;
    }
  }

  function resolve(reqId, value, transfer) {
    postMessage({
      reqId: reqId,
      result: value
    }, transfer);
  }

  function reject(reqId, value, transfer) {
    console.error(value);
    var jsonValue = JSON.parse(JSON.stringify(value));
    if (value.$type) {
      jsonValue.$type = { name: value.$type.name };
    }
    postMessage({
      reqId: reqId,
      error: jsonValue
    }, transfer);
  }

  function registerEventProxy(id, obj, event, transform) {
    obj.on(event, function (_) {
      postMessage({
        clientId: id.client,
        channelId: id.channel,
        userId: id.user,
        event: event,
        value: transform ? transform.apply(null, arguments) : Array.from(arguments)
      });
    });
  }

  function pushProp(id, obj, prop, transform) {
    var value = obj[prop];
    postMessage({
      clientId: id.client,
      channelId: id.channel,
      userId: id.user,
      prop: prop,
      value: transform ? transform(value) : value
    });
  }

  function setupOutboundVoice(voiceId, samplesPerPacket, stream) {
    var resampler = new _libsamplerate2.default({
      unsafe: true,
      type: _libsamplerate2.default.Type.SINC_FASTEST,
      ratio: 48000 / sampleRate
    });

    var buffer2Float32Array = new _stream2.Transform({
      transform: function transform(data, _, callback) {
        callback(null, new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4));
      },

      readableObjectMode: true
    });

    resampler.pipe((0, _streamChunker2.default)(4 * samplesPerPacket)).pipe(buffer2Float32Array).pipe(stream);

    voiceStreams[voiceId] = resampler;
  }

  function setupChannel(id, channel) {
    id = Object.assign({}, id, { channel: channel.id });

    registerEventProxy(id, channel, 'update', function (actor, props) {
      if (actor) {
        actor = actor.id;
      }
      if (props.parent) {
        props.parent = props.parent.id;
      }
      if (props.links) {
        props.links = props.links.map(function (it) {
          return it.id;
        });
      }
      return [actor, props];
    });
    registerEventProxy(id, channel, 'remove');

    pushProp(id, channel, 'parent', function (it) {
      return it ? it.id : it;
    });
    pushProp(id, channel, 'links', function (it) {
      return it.map(function (it) {
        return it.id;
      });
    });
    var props = ['position', 'name', 'description'];
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = props[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var prop = _step.value;

        pushProp(id, channel, prop);
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = channel.children[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var child = _step2.value;

        setupChannel(id, child);
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    return channel.id;
  }

  function setupUser(id, user) {
    id = Object.assign({}, id, { user: user.id });

    registerEventProxy(id, user, 'update', function (actor, props) {
      if (actor) {
        actor = actor.id;
      }
      if (props.channel != null) {
        props.channel = props.channel.id;
      }
      return [actor, props];
    });
    registerEventProxy(id, user, 'voice', function (stream) {
      var voiceId = nextVoiceId++;

      var target = void 0;

      // We want to do as little on the UI thread as possible, so do resampling here as well
      var resampler = new _libsamplerate2.default({
        unsafe: true,
        type: _libsamplerate2.default.Type.ZERO_ORDER_HOLD,
        ratio: sampleRate / 48000
      });

      // Pipe stream into resampler
      stream.on('data', function (data) {
        // store target so we can pass it on after resampling
        target = data.target;
        resampler.write(Buffer.from(data.pcm.buffer));
      }).on('end', function () {
        resampler.end();
      });

      // Pipe resampler into output stream on UI thread
      resampler.on('data', function (data) {
        data = (0, _toArraybuffer2.default)(data); // postMessage can't transfer node's Buffer
        postMessage({
          voiceId: voiceId,
          target: target,
          buffer: data
        }, [data]);
      }).on('end', function () {
        postMessage({
          voiceId: voiceId
        });
      });

      return [voiceId];
    });
    registerEventProxy(id, user, 'remove');

    pushProp(id, user, 'channel', function (it) {
      return it ? it.id : it;
    });
    var props = ['uniqueId', 'username', 'mute', 'deaf', 'suppress', 'selfMute', 'selfDeaf', 'texture', 'textureHash', 'comment'];
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
      for (var _iterator3 = props[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
        var prop = _step3.value;

        pushProp(id, user, prop);
      }
    } catch (err) {
      _didIteratorError3 = true;
      _iteratorError3 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion3 && _iterator3.return) {
          _iterator3.return();
        }
      } finally {
        if (_didIteratorError3) {
          throw _iteratorError3;
        }
      }
    }

    return user.id;
  }

  function setupClient(id, client) {
    id = { client: id };

    registerEventProxy(id, client, 'error');
    registerEventProxy(id, client, 'newChannel', function (it) {
      return [setupChannel(id, it)];
    });
    registerEventProxy(id, client, 'newUser', function (it) {
      return [setupUser(id, it)];
    });
    registerEventProxy(id, client, 'message', function (sender, message, users, channels, trees) {
      return [sender.id, message, users.map(function (it) {
        return it.id;
      }), channels.map(function (it) {
        return it.id;
      }), trees.map(function (it) {
        return it.id;
      })];
    });
    client.on('dataPing', function () {
      pushProp(id, client, 'dataStats');
    });

    setupChannel(id, client.root);
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
      for (var _iterator4 = client.users[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
        var user = _step4.value;

        setupUser(id, user);
      }
    } catch (err) {
      _didIteratorError4 = true;
      _iteratorError4 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion4 && _iterator4.return) {
          _iterator4.return();
        }
      } finally {
        if (_didIteratorError4) {
          throw _iteratorError4;
        }
      }
    }

    pushProp(id, client, 'root', function (it) {
      return it.id;
    });
    pushProp(id, client, 'self', function (it) {
      return it.id;
    });
    pushProp(id, client, 'welcomeMessage');
    pushProp(id, client, 'serverVersion');
    pushProp(id, client, 'maxBandwidth');
  }

  function onMessage(data) {
    var reqId = data.reqId,
        method = data.method,
        payload = data.payload;

    if (method === '_init') {
      sampleRate = data.sampleRate;
    } else if (method === '_connect') {
      payload.args.codecs = CodecsBrowser;
      (0, _mumbleClientWebsocket2.default)(payload.host, payload.args).then(function (client) {
        var id = nextClientId++;
        clients[id] = client;
        setupClient(id, client);
        return id;
      }).done(function (id) {
        resolve(reqId, id);
      }, function (err) {
        reject(reqId, err);
      });
    } else if (data.clientId != null) {
      var client = clients[data.clientId];

      var target = void 0;
      if (data.userId != null) {
        target = client.getUserById(data.userId);
        if (method === 'setChannel') {
          payload = [client.getChannelById(payload)];
        }
      } else if (data.channelId != null) {
        target = client.getChannelById(data.channelId);
      } else {
        target = client;
        if (method === 'createVoiceStream') {
          var voiceId = payload.shift();
          var samplesPerPacket = payload.shift();

          var stream = target.createVoiceStream.apply(target, payload);

          setupOutboundVoice(voiceId, samplesPerPacket, stream);
          return;
        }
        if (method === 'disconnect') {
          delete clients[data.clientId];
        }
      }

      target[method].apply(target, payload);
    } else if (data.voiceId != null) {
      var _stream = voiceStreams[data.voiceId];
      var buffer = data.chunk;
      if (buffer) {
        _stream.write(Buffer.from(buffer));
      } else {
        delete voiceStreams[data.voiceId];
        _stream.end();
      }
    }
  }

  self.addEventListener('message', function (ev) {
    try {
      onMessage(ev.data);
    } catch (ex) {
      console.error('exception during message event', ev.data, ex);
    }
  });
};

var _stream2 = require('stream');

var _mumbleClientWebsocket = require('mumble-client-websocket');

var _mumbleClientWebsocket2 = _interopRequireDefault(_mumbleClientWebsocket);

var _toArraybuffer = require('to-arraybuffer');

var _toArraybuffer2 = _interopRequireDefault(_toArraybuffer);

var _streamChunker = require('stream-chunker');

var _streamChunker2 = _interopRequireDefault(_streamChunker);

var _libsamplerate = require('libsamplerate.js');

var _libsamplerate2 = _interopRequireDefault(_libsamplerate);

require('subworkers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Monkey-patch to allow webworkify-webpack and codecs to work inside of web worker
/* global URL */
window.URL = URL;

// Using require to ensure ordering relative to monkey-patch above


// Polyfill nested webworkers for https://bugs.chromium.org/p/chromium/issues/detail?id=31666
var CodecsBrowser = require('mumble-client-codecs-browser');
